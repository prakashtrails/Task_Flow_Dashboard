import uuid

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Task
from app.schemas.task import TaskDetail, TaskSummary
from app.schemas.user import UserOut
from app.services import task_service


async def load_task(db: AsyncSession, task_id: uuid.UUID) -> Task | None:
    """Reload a task with all relationships eagerly populated.

    `populate_existing=True` overwrites any stale identity-map copy (e.g. a
    collection that was loaded before a mutation in the same session), and the
    explicit selectinload options guarantee the relationships are fetched inside
    the async query — never lazily during serialization.
    """
    stmt = (
        select(Task)
        .where(Task.id == task_id)
        .options(
            selectinload(Task.tags),
            selectinload(Task.progress_updates),
            selectinload(Task.approval_events),
            selectinload(Task.dependencies),
        )
        .execution_options(populate_existing=True)
    )
    return await db.scalar(stmt)


def _user_out(u) -> UserOut:
    return UserOut(
        id=u.id,
        name=u.name,
        email=u.email,
        role=u.role,
        avatar=u.avatar,
        avatar_color=u.avatar_color,
        timezone=u.timezone,
    )


def _base_fields(task: Task, sub_counts: tuple[int, int] = (0, 0)) -> dict:
    return {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "priority": task.priority,
        "status": task.status,
        "assigner": _user_out(task.assigner),
        "assignee": _user_out(task.assignee),
        "due_date": task.due_date,
        "estimated_effort": float(task.estimated_effort)
        if task.estimated_effort is not None
        else None,
        "effort_unit": task.effort_unit,
        "is_blocked": task.is_blocked,
        "parent_task_id": task.parent_task_id,
        "created_at": task.created_at,
        "approved_at": task.approved_at,
        "tags": [{"name": t.name, "color": t.color} for t in task.tags],
        "depends_on_task_ids": task_service.depends_on_ids(task),
        "tat": task_service.compute_tat(task),
        "subtask_count": sub_counts[0],
        "subtask_done_count": sub_counts[1],
    }


async def _subtask_counts(db: AsyncSession, task_ids: list) -> dict:
    """Returns {parent_id: (total, done)} for the given parent ids."""
    if not task_ids:
        return {}
    done = func.sum(case((Task.status == "Done", 1), else_=0))
    rows = await db.execute(
        select(Task.parent_task_id, func.count(Task.id), done)
        .where(Task.parent_task_id.in_(task_ids), Task.deleted_at.is_(None))
        .group_by(Task.parent_task_id)
    )
    return {r[0]: (int(r[1]), int(r[2] or 0)) for r in rows.all()}


async def to_summaries(db: AsyncSession, tasks: list[Task]) -> list[TaskSummary]:
    counts = await _subtask_counts(db, [t.id for t in tasks])
    return [TaskSummary(**_base_fields(t, counts.get(t.id, (0, 0)))) for t in tasks]


async def to_detail(db: AsyncSession, task: Task) -> TaskDetail:
    counts = await _subtask_counts(db, [task.id])
    fields = _base_fields(task, counts.get(task.id, (0, 0)))
    fields.update(
        started_at=task.started_at,
        submitted_at=task.submitted_at,
        closed_at=task.closed_at,
        progress_updates=sorted(task.progress_updates, key=lambda p: p.created_at),
        approval_events=sorted(task.approval_events, key=lambda a: a.created_at),
        blocking_titles=await task_service.blocking_titles(db, task),
    )
    return TaskDetail(**fields)
