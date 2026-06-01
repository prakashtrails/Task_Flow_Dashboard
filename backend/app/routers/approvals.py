from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, get_task_or_404, require_task_assigner
from app.models import ApprovalEvent, Task, User
from app.schemas.task import ApprovalEventOut, ApproveRequest, RequestChanges, TaskDetail
from app.services import serializers
from app.services.notification_service import notify
from app.services.task_service import dependents_to_unblock, now_utc

router = APIRouter(prefix="/tasks/{task_id}", tags=["approvals"])


def _ensure_pending(task: Task) -> None:
    if task.status != "Pending Review":
        raise HTTPException(
            422,
            detail={
                "code": "INVALID_STATE",
                "message": "Task must be in 'Pending Review' to review it.",
            },
        )


@router.post("/approve", response_model=TaskDetail)
async def approve(
    body: ApproveRequest,
    task: Task = Depends(require_task_assigner),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_pending(task)
    now = now_utc()
    task.status = "Approved"
    task.approved_at = now
    db.add(
        ApprovalEvent(task_id=task.id, user_id=user.id, action="Approved", comment=body.comment)
    )
    await notify(
        db,
        type_="approved",
        actor_id=user.id,
        task=task,
        message=f'{user.name} approved "{task.title}"',
        target_user_ids=[task.assignee_id],
    )

    # auto-unblock dependents (atomic — same transaction)
    await db.flush()
    unblocked = await dependents_to_unblock(db, task.id)
    for dep in unblocked:
        await notify(
            db,
            type_="dependency_unblocked",
            actor_id=user.id,
            task=dep,
            message=f'"{dep.title}" is now unblocked and ready to start',
            target_user_ids=[dep.assignee_id],
        )

    await db.commit()
    full = await serializers.load_task(db, task.id)
    return await serializers.to_detail(db, full)


@router.post("/request-changes", response_model=TaskDetail)
async def request_changes(
    body: RequestChanges,
    task: Task = Depends(require_task_assigner),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_pending(task)
    task.status = "In Progress"
    db.add(
        ApprovalEvent(
            task_id=task.id, user_id=user.id, action="Changes Requested", comment=body.comment
        )
    )
    await notify(
        db,
        type_="changes_requested",
        actor_id=user.id,
        task=task,
        message=f'{user.name} requested changes on "{task.title}"',
        target_user_ids=[task.assignee_id],
    )
    await db.commit()
    full = await serializers.load_task(db, task.id)
    return await serializers.to_detail(db, full)


@router.get("/approvals", response_model=list[ApprovalEventOut])
async def approval_history(
    task: Task = Depends(get_task_or_404),
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.scalars(
            select(ApprovalEvent)
            .where(ApprovalEvent.task_id == task.id)
            .order_by(ApprovalEvent.created_at.asc())
        )
    ).all()
    return list(rows)
