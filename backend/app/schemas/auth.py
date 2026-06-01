from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: str = Field(pattern="^(Assigner|Assignee)$")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class FcmTokenRequest(BaseModel):
    fcm_token: str


class UpdateProfileRequest(BaseModel):
    name: str | None = None
    timezone: str | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)
