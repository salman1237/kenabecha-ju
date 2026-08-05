"""Helpers for building safe SQL search predicates from user input."""

#: Passed as the `escape=` argument to SQLAlchemy's `.ilike()`. Postgres has
#: no default LIKE escape character, so it must be stated explicitly for the
#: backslashes added by `escape_like` to mean anything.
LIKE_ESCAPE = "\\"


def escape_like(term: str) -> str:
    """Neutralize LIKE metacharacters in user-supplied search text.

    Without this, a search for `%` matches every row and `_` matches any
    single character — surprising results rather than a search. Backslash is
    escaped first; doing it later would double-escape the escapes added for
    `%` and `_`.

    Always pair with ``.ilike(pattern, escape=LIKE_ESCAPE)``.
    """
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def like_contains(term: str) -> str:
    """`%term%` with the term's metacharacters escaped."""
    return f"%{escape_like(term)}%"
