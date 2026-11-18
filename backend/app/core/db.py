from datetime import datetime, timezone

from sqlalchemy import Engine, create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import NullPool, StaticPool

from app.core.config import get_settings

_settings = get_settings()
_url = _settings.database_url
_engine_kwargs: dict = {"pool_pre_ping": True}
if _url.startswith("sqlite"):
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
    if _url in ("sqlite://", "sqlite:///:memory:"):
        _engine_kwargs["poolclass"] = StaticPool  # one shared in-memory DB (tests)
elif _settings.db_null_pool:
    _engine_kwargs["poolclass"] = NullPool

engine = create_engine(_url, **_engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def add_missing_columns(bind: Engine) -> list[str]:
    """Tiny forward-only migration: `create_all` creates tables but never adds columns to existing ones.

    New columns must be nullable or have a `server_default`. Returns the added "table.column" names.
    """
    added: list[str] = []
    insp = inspect(bind)
    with bind.begin() as conn:
        for table in Base.metadata.sorted_tables:
            if not insp.has_table(table.name):
                continue
            existing = {c["name"] for c in insp.get_columns(table.name)}
            for col in table.columns:
                if col.name in existing:
                    continue
                ddl = f'ALTER TABLE {table.name} ADD COLUMN {col.name} {col.type.compile(bind.dialect)}'
                if col.server_default is not None:
                    ddl += f" DEFAULT {col.server_default.arg.text}"
                conn.execute(text(ddl))
                added.append(f"{table.name}.{col.name}")
    return added
