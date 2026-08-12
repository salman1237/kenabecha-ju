"""Phase 51: the AI shopping assistant.

CI never touches real OpenAI — every test monkeypatches
`app.services.assistant_service.get_openai_client` with a fake client that
plays back a scripted sequence of streaming chunks. What's tested is the
tool-calling loop's own mechanics and the "never invent a listing"
validation boundary, never what a real model would plausibly say.
"""

import uuid
from types import SimpleNamespace

import pytest
from sqlalchemy import select

from app.models.audit import AuditAction, AuditLog
from app.models.navigation import SiteSetting
from app.services import assistant_service
from tests.conftest import login, make_listing, make_user


# --- fake OpenAI client ------------------------------------------------------


def _tool_call_delta(index, *, id=None, name=None, arguments=None):
    return SimpleNamespace(
        index=index, id=id, function=SimpleNamespace(name=name, arguments=arguments)
    )


def _chunk(*, content=None, tool_calls=None, finish_reason=None):
    delta = SimpleNamespace(content=content, tool_calls=tool_calls)
    return SimpleNamespace(choices=[SimpleNamespace(delta=delta, finish_reason=finish_reason)])


async def _fake_chunks(chunks):
    for chunk in chunks:
        yield chunk


class FakeCompletions:
    """`scripts` is one chunk-list per expected `create()` call. A call past
    the end of the list replays the last entry — used to script a runaway
    tool-call loop without an unbounded scripts list."""

    def __init__(self, scripts):
        self.scripts = scripts
        self.calls: list[dict] = []

    async def create(self, **kwargs):
        self.calls.append(kwargs)
        chunks = self.scripts[min(len(self.calls) - 1, len(self.scripts) - 1)]
        return _fake_chunks(chunks)


class FakeClient:
    def __init__(self, scripts):
        self.chat = SimpleNamespace(completions=FakeCompletions(scripts))


def _use_fake_client(monkeypatch, scripts) -> FakeClient:
    client = FakeClient(scripts)
    monkeypatch.setattr(assistant_service, "get_openai_client", lambda: client)
    return client


async def _enable_assistant(db, system_prompt: str = "test system prompt") -> None:
    db.add(SiteSetting(key="assistant", value={"enabled": True, "system_prompt": system_prompt}))
    await db.flush()


@pytest.fixture
async def admin(client, db):
    user = await make_user(db, role="admin")
    await login(client, user)
    return user


# --- the tool-calling loop ---------------------------------------------------


async def test_happy_path_streams_prose_and_recommends_the_searched_listing(db, monkeypatch):
    seller = await make_user(db)
    listing = await make_listing(db, seller, title="Vintage Desk Lamp")

    scripts = [
        # 1: model searches
        [
            _chunk(
                tool_calls=[
                    _tool_call_delta(0, id="call_1", name="search_listings", arguments='{"q": "')
                ]
            ),
            _chunk(tool_calls=[_tool_call_delta(0, arguments='lamp"}')]),
            _chunk(finish_reason="tool_calls"),
        ],
        # 2: model narrates and declares its pick
        [
            _chunk(content="Here's a "),
            _chunk(content="great match!"),
            _chunk(
                tool_calls=[
                    _tool_call_delta(
                        0,
                        id="call_2",
                        name="recommend_listings",
                        arguments=f'{{"listing_ids": ["{listing.id}"]}}',
                    )
                ]
            ),
            _chunk(finish_reason="tool_calls"),
        ],
        # 3: model wraps up with no further tool calls
        [_chunk(content="", finish_reason="stop")],
    ]
    _use_fake_client(monkeypatch, scripts)

    events = [
        event
        async for event in assistant_service.run_assistant(
            db, message="looking for a lamp", history=[], locale="en", system_prompt="be helpful"
        )
    ]

    deltas = "".join(e["text"] for e in events if e["type"] == "delta")
    assert deltas == "Here's a great match!"

    listings_events = [e for e in events if e["type"] == "listings"]
    assert len(listings_events) == 1
    assert [item["id"] for item in listings_events[0]["listings"]] == [str(listing.id)]


async def test_a_recommendation_never_searched_for_is_dropped(db, monkeypatch):
    """The core guarantee: recommend_listings is not trusted as-is. Only ids
    that actually came back from a real search_listings call this request
    are ever shown — a real listing that just wasn't searched for doesn't
    count, and neither does a fabricated or malformed id."""
    seller = await make_user(db)
    searched = await make_listing(db, seller, title="Searched Chair")
    never_searched = await make_listing(db, seller, title="Never Searched Table")
    fabricated = str(uuid.uuid4())

    scripts = [
        [
            _chunk(
                tool_calls=[
                    _tool_call_delta(
                        0, id="call_1", name="search_listings", arguments='{"q": "chair"}'
                    )
                ]
            ),
            _chunk(finish_reason="tool_calls"),
        ],
        [
            # Names the legitimately-searched listing alongside three bad
            # ids — proves the filter is selective, not that search simply
            # returned nothing.
            _chunk(
                tool_calls=[
                    _tool_call_delta(
                        0,
                        id="call_2",
                        name="recommend_listings",
                        arguments=(
                            '{"listing_ids": ["'
                            + str(searched.id)
                            + '", "'
                            + str(never_searched.id)
                            + '", "'
                            + fabricated
                            + '", "not-a-uuid"]}'
                        ),
                    )
                ]
            ),
            _chunk(finish_reason="tool_calls"),
        ],
        [_chunk(finish_reason="stop")],
    ]
    _use_fake_client(monkeypatch, scripts)

    events = [
        event
        async for event in assistant_service.run_assistant(
            db, message="a chair please", history=[], locale="en", system_prompt="be helpful"
        )
    ]

    listings_events = [e for e in events if e["type"] == "listings"]
    assert len(listings_events) == 1
    assert [item["id"] for item in listings_events[0]["listings"]] == [str(searched.id)]


async def test_no_recommend_listings_call_yields_one_empty_listings_event(db, monkeypatch):
    scripts = [[_chunk(content="Sorry, nothing like that here.", finish_reason="stop")]]
    _use_fake_client(monkeypatch, scripts)

    events = [
        event
        async for event in assistant_service.run_assistant(
            db, message="anything?", history=[], locale="en", system_prompt="be helpful"
        )
    ]

    listings_events = [e for e in events if e["type"] == "listings"]
    assert listings_events == [{"type": "listings", "listings": []}]


async def test_a_broken_openai_client_yields_an_error_event_not_a_dead_stream(db, monkeypatch):
    """Regression: constructing the client (e.g. a blank OPENAI_API_KEY) can
    itself raise, before any chunk is ever streamed. That has to become a
    graceful `error` event like any other failure — not an exception that
    escapes the generator and leaves the client with a 200 and no body."""

    def _raise():
        raise RuntimeError("Missing credentials")

    monkeypatch.setattr(assistant_service, "get_openai_client", _raise)

    events = [
        event
        async for event in assistant_service.run_assistant(
            db, message="hi", history=[], locale="en", system_prompt="be helpful"
        )
    ]

    assert events == [{"type": "error", "message": "Missing credentials"}]


async def test_a_runaway_tool_call_loop_terminates_at_the_hard_cap(db, monkeypatch):
    # Every call keeps returning another tool call, never "stop" — a single
    # scripted entry is replayed by FakeCompletions for every iteration.
    scripts = [
        [
            _chunk(tool_calls=[_tool_call_delta(0, id="call_x", name="get_categories", arguments="{}")]),
            _chunk(finish_reason="tool_calls"),
        ]
    ]
    fake = _use_fake_client(monkeypatch, scripts)

    events = [
        event
        async for event in assistant_service.run_assistant(
            db, message="hello", history=[], locale="en", system_prompt="be helpful"
        )
    ]

    assert len(fake.chat.completions.calls) == assistant_service.MAX_TOOL_ITERATIONS
    # Still ends cleanly with exactly one (empty) listings event, not a hang
    # or an unhandled exception.
    assert [e for e in events if e["type"] == "listings"] == [{"type": "listings", "listings": []}]


async def test_system_prompt_locale_and_history_are_passed_through(db, monkeypatch):
    scripts = [[_chunk(content="ok", finish_reason="stop")]]
    fake = _use_fake_client(monkeypatch, scripts)

    history = [
        {"role": "user", "content": "earlier question"},
        {"role": "assistant", "content": "earlier answer"},
    ]
    from app.schemas.assistant import AssistantTurnIn

    events = [
        event
        async for event in assistant_service.run_assistant(
            db,
            message="new question",
            history=[AssistantTurnIn(**turn) for turn in history],
            locale="bn",
            system_prompt="MY CUSTOM PROMPT",
        )
    ]
    assert events  # generator actually ran

    sent_messages = fake.chat.completions.calls[0]["messages"]
    system_message = sent_messages[0]
    assert system_message["role"] == "system"
    assert "MY CUSTOM PROMPT" in system_message["content"]
    assert "Bangla" in system_message["content"]

    assert sent_messages[1] == {"role": "user", "content": "earlier question"}
    assert sent_messages[2] == {"role": "assistant", "content": "earlier answer"}
    assert sent_messages[3] == {"role": "user", "content": "new question"}


async def test_a_regional_synonym_search_finds_the_real_listing(db, monkeypatch):
    """Regression: a visitor searching "khashi" (Bangla for goat) got nothing
    against a real "Deshi Mutton" listing, even after the model was told in
    the prompt that mutton means goat meat here — instruction-following
    wasn't reliable for this specific, well-known regional mapping, so it's
    now enforced deterministically in the search tool itself."""
    seller = await make_user(db)
    listing = await make_listing(db, seller, title="Deshi Mutton")

    scripts = [
        [
            _chunk(
                tool_calls=[
                    _tool_call_delta(
                        0, id="call_1", name="search_listings", arguments='{"q": "khashi"}'
                    )
                ]
            ),
            _chunk(finish_reason="tool_calls"),
        ],
        [
            _chunk(
                tool_calls=[
                    _tool_call_delta(
                        0,
                        id="call_2",
                        name="recommend_listings",
                        arguments=f'{{"listing_ids": ["{listing.id}"]}}',
                    )
                ]
            ),
            _chunk(finish_reason="tool_calls"),
        ],
        [_chunk(finish_reason="stop")],
    ]
    _use_fake_client(monkeypatch, scripts)

    events = [
        event
        async for event in assistant_service.run_assistant(
            db, message="khashi ache?", history=[], locale="en", system_prompt="be helpful"
        )
    ]

    listings_events = [e for e in events if e["type"] == "listings"]
    assert [item["id"] for item in listings_events[0]["listings"]] == [str(listing.id)]


# --- the endpoint: kill switch + rate limit ----------------------------------


async def test_chat_endpoint_503s_without_calling_openai_when_disabled(client, db, monkeypatch):
    called = False

    def _fail_if_called():
        nonlocal called
        called = True
        raise AssertionError("should never construct an OpenAI client while disabled")

    monkeypatch.setattr(assistant_service, "get_openai_client", _fail_if_called)

    res = await client.post("/assistant/chat", json={"message": "hi", "history": [], "locale": "en"})
    assert res.status_code == 503
    assert called is False


async def test_chat_endpoint_rate_limits_by_ip(client, db, monkeypatch):
    from app.routers import assistant as assistant_router

    await _enable_assistant(db)
    _use_fake_client(monkeypatch, [[_chunk(content="ok", finish_reason="stop")]])

    payload = {"message": "hi", "history": [], "locale": "en"}
    for _ in range(assistant_router.CHAT_RATE_LIMIT_TIMES):
        res = await client.post("/assistant/chat", json=payload)
        assert res.status_code == 200

    res = await client.post("/assistant/chat", json=payload)
    assert res.status_code == 429
    assert "Retry-After" in res.headers


# --- admin settings CRUD -----------------------------------------------------


async def test_assistant_settings_default_when_unconfigured(client, db, admin):
    res = await client.get("/admin/assistant")
    assert res.status_code == 200
    body = res.json()
    assert body["enabled"] is False
    assert len(body["system_prompt"]) > 0


async def test_assistant_settings_require_admin(client, db):
    moderator = await make_user(db, role="moderator")
    await login(client, moderator)
    assert (await client.get("/admin/assistant")).status_code == 403
    assert (await client.put("/admin/assistant", json={"enabled": True})).status_code == 403


async def test_assistant_settings_put_persists(client, db, admin):
    res = await client.put(
        "/admin/assistant", json={"enabled": True, "system_prompt": "Custom prompt text"}
    )
    assert res.status_code == 200
    assert res.json() == {"enabled": True, "system_prompt": "Custom prompt text"}

    again = await client.get("/admin/assistant")
    assert again.json() == {"enabled": True, "system_prompt": "Custom prompt text"}


async def test_assistant_settings_audit_only_logs_real_changes(client, db, admin):
    payload = {"enabled": True, "system_prompt": "Same both times"}
    await client.put("/admin/assistant", json=payload)
    await client.put("/admin/assistant", json=payload)

    rows = (
        await db.execute(
            select(AuditLog).where(AuditLog.action == AuditAction.ASSISTANT_SETTINGS_CHANGED)
        )
    ).scalars().all()
    assert len(rows) == 1
