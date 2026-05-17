from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env.local", extra="ignore")

    DATABASE_URL: str
    REDIS_URL: str

    # Storage: "local" stores under STORAGE_LOCAL_PATH and serves via /files/...
    # "r2" uses boto3 against Cloudflare R2 with presigned URLs.
    STORAGE_BACKEND: Literal["local", "r2"] = "local"
    STORAGE_LOCAL_PATH: str = "/app/storage"
    PUBLIC_BASE_URL: str = "http://localhost:8000"

    R2_ACCOUNT_ID: str = "dev_mock"
    R2_ACCESS_KEY_ID: str = "dev_mock"
    R2_SECRET_ACCESS_KEY: str = "dev_mock"
    R2_BUCKET_NAME: str = "craneofacial-dev"
    R2_ENDPOINT_URL: str = "https://{account}.r2.cloudflarestorage.com"

    FLAME_MODEL_PATH: str = "/app/assets/flame/generic_model.pkl"

    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    # Auth: JWT signing + cookie-based session.
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24h
    COOKIE_NAME: str = "access_token"
    COOKIE_SECURE: bool = False  # True in prod (HTTPS only)
    # "lax" for same-site dev; "none" in prod where the SPA (Vercel) and the
    # API (Railway) are on different domains — required for the cookie to ride
    # cross-site XHR. "none" demands COOKIE_SECURE=true.
    COOKIE_SAMESITE: Literal["lax", "strict", "none"] = "lax"

    @property
    def r2_endpoint(self) -> str:
        return self.R2_ENDPOINT_URL.format(account=self.R2_ACCOUNT_ID)

    @model_validator(mode="after")
    def _validate_cookie_policy(self) -> "Settings":
        # Browsers reject a SameSite=None cookie that is not also Secure.
        if self.COOKIE_SAMESITE == "none" and not self.COOKIE_SECURE:
            raise ValueError(
                "COOKIE_SAMESITE='none' requires COOKIE_SECURE=true "
                "(cross-site cookies must be sent over HTTPS)."
            )
        return self


settings = Settings()
