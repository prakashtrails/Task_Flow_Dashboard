import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    email: EmailStr
    role: str
    avatar: str
    avatar_color: str
    timezone: str = "UTC"


class UserMetrics(BaseModel):
    tasks_assigned: int
    tasks_completed: int
    avg_tat_hours: float | None
    tasks_overdue: int
    current_workload: int
