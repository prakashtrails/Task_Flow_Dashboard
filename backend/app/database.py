from collections.abc import AsyncGenerator
from uuid import uuid4

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

# Supabase serves Postgres through PgBouncer (the "pooler" host). In transaction
# pooling mode, asyncpg's prepared-statement cache breaks because statements get
# orphaned across pooled connections. Disabling the cache + using unique statement
# names makes asyncpg safe behind any Supabase pooler mode (and is harmless on a
# direct connection). No-op for SQLite/other drivers.
_connect_args: dict = {}
if settings.DATABASE_URL.startswith("postgresql+asyncpg"):
    _connect_args = {
        "statement_cache_size": 0,
        "prepared_statement_name_func": lambda: f"__asyncpg_{uuid4()}__",
    }

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    connect_args=_connect_args,
)

SessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False, autoflush=False
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
