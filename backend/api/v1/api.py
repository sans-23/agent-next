from fastapi import APIRouter # type: ignore
from api.v1.endpoints import sessions, auth

api_router = APIRouter()
api_router.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
