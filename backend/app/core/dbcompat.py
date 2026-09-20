"""
Compatibilidad entre dialectos SQL.

El despliegue completo usa Postgres (ver `docs/arquitecture/DEPLOY.md`). El
modo autocontenido de un solo contenedor usa SQLite cuando no hay
`DATABASE_URL` externa (ver `docs/arquitecture/DEPLOY_FREE.md`). El esquema es
el mismo en ambos; solo cambian dos detalles de dialecto, y viven aquí para
que modelos y migraciones no los repitan.
"""
from __future__ import annotations

from datetime import timezone

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# JSONB en Postgres (indexable, binario); JSON estándar en el resto.
JSONType = sa.JSON().with_variant(
    postgresql.JSONB(astext_type=sa.Text()), "postgresql"
)


def now_default(dialect_name: str) -> sa.TextClause:
    """`server_default` para columnas de fecha de creación.

    Postgres resuelve `now()`; SQLite no conoce esa función y usa
    `CURRENT_TIMESTAMP`.
    """
    if dialect_name == "postgresql":
        return sa.text("now()")
    return sa.text("CURRENT_TIMESTAMP")


class UTCDateTime(sa.types.TypeDecorator):
    """Marca temporal siempre en UTC y siempre consciente de la zona.

    Postgres guarda `timestamptz` y devuelve el instante con zona. SQLite no
    guarda la zona: al escribir descarta el offset y al leer entrega un
    `datetime` naive. Sin normalizar, el mismo endpoint devolvería
    `...T17:23:49` en SQLite y `...T17:23:49+00:00` en Postgres, y el navegador
    interpretaría el primero como hora local.
    """

    impl = sa.DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None or dialect.name == "postgresql":
            return value
        if value.tzinfo is not None:
            # SQLite ignora el offset al formatear: lo aplicamos nosotros.
            value = value.astimezone(timezone.utc).replace(tzinfo=None)
        return value

    def process_result_value(self, value, dialect):
        if value is None or dialect.name == "postgresql":
            return value
        return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)
