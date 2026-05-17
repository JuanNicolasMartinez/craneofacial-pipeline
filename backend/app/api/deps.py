"""Shared FastAPI dependencies for authenticated routes."""
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User
from app.services import auth_service

_credentials_error = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="No autenticado",
)


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Resolve the authenticated user from the HttpOnly session cookie."""
    token = request.cookies.get(settings.COOKIE_NAME)
    if not token:
        raise _credentials_error

    user_id = decode_access_token(token)
    if user_id is None:
        raise _credentials_error

    user = await auth_service.get_user_by_id(db, user_id)
    if user is None or not user.is_active:
        raise _credentials_error

    return user
