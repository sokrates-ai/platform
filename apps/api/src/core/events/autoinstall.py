from sqlalchemy import create_engine
from sqlmodel import SQLModel, Session, select

from cli import install
from config.config import get_learnhouse_config
from src.core.events.migrations import schema_lock
from src.db.organizations import Organization


def auto_install():
    # Get the database session
    learnhouse_config = get_learnhouse_config()
    engine = create_engine(
        learnhouse_config.database_config.sql_connection_string, echo=False, pool_pre_ping=True  # type: ignore
    )
    # Every uvicorn worker runs this on boot, so the create_all and the
    # install-if-empty check below have to be serialized or they race each
    # other into duplicate default organizations.
    with schema_lock(engine):
        _auto_install_locked(engine)

    engine.dispose()


def _auto_install_locked(engine):
    SQLModel.metadata.create_all(engine)

    db_session = Session(engine)

    orgs = db_session.exec(select(Organization)).all()

    if len(orgs) == 0:
        print("No organizations found. Starting auto-installation 🏗️")
        install(short=True)

    if orgs: 
        for org in orgs:
            default_org = db_session.exec(select(Organization).where(Organization.slug == 'default')).first()

            if not default_org:
                print("No default organization found. Starting auto-installation 🏗️")
                install(short=True)

    else: 
        print("Organizations found. Skipping auto-installation 🚀")

            
            
