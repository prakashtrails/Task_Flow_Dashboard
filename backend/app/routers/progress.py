import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, get_task_or_404
from app.models import ProgressUpdate, Task, User
from app.schemas.task import ProgressUpdateIn, ProgressUpdateOut
from app.services.notification_service import notify

router = APIRouter(prefix="/tasks/{task_id}/updates", tags=["progress"])


@router.get("", response_model=list[ProgressUpdateOut])
async def list_updates(
    task: Task = Depends(get_task_or_404),
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.scalars(
            select(ProgressUpdate)
            .where(ProgressUpdate.task_id == task.id)
            .order_by(ProgressUpdate.created_at.asc())
        )
    ).all()
    return list(rows)


@router.post("", response_model=ProgressUpdateOut, status_code=201)
async def post_update(
    body: ProgressUpdateIn,
    task: Task = Depends(get_task_or_404),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if task.assignee_id != user.id:
        raise HTTPException(
            403,
            detail={"code": "FORBIDDEN", "message": "Only the assignee can post progress updates."},
        )
    update = ProgressUpdate(
        task_id=task.id,
        user_id=user.id,
        current_work=body.current_work,
        next_steps=body.next_steps,
    )
    db.add(update)
    await notify(
        db,
        type_="update_posted",
        actor_id=user.id,
        task=task,
        message=f'{user.name} posted an update on "{task.title}"',
        target_user_ids=[task.assigner_id],
    )
    await db.commit()
    await db.refresh(update)
    return update
