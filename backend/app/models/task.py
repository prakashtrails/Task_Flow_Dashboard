import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Table,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin
from app.models.user import User  # noqa: F401  (relationship target resolution)

# many-to-many tasks <-> tags
task_tags = Table(
    "task_tags",
    Base.metadata,
    Column("task_id", ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    color: Mapped[str] = mapped_column(String(7), default="#607D8B")


class Task(Base, TimestampMixin):
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint(
            "priority IN ('Low','Medium','High','Critical')", name="ck_task_priority"
        ),
        # 'Done' is included for sub-tasks, which use the simplified
        # Queued -> In Progress -> Done pipeline (spec §14.5).
        CheckConstraint(
            "status IN ('Queued','In Progress','Pending Review','Approved','Closed','Done')",
            name="ck_task_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="Medium")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="Queued", index=True)
    assigner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    assignee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    parent_task_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True, index=True
    )
    estimated_effort: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    effort_unit: Mapped[str | None] = mapped_column(String(10), nullable=True)
    due_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    assigner: Mapped["User"] = relationship("User", foreign_keys=[assigner_id], lazy="joined")
    assignee: Mapped["User"] = relationship("User", foreign_keys=[assignee_id], lazy="joined")
    tags: Mapped[list["Tag"]] = relationship(secondary=task_tags, lazy="selectin")
    progress_updates: Mapped[list["ProgressUpdate"]] = relationship(
        back_populates="task", cascade="all, delete-orphan", lazy="selectin"
    )
    approval_events: Mapped[list["ApprovalEvent"]] = relationship(
        back_populates="task", cascade="all, delete-orphan", lazy="selectin"
    )
    dependencies: Mapped[list["TaskDependency"]] = relationship(
        foreign_keys="TaskDependency.task_id",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class TaskDependency(Base):
    __tablename__ = "task_dependencies"
    __table_args__ = (
        CheckConstraint("task_id != depends_on_task_id", name="no_self_dependency"),
    )

    task_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True
    )
    depends_on_task_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )


class TaskLink(Base):
    __tablename__ = "task_links"

    source_task_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True
    )
    target_task_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True
    )
    link_type: Mapped[str] = mapped_column(String(30), default="follow_up")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )


class ProgressUpdate(Base, TimestampMixin):
    __tablename__ = "progress_updates"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    task_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    current_work: Mapped[str] = mapped_column(Text, nullable=False)
    next_steps: Mapped[str] = mapped_column(Text, nullable=False, default="")

    task: Mapped["Task"] = relationship(back_populates="progress_updates")


class ApprovalEvent(Base):
    __tablename__ = "approval_events"
    __table_args__ = (
        CheckConstraint(
            "action IN ('Approved','Changes Requested')", name="ck_approval_action"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    task_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(30), nullable=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    task: Mapped["Task"] = relationship(back_populates="approval_events")
