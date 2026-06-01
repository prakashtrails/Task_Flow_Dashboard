import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, get_task_or_404, require_task_assigner
from app.models import Task, User
from app.schemas.task import TaskSummary
from app.services import serializers
from app.services.notification_service import notify

router = APIRouter(prefix="/tasks/{task_id}/subtasks", tags=["subtasks"])

SUB_STATUSES = ("Queued", "In Progress", "Done")


class SubTaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    assignee_id: uuid.UUID
    due_date: date


class SubTaskUpdate(BaseModel):
    status: str | None = Field(default=None, pattern="^(Queued|In Progress|Done)$")
    title: str | None = None


@router.get("", response_model=list[TaskSummary])
async def list_subtasks(
    task: Task = Depends(get_task_or_404),
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    subs = (
        await db.scalars(
            select(Task).where(
                Task.parent_task_id == task.id, Task.deleted_at.is_(None)
            )
        )
    ).all()
    return await serializers.to_summaries(db, list(subs))


@router.post("", response_model=TaskSummary, status_code=201)
async def create_subtask(
    body: SubTaskCreate,
    task: Task = Depends(require_task_assigner),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sub = Task(
        title=body.title.strip(),
        priority=task.priority,
        status="Queued",
        assigner_id=user.id,
        assignee_id=body.assignee_id,
        parent_task_id=task.id,
        due_date=body.due_date,
        effort_unit="hours",
    )
    db.add(sub)
    await db.commit()
    full = await db.scalar(select(Task).where(Task.id == sub.id))
    return (await serializers.to_summaries(db, [full]))[0]


@router.patch("/{sub_id}", response_model=TaskSummary)
async def update_subtask(
    sub_id: uuid.UUID,
    body: SubTaskUpdate,
    task: Task = Depends(get_task_or_404),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sub = await db.scalar(
        select(Task).where(
            Task.id == sub_id, Task.parent_task_id == task.id, Task.deleted_at.is_(None)
        )
    )
    if not sub:
        raise HTTPException(404, detail={"code": "SUBTASK_NOT_FOUND", "message": "Sub-task not found."})
    # assignee of the subtask or the parent's assigner may update
    if user.id not in (sub.assignee_id, task.assigner_id):
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Cannot edit this sub-task."})

    if body.title is not None:
        sub.title = body.title
    if body.status is not None and body.status != sub.status:
        sub.status = body.status
        if body.status == "Done":
            await notify(
                db,
                type_="subtask_done",
                actor_id=user.id,
                task=task,
                message=f'{user.name} completed a sub-task on "{task.title}"',
                target_user_ids=[task.assigner_id],
            )
    await db.commit()
    full = await db.scalar(select(Task).where(Task.id == sub.id))
    return (await serializers.to_summaries(db, [full]))[0]


@router.delete("/{sub_id}", status_code=204)
async def delete_subtask(
    sub_id: uuid.UUID,
    task: Task = Depends(require_task_assigner),
    db: AsyncSession = Depends(get_db),
):
    sub = await db.scalar(
        select(Task).where(Task.id == sub_id, Task.parent_task_id == task.id)
    )
    if sub:
        from app.services.task_service import now_utc

        sub.deleted_at = now_utc()
        await db.commit()
    return None
