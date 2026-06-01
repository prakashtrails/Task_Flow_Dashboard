from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class PageMeta(BaseModel):
    page: int
    per_page: int
    total: int


class Page(BaseModel, Generic[T]):
    data: list[T]
    meta: PageMeta


class ErrorBody(BaseModel):
    code: str
    message: str
    details: dict = {}


class ErrorResponse(BaseModel):
    error: ErrorBody
