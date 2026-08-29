import logging
import os

import orjson
import importlib
import time
from config.config import get_learnhouse_config
from fastapi import FastAPI
from sqlalchemy import event
from sqlmodel import Session, create_engine

from src.core.events.migrations import run_database_migrations

def import_all_models():
    base_dir = 'src/db'
    base_module_path = 'src.db'

    # Recursively walk through the base directory
    for root, dirs, files in os.walk(base_dir):
        # Filter out __init__.py and non-Python files
        module_files = [f for f in files if f.endswith('.py') and f != '__init__.py']

        # Calculate the module's base path from its directory structure
        path_diff = os.path.relpath(root, base_dir)
        if path_diff == '.':
            current_module_base = base_module_path
        else:
            current_module_base = f"{base_module_path}.{path_diff.replace(os.sep, '.')}"

        # Dynamically import each module
        for file_name in module_files:
            module_name = file_name[:-3]  # Remove the '.py' extension
            full_module_path = f"{current_module_base}.{module_name}"
            print(f"[DB] Importing module: {full_module_path}")
            importlib.import_module(full_module_path)

# Import all models before creating engine
import_all_models()

learnhouse_config = get_learnhouse_config()

# Sized explicitly rather than left at SQLAlchemy's 5 + 10 default. This pool is
# per worker process, so keep the total (workers x (pool_size + max_overflow))
# comfortably under the Postgres max_connections.
_pool_size = int(os.getenv('LEARNHOUSE_DB_POOL_SIZE', '10'))
_max_overflow = int(os.getenv('LEARNHOUSE_DB_MAX_OVERFLOW', '5'))

def _json_serializer(obj) -> str:
    # SQLAlchemy hands the result to the driver as text.
    return orjson.dumps(obj).decode()


engine = create_engine(
    learnhouse_config.database_config.sql_connection_string,  # type: ignore
    echo=False,
    pool_pre_ping=True,  # type: ignore
    pool_size=_pool_size,
    max_overflow=_max_overflow,
    # Course map state and activity content live in JSON columns that run to
    # hundreds of kilobytes. Decoding them with the stdlib json module was ~28%
    # of the CPU time of a course request; orjson does the same work far faster.
    json_serializer=_json_serializer,
    json_deserializer=orjson.loads,
    # Never block a request forever waiting for a connection; failing fast turns
    # a pool shortage into a visible error instead of a silent hang.
    pool_timeout=int(os.getenv('LEARNHOUSE_DB_POOL_TIMEOUT', '10')),
    pool_recycle=int(os.getenv('LEARNHOUSE_DB_POOL_RECYCLE', '1800')),
)

slow_query_ms = float(os.getenv('SLOW_DB_QUERY_MS', '200'))


@event.listens_for(engine, 'before_cursor_execute')
def record_query_start(connection, cursor, statement, parameters, context, executemany):
    context._learnhouse_query_started = time.perf_counter()


@event.listens_for(engine, 'after_cursor_execute')
def log_slow_query(connection, cursor, statement, parameters, context, executemany):
    started_at = getattr(context, '_learnhouse_query_started', None)
    if started_at is None:
        return

    duration_ms = (time.perf_counter() - started_at) * 1000
    if duration_ms >= slow_query_ms:
        logging.getLogger(__name__).warning(
            'Slow database query',
            extra={
                'duration_ms': round(duration_ms, 2),
                'statement': ' '.join(statement.split())[:500],
            },
        )

async def connect_to_db(app: FastAPI):
    app.db_engine = engine  # type: ignore
    logging.info("LearnHouse database has been started.")
    # Bring the schema up to date once the application is actually starting.
    # Keeping this out of module import lets tests override the DB dependency
    # before use.
    run_database_migrations(engine)

def get_db_session():
    with Session(engine) as session:
        yield session

async def close_database(app: FastAPI):
    logging.info("LearnHouse has been shut down.")
    return app
