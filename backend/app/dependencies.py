import uuid

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Task, User
from app.utils.security import decode_token


def _unauthorized(msg: str = "Not authenticated") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"code": "UNAUTHENTICATED", "message": msg},
        headers={"WWW-Authenticate": "Bearer"},
    )


def _forbidden(msg: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"code": "FORBIDDEN", "message": msg},
    )


async def get_current_user(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise _unauthorized()
    token = authorization.split(" ", 1)[1].strip()
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise _unauthorized("Invalid or expired token")
    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        raise _unauthorized("Malformed token")

    user = await db.scalar(
        select(User).where(User.id == user_id, User.deleted_at.is_(None))
    )
    if not user or not user.is_active:
        raise _unauthorized("User not found or inactive")
    return user


def require_role(*roles: str):
    async def _guard(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise _forbidden(f"Requires role: {', '.join(roles)}")
        return user

    return _guard


async def get_task_or_404(task_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> Task:
    task = await db.scalar(
        select(Task).where(Task.id == task_id, Task.deleted_at.is_(None))
    )
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "TASK_NOT_FOUND", "message": "Task not found."},
        )
    return task


async def require_task_assigner(
    task: Task = Depends(get_task_or_404),
    user: User = Depends(get_current_user),
) -> Task:
    if user.role != "Assigner" or task.assigner_id != user.id:
        raise _forbidden("Only the assigner who created this task may perform this action.")
    return task


async def require_task_assignee(
    task: Task = Depends(get_task_or_404),
    user: User = Depends(get_current_user),
) -> Task:
    if task.assignee_id != user.id:
        raise _forbidden("Only the assigned assignee may perform this action.")
    return task
