import logging
import os
from contextlib import contextmanager

import sqlalchemy as sa
from alembic import command
from alembic.config import Config as AlembicConfig
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.schema import CreateColumn
from sqlmodel import SQLModel

logger = logging.getLogger(__name__)

# Serializes schema changes when multiple workers boot at the same time.
_MIGRATION_LOCK_KEY = 0x6C6E4D47  # "lnMG"

_API_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)


def _alembic_config(engine: Engine) -> AlembicConfig:
    cfg = AlembicConfig(os.path.join(_API_ROOT, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(_API_ROOT, "migrations"))
    url = engine.url.render_as_string(hide_password=False)
    # configparser interpolation requires literal % to be escaped.
    cfg.set_main_option("sqlalchemy.url", url.replace("%", "%%"))
    # env.py prefers this over the application config, so the migrations
    # always run against the engine we were handed.
    cfg.attributes["sqlalchemy_url"] = url
    return cfg


@contextmanager
def schema_lock(engine: Engine):
    """
    Serialize schema-touching startup work across worker processes.

    Uvicorn runs several workers, all of which boot at once and all of which
    want to reconcile the schema. On Postgres this takes an advisory lock so
    only one of them does it at a time; other backends are left alone.
    """
    if engine.dialect.name != "postgresql":
        yield
        return

    with engine.connect() as lock_conn:
        lock_conn.execute(
            text("SELECT pg_advisory_lock(:key)"), {"key": _MIGRATION_LOCK_KEY}
        )
        try:
            yield
        finally:
            lock_conn.execute(
                text("SELECT pg_advisory_unlock(:key)"),
                {"key": _MIGRATION_LOCK_KEY},
            )


def run_database_migrations(engine: Engine) -> None:
    """
    Bring the database schema up to date on startup.

    Databases that were never touched by alembic (historically the schema was
    maintained by create_all only) are reconciled against the current models
    and stamped, so later deploys apply migrations incrementally.
    """
    if engine.dialect.name != "postgresql":
        SQLModel.metadata.create_all(engine)
        return

    with schema_lock(engine):
        _migrate(engine)


def _migrate(engine: Engine) -> None:
    cfg = _alembic_config(engine)
    if inspect(engine).has_table("alembic_version"):
        logger.info("[DB] Applying alembic migrations")
        command.upgrade(cfg, "heads")
        # Tables added to the models without a migration still get created.
        SQLModel.metadata.create_all(engine)
        _add_missing_columns(engine)
    else:
        logger.info(
            "[DB] No alembic_version table found - baselining existing schema"
        )
        SQLModel.metadata.create_all(engine)
        _add_missing_columns(engine)
        command.stamp(cfg, "heads")


def _add_missing_columns(engine: Engine) -> None:
    """
    Add model columns that are missing from existing tables.

    create_all never alters existing tables, so long-lived databases drift
    whenever a model gains a field. Only additive, safe changes are made:
    NOT NULL columns without a server default are skipped with a warning
    since they need a hand-written migration.
    """
    inspector = inspect(engine)
    with engine.begin() as conn:
        for table in SQLModel.metadata.sorted_tables:
            if not inspector.has_table(table.name):
                continue
            existing = {col["name"] for col in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name in existing:
                    continue
                if not column.nullable and column.server_default is None:
                    logger.warning(
                        "[DB] Cannot auto-add NOT NULL column %s.%s without a "
                        "server default - write a migration for it",
                        table.name,
                        column.name,
                    )
                    continue
                if isinstance(column.type, sa.Enum):
                    column.type.create(conn, checkfirst=True)
                ddl = CreateColumn(column).compile(dialect=engine.dialect)
                conn.execute(
                    text(f'ALTER TABLE "{table.name}" ADD COLUMN {ddl}')
                )
                logger.info(
                    "[DB] Added missing column %s.%s", table.name, column.name
                )
