import re

import nh3

#: What the post editor's toolbar can actually produce — bold, italic,
#: underline, and an inline style for font/color. Nothing else survives.
ALLOWED_TAGS = {"p", "br", "b", "strong", "i", "em", "u", "span"}
ALLOWED_ATTRIBUTES = {"span": {"style"}}

#: nh3 allow-lists tags/attributes but doesn't parse CSS property-by-property
#: inside a `style` value — without this a `style="color:red;background:url(evil)"`
#: attribute would pass through wholesale despite `style` being "allowed".
ALLOWED_CSS_PROPERTIES = {"font-weight", "font-style", "text-decoration", "font-family", "color", "background-color"}
_DANGEROUS_VALUE = re.compile(r"url\(|expression\(|javascript:", re.IGNORECASE)


def _clean_style(value: str) -> str:
    kept = []
    for declaration in value.split(";"):
        if ":" not in declaration:
            continue
        prop, _, val = declaration.partition(":")
        prop, val = prop.strip().lower(), val.strip()
        if prop in ALLOWED_CSS_PROPERTIES and not _DANGEROUS_VALUE.search(val):
            kept.append(f"{prop}: {val}")
    return "; ".join(kept)


def _strip_disallowed_css(html: str) -> str:
    def replace(match: re.Match[str]) -> str:
        cleaned = _clean_style(match.group(1))
        return f'style="{cleaned}"' if cleaned else ""

    return re.sub(r'style="([^"]*)"', replace, html)


def sanitize_post_html(raw: str) -> str:
    """The only path a post's rich-text description may reach storage
    through. Runs once, on write — never re-sanitized on read, and never
    called from a router directly."""
    cleaned = nh3.clean(raw, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRIBUTES)
    return _strip_disallowed_css(cleaned)
