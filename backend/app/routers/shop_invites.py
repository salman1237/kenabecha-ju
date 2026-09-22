import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.notification import NotificationType
from app.models.user import User
from app.schemas.shop import ShopCollaboratorRespondIn, ShopInviteOut
from app.services import notification_service, shop_service

# A deliberately separate prefix from /shops: GET /shops/{slug} is a
# string-typed single-segment route already registered there, and
# "/shops/invites" would collide with it (Starlette matches by segment
# shape, not by the UUID/slug distinction, which is only enforced once
# inside the handler). Keeping this on its own prefix sidesteps the
# ordering question entirely rather than relying on registration order.
router = APIRouter(prefix="/shop-invites", tags=["shops"])
settings = get_settings()


@router.get("", response_model=list[ShopInviteOut])
async def list_my_invites(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[ShopInviteOut]:
    invites = await shop_service.list_pending_invites_for_user(db, user.id)
    return [
        ShopInviteOut(
            id=invite.id,
            shop_id=invite.shop_id,
            shop_name=invite.shop.shop_name,
            shop_slug=invite.shop.slug,
            shop_logo_url=invite.shop.logo_url,
            invited_by_name=invite.shop.owner.full_name,
            created_at=invite.created_at,
        )
        for invite in invites
    ]


@router.post("/{invite_id}/respond", status_code=status.HTTP_204_NO_CONTENT)
async def respond_to_invite(
    invite_id: uuid.UUID,
    payload: ShopCollaboratorRespondIn,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    invite = await shop_service.get_own_invite(db, invite_id, user)
    shop_name = invite.shop.shop_name
    shop_slug = invite.shop.slug
    owner_id = invite.shop.owner_id
    await shop_service.respond_to_invite(db, invite, payload.accept)

    verb = "accepted" if payload.accept else "declined"
    await notification_service.notify(
        db,
        background_tasks,
        owner_id,
        NotificationType.shop_collaborator_responded,
        title=f"{user.full_name} {verb} your invite to help manage {shop_name}",
        body=None,
        link_url=f"/shops/{shop_slug}" if payload.accept else None,
        related_shop_id=invite.shop_id,
        email_subject=f"{user.full_name} {verb} your shop invite on KenaBecha JU",
        email_body=(
            f"{user.full_name} {verb} your invite to help manage \"{shop_name}\" on KenaBecha JU."
        ),
    )
