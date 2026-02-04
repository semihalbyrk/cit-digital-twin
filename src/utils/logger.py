"""Logging configuration using loguru."""

import sys
import os
from loguru import logger

from src.utils.constants import PROJECT_ROOT


def setup_logger(level: str = "INFO") -> None:
    """Configure loguru logger with console and file sinks."""
    logger.remove()

    log_dir = os.path.join(PROJECT_ROOT, "logs")
    os.makedirs(log_dir, exist_ok=True)

    fmt = (
        "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
        "<level>{level: <8}</level> | "
        "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
        "<level>{message}</level>"
    )

    logger.add(sys.stderr, format=fmt, level=level, colorize=True)
    logger.add(
        os.path.join(log_dir, "digital_twin.log"),
        format=fmt,
        level="DEBUG",
        rotation="10 MB",
        retention="7 days",
    )


setup_logger(os.getenv("LOG_LEVEL", "INFO"))
