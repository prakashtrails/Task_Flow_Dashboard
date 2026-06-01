import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Notification, NotificationRecipient, Task


async def notify(
    db: AsyncSession,
    *,
    type_: str,
    actor_id: uuid.UUID | None,
    task: Task | None,
    message: str,
    target_user_ids: list[uuid.UUID],
) -> Notification:
    """Create a notification and fan it out to recipients. Caller commits."""
    notification = Notification(
        type=type_,
        actor_id=actor_id,
        task_id=task.id if task else None,
        message=message,
    )
    db.add(notification)
    await db.flush()  # get notification.id
    seen: set[uuid.UUID] = set()
    for uid in target_user_ids:
        if uid in seen:
            continue
        seen.add(uid)
        db.add(
            NotificationRecipient(notification_id=notification.id, user_id=uid)
        )
    return notification
