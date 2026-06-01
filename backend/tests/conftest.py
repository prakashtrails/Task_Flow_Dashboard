import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import User
from app.utils.security import hash_password

TEST_URL = "sqlite+aiosqlite://"


@pytest_asyncio.fixture
async def db_session():
    engine = create_async_engine(
        TEST_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False)
    async with Session() as session:
        yield session, Session
    await engine.dispose()


@pytest_asyncio.fixture
async def client(db_session):
    session, Session = db_session

    async def override_get_db():
        async with Session() as s:
            yield s

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def users(db_session):
    session, _ = db_session
    pw = hash_password("password123")
    assigner = User(name="Alex Morgan", email="alex@test.dev", password_hash=pw, role="Assigner")
    assignee = User(name="Jordan Lee", email="jordan@test.dev", password_hash=pw, role="Assignee")
    session.add_all([assigner, assignee])
    await session.commit()
    await session.refresh(assigner)
    await session.refresh(assignee)
    return {"assigner": assigner, "assignee": assignee}


async def login(client: AsyncClient, email: str) -> str:
    resp = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": "password123"}
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
