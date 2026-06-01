import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models import Notification, NotificationRecipient, Task, User
from app.schemas.notification import NotificationOut
from app.schemas.user import UserOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _user_out(u) -> UserOut | None:
    if not u:
        return None
    return UserOut(
        id=u.id, name=u.name, email=u.email, role=u.role,
        avatar=u.avatar, avatar_color=u.avatar_color, timezone=u.timezone,
    )


async def _serialize(db: AsyncSession, rows) -> list[NotificationOut]:
    out = []
    task_ids = {n.task_id for n, _ in rows if n.task_id}
    titles = {}
    if task_ids:
        tr = await db.execute(select(Task.id, Task.title).where(Task.id.in_(task_ids)))
        titles = {r[0]: r[1] for r in tr.all()}
    for n, is_read in rows:
        out.append(
            NotificationOut(
                id=n.id,
                type=n.type,
                actor=_user_out(n.actor),
                task_id=n.task_id,
                task_title=titles.get(n.task_id),
                message=n.message,
                is_read=is_read,
                created_at=n.created_at,
            )
        )
    return out


@router.get("", response_model=list[NotificationOut])
async def my_feed(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    unread: bool = False,
    limit: int = Query(50, ge=1, le=200),
):
    stmt = (
        select(Notification, NotificationRecipient.is_read)
        .join(
            NotificationRecipient,
            NotificationRecipient.notification_id == Notification.id,
        )
        .where(NotificationRecipient.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    if unread:
        stmt = stmt.where(NotificationRecipient.is_read.is_(False))
    rows = (await db.execute(stmt)).all()
    return await _serialize(db, rows)


@router.get("/feed", response_model=list[NotificationOut])
async def global_feed(
    _: User = Depends(require_role("Assigner")),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(100, ge=1, le=500),
):
    rows = (
        await db.execute(
            select(Notification).order_by(Notification.created_at.desc()).limit(limit)
        )
    ).scalars().all()
    return await _serialize(db, [(n, True) for n in rows])


@router.patch("/{notification_id}/read", status_code=204)
async def mark_read(
    notification_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        update(NotificationRecipient)
        .where(
            NotificationRecipient.notification_id == notification_id,
            NotificationRecipient.user_id == user.id,
        )
        .values(is_read=True, read_at=datetime.now(timezone.utc))
    )
    await db.commit()
    return None


@router.post("/read-all", status_code=204)
async def read_all(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        update(NotificationRecipient)
        .where(
            NotificationRecipient.user_id == user.id,
            NotificationRecipient.is_read.is_(False),
        )
        .values(is_read=True, read_at=datetime.now(timezone.utc))
    )
    await db.commit()
    return None


@router.delete("", status_code=204)
async def clear_all(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        delete(NotificationRecipient).where(NotificationRecipient.user_id == user.id)
    )
    await db.commit()
    return None
