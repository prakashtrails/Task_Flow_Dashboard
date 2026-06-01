import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import (
    get_current_user,
    get_task_or_404,
    require_task_assigner,
)
from app.models import Tag, Task, TaskDependency, User
from app.schemas.common import Page, PageMeta
from app.schemas.task import (
    StatusTransition,
    TaskCreate,
    TaskDetail,
    TaskSummary,
    TaskUpdate,
)
from app.services import serializers
from app.services.notification_service import notify
from app.services.task_service import (
    RESOLVED,
    blocking_titles,
    now_utc,
    refresh_blocked_flag,
    validate_transition,
)

router = APIRouter(prefix="/tasks", tags=["tasks"])

SORT_COLUMNS = {
    "created_at": Task.created_at,
    "due_date": Task.due_date,
    "priority": Task.priority,
    "title": Task.title,
    "status": Task.status,
}


async def _full_task(db: AsyncSession, task_id: uuid.UUID) -> Task:
    task = await serializers.load_task(db, task_id)
    if not task:
        raise HTTPException(404, detail={"code": "TASK_NOT_FOUND", "message": "Task not found."})
    return task


async def _resolve_tags(db: AsyncSession, names: list[str]) -> list[Tag]:
    tags: list[Tag] = []
    for raw in names:
        name = raw.strip().lower()
        if not name:
            continue
        tag = await db.scalar(select(Tag).where(Tag.name == name))
        if not tag:
            tag = Tag(name=name)
            db.add(tag)
            await db.flush()
        tags.append(tag)
    return tags


@router.get("", response_model=Page[TaskSummary])
async def list_tasks(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status_: str | None = Query(None, alias="status"),
    priority: str | None = None,
    assignee_id: uuid.UUID | None = None,
    assigner_id: uuid.UUID | None = None,
    tag: str | None = None,
    overdue: bool | None = None,
    due_before: date | None = None,
    due_after: date | None = None,
    mine: bool = False,
    q: str | None = None,
    sort_by: str = "due_date",
    sort_dir: str = "asc",
):
    stmt = select(Task).where(Task.deleted_at.is_(None))

    # Assignees can only see tasks they're involved in
    if user.role != "Assigner" or mine:
        stmt = stmt.where(
            or_(Task.assignee_id == user.id, Task.assigner_id == user.id)
        )

    if status_:
        stmt = stmt.where(Task.status == status_)
    if priority:
        stmt = stmt.where(Task.priority == priority)
    if assignee_id:
        stmt = stmt.where(Task.assignee_id == assignee_id)
    if assigner_id:
        stmt = stmt.where(Task.assigner_id == assigner_id)
    if overdue:
        stmt = stmt.where(Task.due_date < date.today(), Task.status.notin_(RESOLVED))
    if due_before:
        stmt = stmt.where(Task.due_date <= due_before)
    if due_after:
        stmt = stmt.where(Task.due_date >= due_after)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(
            or_(func.lower(Task.title).like(like), func.lower(Task.description).like(like))
        )
    if tag:
        stmt = stmt.join(Task.tags).where(Tag.name == tag.lower())

    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))

    col = SORT_COLUMNS.get(sort_by, Task.due_date)
    stmt = stmt.order_by(col.desc() if sort_dir == "desc" else col.asc())
    stmt = stmt.offset((page - 1) * per_page).limit(per_page)

    tasks = (await db.scalars(stmt)).all()
    data = await serializers.to_summaries(db, list(tasks))
    return Page(data=data, meta=PageMeta(page=page, per_page=per_page, total=total or 0))


@router.post("", response_model=TaskDetail, status_code=201)
async def create_task(
    body: TaskCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Assigners may assign to anyone; Assignees may only assign to themselves.
    if user.role != "Assigner" and body.assignee_id != user.id:
        raise HTTPException(
            403,
            detail={
                "code": "FORBIDDEN",
                "message": "Assignees can only assign tasks to themselves.",
            },
        )
    assignee = await db.scalar(select(User).where(User.id == body.assignee_id))
    if not assignee:
        raise HTTPException(422, detail={"code": "INVALID_ASSIGNEE", "message": "Assignee not found."})

    task = Task(
        title=body.title.strip(),
        description=body.description,
        priority=body.priority,
        status="Queued",
        assigner_id=user.id,
        assignee_id=body.assignee_id,
        due_date=body.due_date,
        estimated_effort=body.estimated_effort,
        effort_unit=body.effort_unit,
        parent_task_id=body.parent_task_id,
    )
    task.tags = await _resolve_tags(db, body.tags)
    db.add(task)
    await db.flush()

    # dependencies
    for dep_id in body.depends_on_task_ids:
        dep = await db.scalar(select(Task).where(Task.id == dep_id, Task.deleted_at.is_(None)))
        if not dep:
            continue
        db.add(TaskDependency(task_id=task.id, depends_on_task_id=dep_id))

    await db.flush()
    await refresh_blocked_flag(db, task)

    await notify(
        db,
        type_="task_created",
        actor_id=user.id,
        task=task,
        message=f'{user.name} assigned you "{task.title}"',
        target_user_ids=[task.assignee_id],
    )
    await db.commit()
    full = await _full_task(db, task.id)
    return await serializers.to_detail(db, full)


@router.get("/{task_id}", response_model=TaskDetail)
async def get_task(
    task: Task = Depends(get_task_or_404),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role != "Assigner" and user.id not in (task.assignee_id, task.assigner_id):
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Not your task."})
    return await serializers.to_detail(db, task)


@router.patch("/{task_id}", response_model=TaskDetail)
async def update_task(
    body: TaskUpdate,
    task: Task = Depends(require_task_assigner),
    db: AsyncSession = Depends(get_db),
):
    data = body.model_dump(exclude_unset=True)
    if "tags" in data:
        task.tags = await _resolve_tags(db, data.pop("tags") or [])
    for field, value in data.items():
        setattr(task, field, value)
    await db.commit()
    full = await _full_task(db, task.id)
    return await serializers.to_detail(db, full)


@router.delete("/{task_id}", status_code=204)
async def delete_task(
    task: Task = Depends(get_task_or_404),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # The task's creator may delete it (covers Assigner-created and Assignee
    # self-created tasks alike).
    if task.assigner_id != user.id:
        raise HTTPException(
            403,
            detail={"code": "FORBIDDEN", "message": "Only the task creator can delete it."},
        )
    task.deleted_at = now_utc()
    # cascade soft-delete subtasks
    subs = (await db.scalars(select(Task).where(Task.parent_task_id == task.id))).all()
    for s in subs:
        s.deleted_at = now_utc()
    await db.commit()
    return None


@router.post("/{task_id}/status", response_model=TaskDetail)
async def transition_status(
    body: StatusTransition,
    task: Task = Depends(get_task_or_404),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Approval transitions go through dedicated endpoints
    if task.status == "Pending Review":
        raise HTTPException(
            422,
            detail={
                "code": "USE_APPROVAL_ENDPOINT",
                "message": "Use /approve or /request-changes for review actions.",
            },
        )

    validate_transition(task, body.status, user)
    now = now_utc()

    if body.status == "In Progress":  # from Queued
        await refresh_blocked_flag(db, task)
        if task.is_blocked:
            titles = await blocking_titles(db, task)
            raise HTTPException(
                422,
                detail={
                    "code": "TASK_BLOCKED",
                    "message": f"Task is waiting on: {', '.join(titles)}",
                },
            )
        if not task.started_at:
            task.started_at = now
        task.status = "In Progress"

    elif body.status == "Pending Review":
        task.status = "Pending Review"
        task.submitted_at = now
        await notify(
            db,
            type_="marked_complete",
            actor_id=user.id,
            task=task,
            message=f'{user.name} submitted "{task.title}" for review',
            target_user_ids=[task.assigner_id],
        )

    elif body.status == "Closed":
        task.status = "Closed"
        task.closed_at = now
        await notify(
            db,
            type_="task_closed",
            actor_id=user.id,
            task=task,
            message=f'{user.name} closed "{task.title}"',
            target_user_ids=[task.assignee_id],
        )

    await db.commit()
    full = await _full_task(db, task.id)
    return await serializers.to_detail(db, full)
