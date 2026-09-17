import json
import uuid
from collections.abc import AsyncIterator
from decimal import Decimal, InvalidOperation

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.llm import get_openai_client
from app.core.config import get_settings
from app.models.listing import Condition, Listing
from app.models.shop import Shop
from app.schemas.assistant import AssistantTurnIn
from app.schemas.listing import ListingOut
from app.schemas.shop import ShopOut
from app.services import category_service, listing_service, rating_service, shop_service

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
            "name": "search_shops",
            "description": (
                "Search real, currently active seller-run shops by name, "
                "type, or description — not products. Use this when the "
                "visitor names a shop directly (e.g. \"deshlet\", \"is "
                "there a coffee shop\"), asks what shops exist, or wants "
                "to browse a seller rather than find one specific item. "
                "Only shops this returns may ever be mentioned."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "q": {"type": "string", "description": "Free-text over shop name/description."},
                    "limit": {"type": "integer", "description": f"Max {MAX_SEARCH_RESULTS}."},
                },
            },
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
    {
        "type": "function",
        "function": {
            "name": "recommend_shops",
            "description": (
                "Declare the final set of shops to show the visitor, "
                "exactly like recommend_listings but for shops found via "
                "search_shops. Only ids that came back from search_shops "
                "in this conversation are ever actually shown."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "shop_ids": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["shop_ids"],
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
            "The same rule applies to shops via search_shops/recommend_shops: "
            "never claim a shop does or doesn't exist without searching for it "
            "first. If a visitor's message reads as a shop name or a request to "
            "browse shops rather than find one product, search_shops before (or "
            "instead of) search_listings — a bare name like \"deshlet\" is "
            "almost always someone looking for that shop, not a product called "
            "that.\n\n"
            "Visitors search in English, Bangla, Banglish, or a mix, and often "
            "use colloquial or regional names for things (e.g. \"gorur mangso\" "
            "or \"গরুর মাংস\" for beef, \"morog\"/\"মুরগি\" for chicken, "
            "\"khashi\"/\"chagol\"/\"খাসি\"/\"ছাগল\" for goat — and in Bangladeshi "
            "usage \"mutton\" on a listing almost always means goat meat, not "
            "sheep, so a goat query should also try \"mutton\" as a search term). "
            "The catalog itself is only ever searched in whatever text sellers "
            "typed — it will not match a Bangla or Banglish query against an "
            "English listing title by itself, and a single wrong guess at the "
            "translation fails exactly like not translating at all. If your "
            "first search_listings call comes back empty, do not conclude "
            "nothing exists after one retry: try a few different plausible "
            "English terms (synonyms, regional naming, a shorter/broader "
            "keyword) across separate search_listings calls before telling the "
            "visitor there's nothing available."
        ),
    }


#: Regional-vocabulary groups where a literal search term would miss a
#: real match a JU visitor obviously means. Most notably: in Bangladeshi
#: usage "mutton" on a listing means goat meat, not sheep — the kind of
#: fact a model won't reliably recall from a prompt every time, so it's
#: enforced here instead of left to instruction-following.
SYNONYM_GROUPS: list[set[str]] = [
    {"mutton", "khashi", "chagol", "goat"},
]


def _expand_query_terms(q: str) -> list[str]:
    q_lower = q.lower()
    for group in SYNONYM_GROUPS:
        if any(term in q_lower for term in group):
            return sorted(group)
    return [q]


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

    raw_q = args.get("q") or None
    query_terms = _expand_query_terms(raw_q) if raw_q else [None]

    listings_by_id: dict[str, Listing] = {}
    for term in query_terms:
        if len(listings_by_id) >= limit:
            break
        filters = listing_service.BrowseFilters(
            q=term,
            category_slug=args.get("category_slug") or None,
            min_price=_price("min_price"),
            max_price=_price("max_price"),
            condition=condition,
            sort=args.get("sort") or "newest",
            limit=limit,
        )
        found, _total = await listing_service.browse_listings(db, filters)
        for listing in found:
            listings_by_id.setdefault(str(listing.id), listing)

    listings = list(listings_by_id.values())[:limit]
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


async def _run_search_shops(db: AsyncSession, args: dict) -> tuple[list[dict], list[str]]:
    limit = min(int(args.get("limit") or MAX_SEARCH_RESULTS), MAX_SEARCH_RESULTS)
    shops = await shop_service.list_shops(db, skip=0, limit=limit, q=args.get("q") or None)
    ids = [str(shop.id) for shop, _count in shops]
    # A trimmed shape for the model's own reasoning — same idea as
    # _run_search_listings, it recommends by id via recommend_shops, it
    # doesn't need the full ShopOut payload.
    results = [
        {
            "id": str(shop.id),
            "shop_name": shop.shop_name,
            "shop_type": shop.shop_type,
            "description": shop.description,
        }
        for shop, _count in shops
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
    seen_shop_ids: set[str] = set()
    recommended_shop_ids: list[str] = []
    # Unlike listings, most turns never touch shops at all — the "shops"
    # event (and the "no shops found" text it triggers on the frontend)
    # should only ever appear on a turn that actually called search_shops,
    # not on every turn the way the listings event does.
    shop_search_attempted = False

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
                elif call["name"] == "search_shops":
                    shop_search_attempted = True
                    shop_results, shop_ids = await _run_search_shops(db, args)
                    seen_shop_ids.update(shop_ids)
                    tool_result = shop_results
                elif call["name"] == "recommend_listings":
                    recommended_ids = [
                        str(i) for i in args.get("listing_ids", []) if isinstance(i, str)
                    ]
                    tool_result = {"ok": True}
                elif call["name"] == "recommend_shops":
                    recommended_shop_ids = [
                        str(i) for i in args.get("shop_ids", []) if isinstance(i, str)
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

    # Same structural guarantee as listings above, applied to shops — except
    # the event itself is only ever sent on a turn that actually called
    # search_shops (shop_search_attempted), unlike listings which reports
    # every turn. Most conversations never touch shops at all, and an empty
    # "shops" event on every one of those would surface a spurious "no shop
    # found" message on queries that were never about shops in the first place.
    final_shop_ids: list[str] = []
    for raw_id in recommended_shop_ids:
        if raw_id not in seen_shop_ids:
            continue
        try:
            uuid.UUID(raw_id)
        except ValueError:
            continue
        if raw_id not in final_shop_ids:
            final_shop_ids.append(raw_id)

    if shop_search_attempted:
        shop_ids = [uuid.UUID(i) for i in final_shop_ids]
        shops_result = await db.execute(select(Shop).where(Shop.id.in_(shop_ids)))
        shops_by_id = {str(shop.id): shop for shop in shops_result.scalars().all()}
        ordered_shops = [shops_by_id[i] for i in final_shop_ids if i in shops_by_id]
        ratings = await rating_service.get_shops_rating_summaries(db, [s.id for s in ordered_shops])
        followers = await shop_service.get_shops_follower_counts(db, [s.id for s in ordered_shops])

        yield {
            "type": "shops",
            "shops": [
                ShopOut.model_validate(shop)
                .model_copy(
                    update={
                        "average_rating": ratings.get(shop.id, (None, 0))[0],
                        "rating_count": ratings.get(shop.id, (None, 0))[1],
                        "follower_count": followers.get(shop.id, 0),
                    }
                )
                .model_dump(mode="json")
                for shop in ordered_shops
            ],
        }
