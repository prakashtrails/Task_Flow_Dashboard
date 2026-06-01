import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, get_task_or_404, require_task_assigner
from app.models import Task, TaskDependency, User
from app.schemas.task import DependencyAdd
from app.services.task_service import refresh_blocked_flag, would_create_cycle

router = APIRouter(prefix="/tasks/{task_id}/dependencies", tags=["dependencies"])


@router.get("")
async def list_dependencies(
    task: Task = Depends(get_task_or_404),
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = await db.execute(
        select(Task.id, Task.title, Task.status)
        .join(TaskDependency, TaskDependency.depends_on_task_id == Task.id)
        .where(TaskDependency.task_id == task.id)
    )
    return {
        "data": [
            {"id": str(r[0]), "title": r[1], "status": r[2]} for r in rows.all()
        ]
    }


@router.post("", status_code=201)
async def add_dependency(
    body: DependencyAdd,
    task: Task = Depends(require_task_assigner),
    db: AsyncSession = Depends(get_db),
):
    dep = await db.scalar(
        select(Task).where(Task.id == body.depends_on_task_id, Task.deleted_at.is_(None))
    )
    if not dep:
        raise HTTPException(404, detail={"code": "TASK_NOT_FOUND", "message": "Dependency task not found."})

    if await would_create_cycle(db, task.id, body.depends_on_task_id):
        raise HTTPException(
            422,
            detail={
                "code": "CIRCULAR_DEPENDENCY",
                "message": "Adding this dependency would create a circular dependency.",
            },
        )

    existing = await db.scalar(
        select(TaskDependency).where(
            TaskDependency.task_id == task.id,
            TaskDependency.depends_on_task_id == body.depends_on_task_id,
        )
    )
    if not existing:
        db.add(TaskDependency(task_id=task.id, depends_on_task_id=body.depends_on_task_id))
        await db.flush()
        await refresh_blocked_flag(db, task)
        await db.commit()
    return {"data": {"task_id": str(task.id), "depends_on_task_id": str(body.depends_on_task_id)}}


@router.delete("/{dep_id}", status_code=204)
async def remove_dependency(
    dep_id: uuid.UUID,
    task: Task = Depends(require_task_assigner),
    db: AsyncSession = Depends(get_db),
):
    row = await db.scalar(
        select(TaskDependency).where(
            TaskDependency.task_id == task.id,
            TaskDependency.depends_on_task_id == dep_id,
        )
    )
    if row:
        await db.delete(row)
        await db.flush()
        await refresh_blocked_flag(db, task)
        await db.commit()
    return None
