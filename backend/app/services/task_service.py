"""Core task business logic: TAT, status transitions, dependency resolution."""
import uuid
from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Task, TaskDependency

RESOLVED = ("Approved", "Closed")

# allowed transitions: (from, to) -> required_role_check
# 'assignee' = must be assigned assignee; 'assigner' = must be task creator
TRANSITIONS: dict[tuple[str, str], str] = {
    ("Queued", "In Progress"): "assignee",
    ("In Progress", "Pending Review"): "assignee",
    ("Pending Review", "Approved"): "assigner",
    ("Pending Review", "In Progress"): "assigner",  # request changes
    ("Approved", "Closed"): "assigner",
}


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def format_duration(seconds: float) -> str:
    seconds = max(0, int(seconds))
    days, rem = divmod(seconds, 86400)
    hours, rem = divmod(rem, 3600)
    minutes = rem // 60
    if days >= 1:
        return f"{days}d {hours}h"
    if hours >= 1:
        return f"{hours}h {minutes}m"
    return f"{minutes}m"


def compute_tat(task: Task) -> dict:
    start = _aware(task.created_at)
    end = _aware(task.approved_at) if task.approved_at else now_utc()
    secs = (end - start).total_seconds()
    today = date.today()
    is_resolved = task.status in RESOLVED
    overdue = (not is_resolved) and task.due_date < today
    days_until = (task.due_date - today).days
    due_soon = (not is_resolved) and (not overdue) and (0 <= days_until <= 1)
    tat_status = "overdue" if overdue else "due_soon" if due_soon else "on_track"
    return {
        "tat_hours": round(secs / 3600, 2),
        "tat_label": format_duration(secs),
        "is_overdue": overdue,
        "is_due_soon": due_soon,
        "tat_status": tat_status,
    }


def depends_on_ids(task: Task) -> list[uuid.UUID]:
    """Dependency ids from the (eager-loaded) relationship — for serialization."""
    return [d.depends_on_task_id for d in task.dependencies]


async def _dep_ids_from_db(db: AsyncSession, task_id: uuid.UUID) -> list[uuid.UUID]:
    rows = await db.execute(
        select(TaskDependency.depends_on_task_id).where(TaskDependency.task_id == task_id)
    )
    return [r[0] for r in rows.all()]


async def _statuses_for(db: AsyncSession, ids: list[uuid.UUID]) -> dict[uuid.UUID, str]:
    if not ids:
        return {}
    rows = await db.execute(select(Task.id, Task.status).where(Task.id.in_(ids)))
    return {row[0]: row[1] for row in rows.all()}


async def compute_blocked(db: AsyncSession, task: Task) -> bool:
    # Query the dependency table directly so this is correct even right after a
    # mutation, when the ORM relationship on `task` may be stale.
    ids = await _dep_ids_from_db(db, task.id)
    if not ids:
        return False
    statuses = await _statuses_for(db, ids)
    return any(statuses.get(i) not in RESOLVED for i in ids)


async def blocking_titles(db: AsyncSession, task: Task) -> list[str]:
    ids = await _dep_ids_from_db(db, task.id)
    if not ids:
        return []
    rows = await db.execute(
        select(Task.title).where(Task.id.in_(ids), Task.status.notin_(RESOLVED))
    )
    return [r[0] for r in rows.all()]


async def refresh_blocked_flag(db: AsyncSession, task: Task) -> None:
    task.is_blocked = await compute_blocked(db, task)


async def would_create_cycle(
    db: AsyncSession, task_id: uuid.UUID, depends_on_id: uuid.UUID
) -> bool:
    """True if making task_id depend on depends_on_id introduces a cycle.

    A cycle exists if depends_on_id already (transitively) depends on task_id.
    """
    if task_id == depends_on_id:
        return True
    visited: set[uuid.UUID] = set()
    stack = [depends_on_id]
    while stack:
        current = stack.pop()
        if current == task_id:
            return True
        if current in visited:
            continue
        visited.add(current)
        rows = await db.execute(
            select(TaskDependency.depends_on_task_id).where(
                TaskDependency.task_id == current
            )
        )
        stack.extend(r[0] for r in rows.all())
    return False


def validate_transition(task: Task, new_status: str, user) -> str:
    """Returns required-role kind, or raises 4xx HTTPException."""
    key = (task.status, new_status)
    if key not in TRANSITIONS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "INVALID_TRANSITION",
                "message": f"Cannot move task from '{task.status}' to '{new_status}'.",
            },
        )
    kind = TRANSITIONS[key]
    if kind == "assignee":
        if task.assignee_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "Only the assignee can do this."},
            )
    elif kind == "assigner":
        if user.role != "Assigner" or task.assigner_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "FORBIDDEN",
                    "message": "Only the task's assigner can do this.",
                },
            )
    return kind


async def dependents_to_unblock(
    db: AsyncSession, resolved_task_id: uuid.UUID
) -> list[Task]:
    """Tasks that depend on resolved_task_id and now have all deps resolved."""
    dep_rows = await db.execute(
        select(TaskDependency.task_id).where(
            TaskDependency.depends_on_task_id == resolved_task_id
        )
    )
    dependent_ids = [r[0] for r in dep_rows.all()]
    if not dependent_ids:
        return []

    unblocked: list[Task] = []
    for dep_id in dependent_ids:
        dep_task = await db.scalar(
            select(Task).where(Task.id == dep_id, Task.deleted_at.is_(None))
        )
        if not dep_task or dep_task.status in RESOLVED:
            continue
        was_blocked = dep_task.is_blocked
        now_blocked = await compute_blocked(db, dep_task)
        dep_task.is_blocked = now_blocked
        if was_blocked and not now_blocked:
            unblocked.append(dep_task)
    return unblocked
