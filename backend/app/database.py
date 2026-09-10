"""SQLite + SQLAlchemy session management."""
from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings


class Base(DeclarativeBase):
    pass


settings.ensure_dirs()

_connect_args = {}
if settings.database_url.startswith("sqlite"):
    # The worker pool touches the DB from background threads.
    _connect_args = {"check_same_thread": False, "timeout": 30}

engine = create_engine(
    settings.database_url,
    connect_args=_connect_args,
    pool_pre_ping=True,
    future=True,
)


if settings.database_url.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_connection, _record):  # pragma: no cover - driver hook
        cursor = dbapi_connection.cursor()
        # WAL lets the API read while a worker writes.
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)


def init_db() -> None:
    from . import models  # noqa: F401  (registers mappers)

    Base.metadata.create_all(bind=engine)
    _add_missing_columns()


def _add_missing_columns() -> None:
    """Add columns that exist on the models but not yet in the database.

    There is no migration framework here, and jobs are ephemeral - but someone
    who pulls a new version should not be met with a crash on a table they
    already have. SQLite `ALTER TABLE ADD COLUMN` is cheap and safe.
    """
    from sqlalchemy import inspect, text

    if not settings.database_url.startswith("sqlite"):
        return

    inspector = inspect(engine)
    with engine.begin() as connection:
        for table in Base.metadata.sorted_tables:
            if table.name not in inspector.get_table_names():
                continue
            existing = {col["name"] for col in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name in existing:
                    continue
                ddl_type = column.type.compile(engine.dialect)
                default = column.default.arg if column.default is not None else None
                clause = f'ALTER TABLE {table.name} ADD COLUMN "{column.name}" {ddl_type}'
                if isinstance(default, (str, int, float)):
                    literal = f"'{default}'" if isinstance(default, str) else str(default)
                    clause += f" DEFAULT {literal}"
                connection.execute(text(clause))


@contextmanager
def session_scope() -> Iterator[Session]:
    """Transactional scope for background workers."""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_db() -> Iterator[Session]:
    """FastAPI dependency."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
