import uuid
from datetime import datetime

from pydantic import BaseModel

from app.schemas.user import UserOut


class NotificationOut(BaseModel):
    id: uuid.UUID
    type: str
    actor: UserOut | None
    task_id: uuid.UUID | None
    task_title: str | None
    message: str
    is_read: bool
    created_at: datetime


class MetricsDashboard(BaseModel):
    status_distribution: list[dict]
    overdue_count: int
    avg_tat_hours: float | None
    total_tasks: int


class WorkloadEntry(BaseModel):
    user: UserOut
    in_progress: int
    queued: int
    overdue: int


class TeamWorkload(BaseModel):
    workload: list[WorkloadEntry]
