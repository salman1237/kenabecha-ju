import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.order import CartItemCreate, CartItemOut, CartItemUpdate
from app.services import cart_service

router = APIRouter(prefix="/cart", tags=["cart"])


@router.get("", response_model=list[CartItemOut])
async def get_cart(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> list[CartItemOut]:
    items = await cart_service.list_cart(db, user)
    return [CartItemOut.model_validate(i) for i in items]


@router.post("", response_model=CartItemOut, status_code=status.HTTP_201_CREATED)
async def add_to_cart(
    payload: CartItemCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> CartItemOut:
    item = await cart_service.add_to_cart(db, user, payload)
    return CartItemOut.model_validate(item)


@router.patch("/{item_id}", response_model=CartItemOut)
async def update_cart_item(
    item_id: uuid.UUID,
    payload: CartItemUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CartItemOut:
    item = await cart_service.update_cart_item(db, user, item_id, payload)
    return CartItemOut.model_validate(item)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_cart_item(
    item_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> None:
    await cart_service.remove_cart_item(db, user, item_id)
