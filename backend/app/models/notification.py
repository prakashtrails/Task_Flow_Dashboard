import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.user import User  # noqa: F401  (relationship target resolution)

NOTIFICATION_TYPES = (
    "task_created",
    "update_posted",
    "marked_complete",
    "approved",
    "changes_requested",
    "dependency_unblocked",
    "subtask_done",
    "task_closed",
    "task_assigned",
    "overdue_warning",
    "mention",
)


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    type: Mapped[str] = mapped_column(String(40), nullable=False)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    task_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True, index=True
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    actor: Mapped["User"] = relationship("User", lazy="joined")
    recipients: Mapped[list["NotificationRecipient"]] = relationship(
        back_populates="notification", cascade="all, delete-orphan", lazy="selectin"
    )


class NotificationRecipient(Base):
    __tablename__ = "notification_recipients"

    notification_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("notifications.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    notification: Mapped["Notification"] = relationship(back_populates="recipients")
