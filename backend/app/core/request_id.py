import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.logging import request_id_var

HEADER = "X-Request-ID"


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Tags every log line produced while handling a request.

    Without this, a user reporting "it failed around 3pm" leaves you grepping
    a shared log by timestamp and guessing which lines belong together — and
    with four uvicorn workers interleaving output, guessing is all it is.

    An inbound `X-Request-ID` is honoured so a proxy's id carries through
    rather than being replaced; the id is echoed back on the response so the
    value in a user's network tab matches the value in the logs.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        incoming = request.headers.get(HEADER)
        request_id = incoming or uuid.uuid4().hex[:16]
        token = request_id_var.set(request_id)
        try:
            response = await call_next(request)
        finally:
            # Reset even when the handler raised, or the id leaks into the
            # next request served by this worker.
            request_id_var.reset(token)
        response.headers[HEADER] = request_id
        return response
