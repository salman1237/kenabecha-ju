import json
import uuid
from collections.abc import AsyncIterator
from decimal import Decimal, InvalidOperation

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.llm import get_openai_client
from app.core.config import get_settings
from app.models.listing import Condition
from app.schemas.assistant import AssistantTurnIn
from app.schemas.listing import ListingOut
from app.services import category_service, listing_service

#: Hard caps, not spec'd exactly — bound worst-case latency/cost per request
#: and keep the chat panel from being flooded with cards. Easy to retune
#: later without touching the loop logic.
MAX_SEARCH_RESULTS = 8
MAX_TOOL_ITERATIONS = 6

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_listings",
            "description": (
                "Search the real, currently active marketplace catalog. "
                "Only listings this returns may ever be mentioned or "
                "recommended to the visitor."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "q": {"type": "string", "description": "Free-text keyword search over title/description/tags."},
                    "category_slug": {"type": "string", "description": "Restrict to one category, from get_categories."},
                    "min_price": {"type": "number"},
                    "max_price": {"type": "number"},
                    "condition": {
                        "type": "string",
                        "enum": [c.value for c in Condition],
                    },
                    "sort": {
                        "type": "string",
                        "enum": ["newest", "price_asc", "price_desc", "popular"],
                    },
                    "limit": {"type": "integer", "description": f"Max {MAX_SEARCH_RESULTS}."},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_categories",
            "description": "List the marketplace's real category taxonomy.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "recommend_listings",
            "description": (
                "Declare the final set of listings to show the visitor, once "
                "you're done searching and ready to answer. Only ids that "
                "came back from search_listings in this conversation are "
                "ever actually shown — call this with exactly those ids, "
                "not ones you merely mentioned in prose."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "listing_ids": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["listing_ids"],
            },
        },
    },
]

_LOCALE_NAMES = {"en": "English", "bn": "Bangla (বাংলা)"}


def _system_message(system_prompt: str, locale: str) -> dict:
    language = _LOCALE_NAMES.get(locale, "English")
    return {
        "role": "system",
        "content": (
            f"{system_prompt}\n\n"
            f"Reply in {language}, matching the visitor's own message language if "
            "they code-switch. Only ever mention or describe listings that came "
            "back from a search_listings call in this conversation — never invent "
            "a listing, price, id, or seller. The moment your reply names or "
            "describes specific listings from a search, call recommend_listings "
            "with their ids in that same turn — do not ask the visitor for "
            "permission first, they can't see anything until you do. If you "
            "genuinely have nothing to recommend, call it with an empty list.\n\n"
            "Visitors search in English, Bangla, Banglish, or a mix, and often "
            "use colloquial or regional names for things (e.g. \"gorur mangso\" "
            "or \"গরুর মাংস\" for beef, \"morog\"/\"মুরগি\" for chicken). The "
            "catalog itself is only ever searched in whatever text sellers typed "
            "— it will not match a Bangla or Banglish query against an English "
            "listing title by itself. If your first search_listings call comes "
            "back empty, do not immediately conclude nothing exists: try again "
            "with the likely English translation or a shorter/broader keyword "
            "before telling the visitor there's nothing available."
        ),
    }


async def _run_search_listings(db: AsyncSession, args: dict) -> tuple[list[dict], list[str]]:
    limit = min(int(args.get("limit") or MAX_SEARCH_RESULTS), MAX_SEARCH_RESULTS)
    condition = None
    if args.get("condition") in {c.value for c in Condition}:
        condition = Condition(args["condition"])

    def _price(key: str) -> Decimal | None:
        value = args.get(key)
        if value is None:
            return None
        try:
            return Decimal(str(value))
        except InvalidOperation:
            return None

    filters = listing_service.BrowseFilters(
        q=args.get("q") or None,
        category_slug=args.get("category_slug") or None,
        min_price=_price("min_price"),
        max_price=_price("max_price"),
        condition=condition,
        sort=args.get("sort") or "newest",
        limit=limit,
    )
    listings, _total = await listing_service.browse_listings(db, filters)
    ids = [str(listing.id) for listing in listings]
    # A trimmed shape for the model's own reasoning — it recommends by id via
    # recommend_listings, it doesn't need the full ListingOut payload.
    results = [
        {
            "id": str(listing.id),
            "title": listing.title,
            "price": str(listing.price) if listing.price is not None else None,
            "condition": listing.condition.value,
        }
        for listing in listings
    ]
    return results, ids


async def _run_get_categories(db: AsyncSession) -> list[dict]:
    tree = await category_service.list_tree(db, active_only=True)
    flat: list[dict] = []
    for parent in tree:
        flat.append({"slug": parent["slug"], "name": parent["name"]})
        for child in parent["children"]:
            flat.append({"slug": child["slug"], "name": child["name"]})
    return flat


async def run_assistant(
    db: AsyncSession,
    *,
    message: str,
    history: list[AssistantTurnIn],
    locale: str,
    system_prompt: str,
) -> AsyncIterator[dict]:
    settings = get_settings()

    messages: list[dict] = [_system_message(system_prompt, locale)]
    messages.extend({"role": turn.role, "content": turn.content} for turn in history)
    messages.append({"role": "user", "content": message})

    seen_listing_ids: set[str] = set()
    recommended_ids: list[str] = []

    try:
        # Constructing the client can itself raise (e.g. a missing/blank
        # OPENAI_API_KEY fails fast here rather than at the first request) —
        # kept inside the try so that failure becomes a graceful `error`
        # event too, not a response that silently ends with no body.
        client = get_openai_client()
        for _ in range(MAX_TOOL_ITERATIONS):
            stream = await client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=messages,
                tools=TOOLS,
                stream=True,
            )

            content_parts: list[str] = []
            # Streamed tool-call fragments arrive keyed by index; `arguments`
            # is a string built up incrementally across chunks.
            tool_calls: dict[int, dict] = {}
            finish_reason: str | None = None

            async for chunk in stream:
                choice = chunk.choices[0]
                delta = choice.delta
                if choice.finish_reason:
                    finish_reason = choice.finish_reason
                if delta.content:
                    content_parts.append(delta.content)
                    yield {"type": "delta", "text": delta.content}
                if delta.tool_calls:
                    for tc in delta.tool_calls:
                        slot = tool_calls.setdefault(
                            tc.index, {"id": None, "name": None, "arguments": ""}
                        )
                        if tc.id:
                            slot["id"] = tc.id
                        if tc.function and tc.function.name:
                            slot["name"] = tc.function.name
                        if tc.function and tc.function.arguments:
                            slot["arguments"] += tc.function.arguments

            if finish_reason != "tool_calls" or not tool_calls:
                break

            assistant_message: dict = {
                "role": "assistant",
                "content": "".join(content_parts) or None,
                "tool_calls": [
                    {
                        "id": call["id"],
                        "type": "function",
                        "function": {"name": call["name"], "arguments": call["arguments"]},
                    }
                    for call in tool_calls.values()
                ],
            }
            messages.append(assistant_message)

            for call in tool_calls.values():
                try:
                    args = json.loads(call["arguments"] or "{}")
                except json.JSONDecodeError:
                    args = {}

                if call["name"] == "search_listings":
                    results, ids = await _run_search_listings(db, args)
                    seen_listing_ids.update(ids)
                    tool_result: object = results
                elif call["name"] == "get_categories":
                    tool_result = await _run_get_categories(db)
                elif call["name"] == "recommend_listings":
                    recommended_ids = [
                        str(i) for i in args.get("listing_ids", []) if isinstance(i, str)
                    ]
                    tool_result = {"ok": True}
                else:
                    tool_result = {"error": f"unknown tool {call['name']}"}

                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": call["id"],
                        "content": json.dumps(tool_result),
                    }
                )
    except Exception as exc:  # noqa: BLE001 - surfaced to the client, not raised
        yield {"type": "error", "message": str(exc)}
        return

    # Structural "never invent a listing" guarantee: only ids that actually
    # came back from a real search this request are ever shown, regardless
    # of what the model claims in recommend_listings.
    final_ids: list[str] = []
    for raw_id in recommended_ids:
        if raw_id not in seen_listing_ids:
            continue
        try:
            uuid.UUID(raw_id)
        except ValueError:
            continue
        if raw_id not in final_ids:
            final_ids.append(raw_id)

    listings = await listing_service.get_by_ids(db, [uuid.UUID(i) for i in final_ids])
    by_id = {str(listing.id): listing for listing in listings}
    ordered = [by_id[i] for i in final_ids if i in by_id]

    yield {
        "type": "listings",
        "listings": [
            ListingOut.model_validate(listing).model_dump(mode="json") for listing in ordered
        ],
    }
