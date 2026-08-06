"""Machine-readable error codes alongside human-readable detail.

The API's `detail` strings are English. Rather than translating them
server-side — which would mean threading a locale through every service and
keeping two copies of every message in the backend — responses carry a
stable `code` that the frontend maps to its own translations.

Deliberately additive: plain `HTTPException` keeps working and simply has no
`code`, and the frontend falls back to the server's `detail` whenever a code
is missing or unrecognised. So this can be adopted one raise-site at a time
without a flag day, and a code the frontend doesn't know yet degrades to the
English message rather than to a blank error.
"""

from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse


class ErrorCode:
    """Codes the frontend has translations for. Keep in sync with the
    `errors` block in frontend/messages/en.ts."""

    INVALID_CREDENTIALS = "invalid_credentials"
    EMAIL_NOT_VERIFIED = "email_not_verified"
    EMAIL_TAKEN = "email_taken"
    NOT_A_JU_EMAIL = "not_a_ju_email"
    RATE_LIMITED = "rate_limited"
    UNAUTHORIZED = "unauthorized"
    FORBIDDEN = "forbidden"
    NOT_FOUND = "not_found"
    LISTING_NOT_FOUND = "listing_not_found"
    SHOP_NOT_FOUND = "shop_not_found"
    USER_NOT_FOUND = "user_not_found"
    UNKNOWN_CATEGORY = "unknown_category"
    LISTING_UNAVAILABLE = "listing_unavailable"
    CANNOT_MESSAGE_SELF = "cannot_message_self"
    INVALID_TOKEN = "invalid_token"
    FILE_TOO_LARGE = "file_too_large"
    UNSUPPORTED_IMAGE = "unsupported_image"


class AppError(HTTPException):
    def __init__(self, status_code: int, code: str, detail: str) -> None:
        super().__init__(status_code=status_code, detail=detail)
        self.code = code


async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "code": exc.code},
        headers=exc.headers,
    )


def not_found(what: str, code: str = ErrorCode.NOT_FOUND) -> AppError:
    return AppError(status.HTTP_404_NOT_FOUND, code, f"{what} not found")
