from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token
from app.models.user import User
from app.schemas.user import UserLogin, UserRead, UserRegister
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_session_cookie(response: Response, user: User) -> None:
    """Issue the JWT in an HttpOnly cookie — unreadable by JS, immune to XSS theft."""
    token = create_access_token(user.id)
    response.set_cookie(
        key=settings.COOKIE_NAME,
        value=token,
        httponly=True,
        samesite=settings.COOKIE_SAMESITE,
        secure=settings.COOKIE_SECURE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(
    data: UserRegister,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    try:
        user = await auth_service.register_user(db, data)
    except auth_service.EmailAlreadyExists:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una cuenta con ese correo",
        )
    _set_session_cookie(response, user)
    return UserRead.model_validate(user)


@router.post("/login", response_model=UserRead)
async def login(
    data: UserLogin,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    user = await auth_service.authenticate_user(db, data.email, data.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos",
        )
    _set_session_cookie(response, user)
    return UserRead.model_validate(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response):
    # Match the attributes used when setting it, or the browser won't clear it.
    response.delete_cookie(
        key=settings.COOKIE_NAME,
        path="/",
        samesite=settings.COOKIE_SAMESITE,
        secure=settings.COOKIE_SECURE,
        httponly=True,
    )


@router.get("/me", response_model=UserRead)
async def me(user: User = Depends(get_current_user)):
    return UserRead.model_validate(user)
