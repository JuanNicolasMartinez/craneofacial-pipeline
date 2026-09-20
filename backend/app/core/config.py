import secrets
from pathlib import Path
from typing import Literal
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Nombre del archivo donde se persiste el secreto JWT autogenerado cuando el
# entorno no define JWT_SECRET_KEY (despliegue de un clic, sin configuración).
_JWT_SECRET_FILE = "jwt_secret.key"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env.local", extra="ignore")

    # Directorio de datos del modo autocontenido: SQLite, archivos subidos y
    # el secreto JWT generado. Solo se usa para rellenar los valores por
    # defecto de abajo; si el entorno define las variables, no se toca.
    DATA_DIR: str = "/app/data"

    # Vacío → SQLite dentro de DATA_DIR. Con valor → se usa tal cual, tras
    # normalizar el esquema al driver async (`postgresql+asyncpg`).
    DATABASE_URL: str = ""
    # Vacío → Redis local (el contenedor todo-en-uno arranca el suyo).
    REDIS_URL: str = ""

    # Storage: "local" stores under STORAGE_LOCAL_PATH and serves via /files/...
    # "r2" uses boto3 against Cloudflare R2 with presigned URLs.
    STORAGE_BACKEND: Literal["local", "r2"] = "local"
    STORAGE_LOCAL_PATH: str = ""  # vacío → DATA_DIR/storage
    # URL pública del api. Vacía → las URLs de archivos se emiten relativas
    # ("/files/..."), que es lo correcto cuando el SPA se sirve desde el
    # mismo origen y aún no se conoce el dominio del despliegue.
    PUBLIC_BASE_URL: str = ""

    R2_ACCOUNT_ID: str = "dev_mock"
    R2_ACCESS_KEY_ID: str = "dev_mock"
    R2_SECRET_ACCESS_KEY: str = "dev_mock"
    R2_BUCKET_NAME: str = "craneofacial-dev"
    R2_ENDPOINT_URL: str = "https://{account}.r2.cloudflarestorage.com"

    FLAME_MODEL_PATH: str = "/app/assets/flame/generic_model.pkl"

    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    # SPA: cuando el build estático del frontend viaja en la misma imagen, el
    # api lo sirve con fallback a index.html. Si el directorio no existe, el
    # api se comporta como siempre (solo API).
    SERVE_FRONTEND: bool = True
    FRONTEND_DIST_PATH: str = "/app/frontend"

    # Auth: JWT signing + cookie-based session.
    # Vacío → se genera un secreto y se persiste en DATA_DIR, para que un
    # despliegue sin variables funcione y no invalide sesiones al reiniciar.
    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24h
    COOKIE_NAME: str = "access_token"
    COOKIE_SECURE: bool = False  # True in prod (HTTPS only)
    # "lax" for same-site dev; "none" in prod where the SPA (Vercel) and the
    # API (Railway) are on different domains — required for the cookie to ride
    # cross-site XHR. "none" demands COOKIE_SECURE=true.
    COOKIE_SAMESITE: Literal["lax", "strict", "none"] = "lax"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _split_cors_origins(cls, value):
        # Las plataformas de despliegue solo permiten cadenas planas: aquí se
        # acepta tanto JSON (["https://a"]) como "https://a,https://b".
        if isinstance(value, str) and not value.strip().startswith("["):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @property
    def r2_endpoint(self) -> str:
        return self.R2_ENDPOINT_URL.format(account=self.R2_ACCOUNT_ID)

    @property
    def is_sqlite(self) -> bool:
        return self.DATABASE_URL.startswith("sqlite")

    @model_validator(mode="after")
    def _apply_selfcontained_defaults(self) -> "Settings":
        data_dir = Path(self.DATA_DIR)

        if not self.DATABASE_URL:
            data_dir.mkdir(parents=True, exist_ok=True)
            self.DATABASE_URL = f"sqlite+aiosqlite:///{data_dir / 'app.db'}"
        else:
            self.DATABASE_URL = _normalize_db_url(self.DATABASE_URL)

        if not self.REDIS_URL:
            self.REDIS_URL = "redis://127.0.0.1:6379/0"

        if not self.STORAGE_LOCAL_PATH:
            self.STORAGE_LOCAL_PATH = str(data_dir / "storage")

        if not self.JWT_SECRET_KEY:
            data_dir.mkdir(parents=True, exist_ok=True)
            self.JWT_SECRET_KEY = _load_or_create_jwt_secret(data_dir / _JWT_SECRET_FILE)

        return self

    @model_validator(mode="after")
    def _validate_cookie_policy(self) -> "Settings":
        # Browsers reject a SameSite=None cookie that is not also Secure.
        if self.COOKIE_SAMESITE == "none" and not self.COOKIE_SECURE:
            raise ValueError(
                "COOKIE_SAMESITE='none' requires COOKIE_SECURE=true "
                "(cross-site cookies must be sent over HTTPS)."
            )
        return self


def _normalize_db_url(url: str) -> str:
    """Adapta la URL que entrega el proveedor al driver async del backend.

    Postgres gestionado (Neon, Supabase, Render, Railway…) publica URLs
    `postgres://` o `postgresql://` con `?sslmode=require`; asyncpg no entiende
    ninguna de las dos cosas.
    """
    parts = urlsplit(url)
    scheme = parts.scheme

    if scheme in ("postgres", "postgresql"):
        scheme = "postgresql+asyncpg"
    elif scheme == "sqlite":
        scheme = "sqlite+aiosqlite"

    if not scheme.startswith("postgresql+asyncpg"):
        return urlunsplit((scheme, parts.netloc, parts.path, parts.query, parts.fragment))

    query: list[tuple[str, str]] = []
    for key, value in parse_qsl(parts.query, keep_blank_values=True):
        if key == "sslmode":
            # asyncpg usa `ssl`; `disable` equivale a no pedir TLS.
            if value not in ("disable", "allow", "prefer"):
                query.append(("ssl", value))
        elif key == "channel_binding":
            continue  # parámetro de libpq que asyncpg rechaza
        else:
            query.append((key, value))

    return urlunsplit((scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def _load_or_create_jwt_secret(path: Path) -> str:
    """Lee el secreto persistido o crea uno nuevo con permisos restringidos."""
    if path.is_file():
        existing = path.read_text(encoding="utf-8").strip()
        if existing:
            return existing

    secret = secrets.token_hex(32)
    path.write_text(secret, encoding="utf-8")
    path.chmod(0o600)
    return secret


settings = Settings()
