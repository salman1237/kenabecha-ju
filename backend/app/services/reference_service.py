import re
from datetime import UTC, datetime

JU_FOUNDING_YEAR = 1970
EARLIEST_SESSION_START_YEAR = 1971

SESSION_PATTERN = re.compile(r"^(?P<start>\d{4})-(?P<end_suffix>\d{2})$")


def parse_session_start_year(session: str) -> int:
    """Validates the 'YYYY-YY' session format and returns the start year.

    Raises ValueError if the format is malformed or the two halves aren't
    consecutive years (e.g. "2020-21" is valid, "2020-23" is not).
    """
    match = SESSION_PATTERN.match(session)
    if not match:
        raise ValueError("Session must be in 'YYYY-YY' format, e.g. '2020-21'")

    start_year = int(match.group("start"))
    expected_end_suffix = f"{(start_year + 1) % 100:02d}"
    if match.group("end_suffix") != expected_end_suffix:
        raise ValueError(f"'{session}' is not a valid consecutive session, e.g. use '{start_year}-{expected_end_suffix}'")

    return start_year


def compute_batch(session: str) -> int:
    start_year = parse_session_start_year(session)
    return start_year - JU_FOUNDING_YEAR


def list_session_options() -> list[dict]:
    current_year = datetime.now(UTC).year
    options = []
    for start_year in range(EARLIEST_SESSION_START_YEAR, current_year + 1):
        session = f"{start_year}-{(start_year + 1) % 100:02d}"
        options.append({"session": session, "batch": start_year - JU_FOUNDING_YEAR})
    return list(reversed(options))
