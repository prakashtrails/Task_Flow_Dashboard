import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models import Task, User
from app.schemas.user import UserMetrics, UserOut
from app.services.task_service import RESOLVED, _aware, now_utc

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
async def list_users(
    _: User = Depends(require_role("Assigner")),
    db: AsyncSession = Depends(get_db),
):
    users = (
        await db.scalars(select(User).where(User.deleted_at.is_(None)).order_by(User.name))
    ).all()
    return list(users)


@router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: uuid.UUID,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user = await db.scalar(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
    if not user:
        raise HTTPException(404, detail={"code": "USER_NOT_FOUND", "message": "User not found."})
    return user


@router.get("/{user_id}/metrics", response_model=UserMetrics)
async def user_metrics(
    user_id: uuid.UUID,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user = await db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(404, detail={"code": "USER_NOT_FOUND", "message": "User not found."})

    if user.role == "Assigner":
        condition = Task.assigner_id == user_id
    else:
        condition = Task.assignee_id == user_id

    tasks = (
        await db.scalars(select(Task).where(condition, Task.deleted_at.is_(None)))
    ).all()

    completed = [t for t in tasks if t.status in RESOLVED]
    from datetime import date

    overdue = [
        t for t in tasks if t.status not in RESOLVED and t.due_date < date.today()
    ]
    in_progress = [t for t in tasks if t.status == "In Progress"]

    tats = [
        (_aware(t.approved_at) - _aware(t.created_at)).total_seconds() / 3600
        for t in completed
        if t.approved_at
    ]
    avg = round(sum(tats) / len(tats), 2) if tats else None

    return UserMetrics(
        tasks_assigned=len(tasks),
        tasks_completed=len(completed),
        avg_tat_hours=avg,
        tasks_overdue=len(overdue),
        current_workload=len(in_progress),
    )
