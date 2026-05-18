import logging
import platform
import sys
import uuid
from logging.handlers import RotatingFileHandler
from pathlib import Path

from ...core.constants import LOG_FILE, APP_DATA_DIR, __version__

root_logger = logging.getLogger()
logger = logging.getLogger(__name__)


class SessionIDFilter(logging.Filter):
    """Injects a unique session ID into every log record."""

    def __init__(self, session_id: str):
        super().__init__()
        self.session_id = session_id

    def filter(self, record):
        record.session_id = self.session_id
        return True


def setup_logging(log: bool | None, detailed_logging: bool = False) -> None:
    """Configures the application's logging based on CLI flags and config."""
    # Generate session UUID
    session_id = str(uuid.uuid4())
    
    # Check if detailed_logging was toggled since last run
    state_file = APP_DATA_DIR / ".log_state"
    should_empty_log = False
    
    try:
        if state_file.exists():
            last_state = state_file.read_text(encoding="utf-8").strip().lower() == "true"
            if last_state != detailed_logging:
                should_empty_log = True
        else:
            should_empty_log = True # first time
            
        state_file.write_text(str(detailed_logging).lower(), encoding="utf-8")
    except Exception as e:
        # Ignore errors writing state file, fail gracefully
        pass
        
    if should_empty_log and LOG_FILE.exists():
        try:
            LOG_FILE.write_text("")
        except Exception:
            pass

    _setup_default_logger(session_id=session_id, detailed_logging=detailed_logging)
    
    if log:
        from rich.logging import RichHandler

        root_logger.addHandler(RichHandler())
        logger.info("Rich logging initialized.")

    if detailed_logging:
        # Write the startup banner
        logger.debug("==================================================")
        logger.debug(f"STARTUP BANNER - Viu Session: {session_id}")
        logger.debug(f"App Version: {__version__}")
        logger.debug(f"Python Version: {sys.version}")
        logger.debug(f"Platform: {platform.platform()}")
        logger.debug(f"Machine: {platform.machine()}")
        logger.debug(f"Command Args: {sys.argv}")
        logger.debug("==================================================")


def _setup_default_logger(
    session_id: str,
    detailed_logging: bool,
    log_file_path: Path = LOG_FILE,
    max_bytes=10 * 1024 * 1024,  # 10mb
    backup_count=5,
):
    level = logging.DEBUG if detailed_logging else logging.INFO
    root_logger.setLevel(level)

    formatter = logging.Formatter(
        "%(asctime)s - [%(session_id)s] - [%(process)d:%(thread)d] - %(levelname)-8s - %(name)s - %(filename)s:%(lineno)d - %(message)s"
    )

    file_handler = RotatingFileHandler(
        log_file_path,
        maxBytes=max_bytes,
        backupCount=backup_count,
        encoding="utf-8",
    )
    file_handler.setLevel(level)
    file_handler.setFormatter(formatter)
    file_handler.addFilter(SessionIDFilter(session_id))
    root_logger.addHandler(file_handler)
