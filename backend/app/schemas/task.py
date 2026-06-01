import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.user import UserOut

PRIORITIES = ("Low", "Medium", "High", "Critical")
STATUSES = ("Queued", "In Progress", "Pending Review", "Approved", "Closed")


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    priority: str = Field(default="Medium", pattern="^(Low|Medium|High|Critical)$")
    assignee_id: uuid.UUID
    due_date: date
    estimated_effort: float | None = None
    effort_unit: str | None = Field(default="hours", pattern="^(hours|points)$")
    tags: list[str] = []
    depends_on_task_ids: list[uuid.UUID] = []
    parent_task_id: uuid.UUID | None = None


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    description: str | None = None
    priority: str | None = Field(default=None, pattern="^(Low|Medium|High|Critical)$")
    assignee_id: uuid.UUID | None = None
    due_date: date | None = None
    estimated_effort: float | None = None
    effort_unit: str | None = Field(default=None, pattern="^(hours|points)$")
    tags: list[str] | None = None


class StatusTransition(BaseModel):
    status: str = Field(pattern="^(Queued|In Progress|Pending Review|Approved|Closed)$")


class RequestChanges(BaseModel):
    comment: str = Field(min_length=1)


class ApproveRequest(BaseModel):
    comment: str | None = None


class DependencyAdd(BaseModel):
    depends_on_task_id: uuid.UUID


class ProgressUpdateIn(BaseModel):
    current_work: str = Field(min_length=1)
    next_steps: str = ""


class TagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    name: str
    color: str


class ProgressUpdateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    task_id: uuid.UUID
    user_id: uuid.UUID
    current_work: str
    next_steps: str
    created_at: datetime


class ApprovalEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    task_id: uuid.UUID
    user_id: uuid.UUID
    action: str
    comment: str | None
    created_at: datetime


class TatInfo(BaseModel):
    tat_hours: float
    tat_label: str
    is_overdue: bool
    is_due_soon: bool
    tat_status: str  # overdue | due_soon | on_track


class TaskSummary(BaseModel):
    """Lightweight task shape for list/board views."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str | None
    priority: str
    status: str
    assigner: UserOut
    assignee: UserOut
    due_date: date
    estimated_effort: float | None
    effort_unit: str | None
    is_blocked: bool
    parent_task_id: uuid.UUID | None
    created_at: datetime
    approved_at: datetime | None
    tags: list[TagOut] = []
    depends_on_task_ids: list[uuid.UUID] = []
    tat: TatInfo
    subtask_count: int = 0
    subtask_done_count: int = 0


class TaskDetail(TaskSummary):
    started_at: datetime | None = None
    submitted_at: datetime | None = None
    closed_at: datetime | None = None
    progress_updates: list[ProgressUpdateOut] = []
    approval_events: list[ApprovalEventOut] = []
    blocking_titles: list[str] = []
