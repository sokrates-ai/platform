import logging
import os


async def create_logs_dir():
    if not os.path.exists("logs"):
        os.mkdir("logs")

# Initiate logging
async def init_logging():
    await create_logs_dir()

    # Logging
    level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%d-%b-%y %H:%M:%S",
        handlers=[
            logging.FileHandler("logs/learnhouse.log"),
            logging.StreamHandler()
        ]
    )

    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    for handler in root_logger.handlers:
        handler.setLevel(level)

    sqlalchemy_level_name = os.getenv("SQLALCHEMY_LOG_LEVEL", "WARNING").upper()
    sqlalchemy_level = getattr(logging, sqlalchemy_level_name, logging.WARNING)
    logging.getLogger('sqlalchemy.engine').setLevel(sqlalchemy_level)
    logging.getLogger('uvicorn').setLevel(level)
    logging.getLogger('uvicorn.error').setLevel(level)
    logging.getLogger('uvicorn.access').setLevel(level)
    logging.getLogger('src.services.invlectrooms').setLevel(level)
    logging.getLogger('src.services.invlectrooms.converter').setLevel(level)

    logging.info("Logging initiated (level=%s)", level_name)
