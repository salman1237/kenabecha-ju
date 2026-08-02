import uuid
from collections import defaultdict

from fastapi import BackgroundTasks, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.listing import FulfillmentType, ListingStatus
from app.models.notification import NotificationType
from app.models.order import CartItem, Order, OrderItem, OrderStatus
from app.models.user import User
from app.schemas.order import CheckoutRequest, OrderStatusUpdate
from app.services import cart_service, notification_service

settings = get_settings()

# Terminal states (completed/cancelled) have no further allowed transitions.
ALLOWED_SELLER_TRANSITIONS: dict[OrderStatus, set[OrderStatus]] = {
    OrderStatus.pending: {OrderStatus.confirmed, OrderStatus.cancelled},
    OrderStatus.confirmed: {OrderStatus.completed, OrderStatus.cancelled},
}


async def checkout(
    db: AsyncSession, buyer: User, payload: CheckoutRequest, background_tasks: BackgroundTasks
) -> list[Order]:
    cart_items = await cart_service.list_cart(db, buyer)
    if not cart_items:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your cart is empty")

    # Re-validate at checkout time — a listing could've changed since it was added to cart.
    for item in cart_items:
        listing = item.listing
        if listing.deleted_at is not None or listing.status != ListingStatus.active:
            raise HTTPException(status.HTTP_409_CONFLICT, f'"{listing.title}" is no longer available')
        if item.quantity > listing.quantity:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f'Only {listing.quantity} left of "{listing.title}" — update your cart and try again',
            )

    # One order per (seller, shop, fulfillment_type) — a shop's pickup items and delivery
    # items become separate orders, and shop vs. personal listings stay separate too.
    groups: dict[tuple[uuid.UUID, uuid.UUID | None, FulfillmentType], list[CartItem]] = defaultdict(list)
    for item in cart_items:
        listing = item.listing
        groups[(listing.seller_id, listing.shop_id, listing.fulfillment_type)].append(item)

    needs_delivery_address = any(key[2] == FulfillmentType.delivery for key in groups)
    if needs_delivery_address and not payload.delivery_address:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Delivery address is required for delivery orders")

    orders: list[Order] = []
    for (seller_id, shop_id, fulfillment_type), items in groups.items():
        order = Order(
            buyer_id=buyer.id,
            seller_id=seller_id,
            shop_id=shop_id,
            fulfillment_type=fulfillment_type,
            delivery_address=payload.delivery_address if fulfillment_type == FulfillmentType.delivery else None,
            buyer_phone=payload.buyer_phone,
        )
        db.add(order)
        await db.flush()

        for item in items:
            listing = item.listing
            db.add(
                OrderItem(
                    order_id=order.id,
                    listing_id=listing.id,
                    quantity=item.quantity,
                    unit_price=listing.price,
                    price_type=listing.price_type,
                )
            )
            listing.quantity -= item.quantity
            if listing.quantity <= 0:
                listing.status = ListingStatus.sold if listing.shop_id is None else ListingStatus.out_of_stock
            await db.delete(item)

        orders.append(order)

    await db.commit()
    for order in orders:
        await db.refresh(order)

    for order in orders:
        item_count = sum(i.quantity for i in order.items)
        plural = "s" if item_count != 1 else ""
        await notification_service.notify(
            db,
            background_tasks,
            order.seller_id,
            NotificationType.order_placed,
            title="New order received",
            body=f"{buyer.full_name} placed an order for {item_count} item{plural}.",
            link_url=f"/orders/{order.id}",
            email_subject="New order on KenaBecha JU",
            email_body=(
                f"{buyer.full_name} just placed a new {order.fulfillment_type.value} order for "
                f"{item_count} item{plural}.\n\n"
                f"View it at: {settings.FRONTEND_URL}/orders/{order.id}"
            ),
            related_order_id=order.id,
        )

    return orders


async def list_my_orders(db: AsyncSession, buyer: User) -> list[Order]:
    result = await db.execute(select(Order).where(Order.buyer_id == buyer.id).order_by(Order.created_at.desc()))
    return list(result.scalars().unique().all())


async def list_selling_orders(db: AsyncSession, seller: User, shop_id: uuid.UUID | None = None) -> list[Order]:
    query = select(Order).where(Order.seller_id == seller.id)
    if shop_id is not None:
        query = query.where(Order.shop_id == shop_id)
    query = query.order_by(Order.created_at.desc())
    return list((await db.execute(query)).scalars().unique().all())


async def get_order(db: AsyncSession, order_id: uuid.UUID, user: User) -> Order:
    order = await db.get(Order, order_id)
    if order is None or (order.buyer_id != user.id and order.seller_id != user.id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    return order


async def update_status(
    db: AsyncSession,
    order: Order,
    actor: User,
    payload: OrderStatusUpdate,
    background_tasks: BackgroundTasks,
) -> Order:
    is_buyer = actor.id == order.buyer_id
    is_seller = actor.id == order.seller_id
    if not is_buyer and not is_seller:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your order")

    if is_buyer:
        if payload.status != OrderStatus.cancelled or order.status != OrderStatus.pending:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "You can only cancel a pending order")
    elif payload.status not in ALLOWED_SELLER_TRANSITIONS.get(order.status, set()):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Can't move an order from {order.status.value} to {payload.status.value}",
        )

    order.status = payload.status
    await db.commit()
    await db.refresh(order)

    recipient_id = order.seller_id if is_buyer else order.buyer_id
    await notification_service.notify(
        db,
        background_tasks,
        recipient_id,
        NotificationType.order_status_changed,
        title="Order status updated",
        body=f"Your order is now {order.status.value}.",
        link_url=f"/orders/{order.id}",
        email_subject="Your KenaBecha JU order status changed",
        email_body=(
            f"Your order status changed to {order.status.value}.\n\n"
            f"View it at: {settings.FRONTEND_URL}/orders/{order.id}"
        ),
        related_order_id=order.id,
    )
    return order
