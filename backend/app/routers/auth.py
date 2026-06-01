import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import RefreshToken, User
from app.schemas.auth import (
    FcmTokenRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenPair,
    UpdateProfileRequest,
)
from app.schemas.user import UserOut
from app.utils.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_token,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


async def _issue_tokens(db: AsyncSession, user: User) -> TokenPair:
    access = create_access_token(user.id, user.email, user.role)
    refresh, expires = create_refresh_token(user.id)
    db.add(
        RefreshToken(
            user_id=user.id, token_hash=hash_token(refresh), expires_at=expires
        )
    )
    await db.commit()
    return TokenPair(access_token=access, refresh_token=refresh)


@router.post("/register", response_model=TokenPair, status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.scalar(select(User).where(User.email == body.email))
    if existing:
        raise HTTPException(
            status_code=409,
            detail={"code": "EMAIL_TAKEN", "message": "Email already registered."},
        )
    user = User(
        name=body.name,
        email=body.email,
        password_hash=hash_password(body.password),
        role=body.role,
    )
    db.add(user)
    await db.flush()
    return await _issue_tokens(db, user)


@router.post("/login", response_model=TokenPair)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(
        select(User).where(User.email == body.email, User.deleted_at.is_(None))
    )
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=401,
            detail={"code": "INVALID_CREDENTIALS", "message": "Invalid email or password."},
        )
    user.last_login_at = datetime.now(timezone.utc)
    return await _issue_tokens(db, user)


@router.post("/refresh", response_model=TokenPair)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=401, detail={"code": "INVALID_TOKEN", "message": "Invalid refresh token."}
        )
    stored = await db.scalar(
        select(RefreshToken).where(
            RefreshToken.token_hash == hash_token(body.refresh_token)
        )
    )
    now = datetime.now(timezone.utc)
    expires = stored.expires_at if stored else None
    if expires is not None and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if not stored or stored.revoked or expires < now:
        raise HTTPException(
            status_code=401,
            detail={"code": "TOKEN_REVOKED", "message": "Refresh token is invalid or expired."},
        )
    user = await db.scalar(select(User).where(User.id == stored.user_id))
    if not user:
        raise HTTPException(status_code=401, detail={"code": "INVALID_TOKEN", "message": "User gone."})
    # rotate
    stored.revoked = True
    return await _issue_tokens(db, user)


@router.post("/logout", status_code=204)
async def logout(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    stored = await db.scalar(
        select(RefreshToken).where(
            RefreshToken.token_hash == hash_token(body.refresh_token)
        )
    )
    if stored:
        stored.revoked = True
        await db.commit()
    return None


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return user


@router.patch("/me", response_model=UserOut)
async def update_me(
    body: UpdateProfileRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.name is not None:
        user.name = body.name
    if body.timezone is not None:
        user.timezone = body.timezone
    if body.password is not None:
        user.password_hash = hash_password(body.password)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/me/fcm-token", status_code=204)
async def set_fcm_token(
    body: FcmTokenRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user.fcm_token = body.fcm_token
    await db.commit()
    return None
