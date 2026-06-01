from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models import Task, User
from app.schemas.notification import MetricsDashboard, TeamWorkload, WorkloadEntry
from app.schemas.task import STATUSES
from app.schemas.user import UserOut
from app.services.task_service import RESOLVED, _aware

router = APIRouter(prefix="/metrics", tags=["metrics"])


def _user_out(u) -> UserOut:
    return UserOut(
        id=u.id, name=u.name, email=u.email, role=u.role,
        avatar=u.avatar, avatar_color=u.avatar_color, timezone=u.timezone,
    )


@router.get("/dashboard", response_model=MetricsDashboard)
async def dashboard(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    base = select(Task).where(Task.deleted_at.is_(None), Task.parent_task_id.is_(None))
    if user.role != "Assigner":
        from sqlalchemy import or_

        base = base.where(or_(Task.assignee_id == user.id, Task.assigner_id == user.id))
    tasks = (await db.scalars(base)).all()

    dist = [
        {"status": s, "count": len([t for t in tasks if t.status == s])}
        for s in STATUSES
    ]
    overdue = [t for t in tasks if t.status not in RESOLVED and t.due_date < date.today()]
    tats = [
        (_aware(t.approved_at) - _aware(t.created_at)).total_seconds() / 3600
        for t in tasks
        if t.status in RESOLVED and t.approved_at
    ]
    avg = round(sum(tats) / len(tats), 2) if tats else None

    return MetricsDashboard(
        status_distribution=dist,
        overdue_count=len(overdue),
        avg_tat_hours=avg,
        total_tasks=len(tasks),
    )


@router.get("/team-workload", response_model=TeamWorkload)
async def team_workload(
    _: User = Depends(require_role("Assigner")),
    db: AsyncSession = Depends(get_db),
):
    assignees = (
        await db.scalars(
            select(User).where(User.role == "Assignee", User.deleted_at.is_(None))
        )
    ).all()
    entries = []
    for u in assignees:
        tasks = (
            await db.scalars(
                select(Task).where(Task.assignee_id == u.id, Task.deleted_at.is_(None))
            )
        ).all()
        entries.append(
            WorkloadEntry(
                user=_user_out(u),
                in_progress=len([t for t in tasks if t.status == "In Progress"]),
                queued=len([t for t in tasks if t.status == "Queued"]),
                overdue=len(
                    [t for t in tasks if t.status not in RESOLVED and t.due_date < date.today()]
                ),
            )
        )
    return TeamWorkload(workload=entries)
