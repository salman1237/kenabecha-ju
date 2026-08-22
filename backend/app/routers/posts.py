import uuid

from fastapi import APIRouter, Depends, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_optional_user, get_seller
from app.db.session import get_db
from app.models.user import User
from app.schemas.common import Page
from app.schemas.post import PostCreate, PostImageOut, PostOut, PostUpdate
from app.services import media_service, post_service, shop_service

router = APIRouter(prefix="/posts", tags=["posts"])


@router.post("", response_model=PostOut, status_code=status.HTTP_201_CREATED)
async def create_post(
    payload: PostCreate, user: User = Depends(get_seller), db: AsyncSession = Depends(get_db)
) -> PostOut:
    shop = await shop_service.get_owned_shop(db, payload.shop_id, user)
    post = await post_service.create_post(db, shop, payload)
    return PostOut.model_validate(post)


@router.get("/feed", response_model=Page[PostOut])
async def feed(
    limit: int = 24,
    offset: int = 0,
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
) -> Page[PostOut]:
    posts, total = await post_service.feed(db, user, limit, offset)
    return Page(items=[PostOut.model_validate(p) for p in posts], total=total, limit=limit, offset=offset)


@router.get("/shop/{shop_id}", response_model=list[PostOut])
async def list_posts_for_shop(
    shop_id: uuid.UUID, user: User | None = Depends(get_optional_user), db: AsyncSession = Depends(get_db)
) -> list[PostOut]:
    posts = await post_service.get_shop_posts(db, shop_id, user)
    return [PostOut.model_validate(p) for p in posts]


@router.get("/mine", response_model=list[PostOut])
async def list_mine(
    shop_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[PostOut]:
    await shop_service.get_owned_shop(db, shop_id, user)
    posts = await post_service.list_shop_posts(db, shop_id, published_only=False)
    return [PostOut.model_validate(p) for p in posts]


@router.get("/{slug}", response_model=PostOut)
async def get_post_by_slug(
    slug: str, user: User | None = Depends(get_optional_user), db: AsyncSession = Depends(get_db)
) -> PostOut:
    post = await post_service.get_visible_post_by_slug(db, slug, user)
    return PostOut.model_validate(post)


@router.patch("/{post_id}", response_model=PostOut)
async def update_post(
    post_id: uuid.UUID,
    payload: PostUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PostOut:
    post = await post_service.get_owned_post(db, post_id, user)
    updated = await post_service.update_post(db, post, payload)
    return PostOut.model_validate(updated)


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> None:
    post = await post_service.get_owned_post(db, post_id, user)
    await post_service.delete_post(db, post)


@router.post("/{post_id}/images", response_model=PostImageOut, status_code=status.HTTP_201_CREATED)
async def add_image(
    post_id: uuid.UUID,
    file: UploadFile,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PostImageOut:
    post = await post_service.get_owned_post(db, post_id, user)
    url = await media_service.save_image(file, subdir="posts")
    image = await post_service.add_image(db, post, url)
    return PostImageOut.model_validate(image)


@router.delete("/{post_id}/images/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_image(
    post_id: uuid.UUID,
    image_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    post = await post_service.get_owned_post(db, post_id, user)
    await post_service.delete_image(db, post, image_id)
