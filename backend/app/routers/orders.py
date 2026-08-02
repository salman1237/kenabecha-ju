import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.order import CheckoutRequest, OrderOut, OrderStatusUpdate
from app.services import order_service

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("/checkout", response_model=list[OrderOut])
async def checkout(
    payload: CheckoutRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[OrderOut]:
    orders = await order_service.checkout(db, user, payload, background_tasks)
    return [OrderOut.model_validate(o) for o in orders]


@router.get("/mine", response_model=list[OrderOut])
async def list_my_orders(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[OrderOut]:
    orders = await order_service.list_my_orders(db, user)
    return [OrderOut.model_validate(o) for o in orders]


@router.get("/selling", response_model=list[OrderOut])
async def list_selling_orders(
    shop_id: uuid.UUID | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[OrderOut]:
    orders = await order_service.list_selling_orders(db, user, shop_id)
    return [OrderOut.model_validate(o) for o in orders]


@router.get("/{order_id}", response_model=OrderOut)
async def get_order(
    order_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> OrderOut:
    order = await order_service.get_order(db, order_id, user)
    return OrderOut.model_validate(order)


@router.patch("/{order_id}/status", response_model=OrderOut)
async def update_order_status(
    order_id: uuid.UUID,
    payload: OrderStatusUpdate,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> OrderOut:
    order = await order_service.get_order(db, order_id, user)
    updated = await order_service.update_status(db, order, user, payload, background_tasks)
    return OrderOut.model_validate(updated)
