import json
import logging
import sys
from contextvars import ContextVar

from app.core.config import get_settings

# Set per request by the middleware, read by the formatter. A ContextVar
# rather than a parameter because logging happens deep inside services that
# have no reason to know about HTTP.
request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)

# Attributes LogRecord always carries; anything else was passed as `extra`
# and is worth emitting.
_STANDARD = frozenset(
    logging.LogRecord("", 0, "", 0, "", (), None).__dict__
) | {"message", "asctime", "taskName"}


class JsonFormatter(logging.Formatter):
    """One JSON object per line.

    Production logs go to stdout and are read by whatever collects container
    output. Human-formatted lines are fine to read directly but cannot be
    filtered or searched by field, and a traceback spread over twenty lines
    is twenty unrelated entries to a collector. JSON keeps an event on one
    line and keeps the request id attached to it.
    """

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        request_id = request_id_var.get()
        if request_id:
            payload["request_id"] = request_id

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        # Anything passed via logger.info("...", extra={"listing_id": ...})
        for key, value in record.__dict__.items():
            if key not in _STANDARD and not key.startswith("_"):
                payload[key] = value

        return json.dumps(payload, default=str)


def setup_logging() -> None:
    """JSON in production, readable text everywhere else.

    Development keeps the human format on purpose: JSON in a terminal you're
    watching is worse for the person reading it, and the trade-off only pays
    off once something else is doing the reading.
    """
    settings = get_settings()
    handler = logging.StreamHandler(sys.stdout)

    if settings.ENV == "production":
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter("%(levelname)-8s %(name)s: %(message)s")
        )

    root = logging.getLogger()
    # Replace rather than add: uvicorn and a re-entrant call would otherwise
    # leave two handlers attached and every line duplicated.
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(logging.INFO)

    # uvicorn installs its own handlers; let them propagate to ours instead
    # so access logs are formatted the same way as everything else.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        logger = logging.getLogger(name)
        logger.handlers.clear()
        logger.propagate = True
