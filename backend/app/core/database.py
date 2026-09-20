from sqlalchemy import event
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.config import settings

if settings.is_sqlite:
    # Modo autocontenido: api y worker comparten el archivo desde procesos
    # distintos, así que WAL + espera ante bloqueo son obligatorios.
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
        connect_args={"timeout": 30},
    )

    @event.listens_for(engine.sync_engine, "connect")
    def _sqlite_pragmas(dbapi_connection, _record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=30000")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
else:
    engine = create_async_engine(
        settings.DATABASE_URL,
        pool_size=10,
        max_overflow=20,
        # Postgres gestionado corta conexiones inactivas; reciclar y verificar
        # evita que el worker muera tras un rato sin trabajo.
        pool_pre_ping=True,
        pool_recycle=300,
        echo=False,
    )

SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncSession:
    async with SessionLocal() as session:
        yield session
