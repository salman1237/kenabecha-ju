from typing import Literal

from pydantic import BaseModel, Field


class AssistantTurnIn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class AssistantChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    # Server-side backstop for "last 10 turns" — the client is trusted to
    # already trim, but a hand-crafted longer payload is refused rather than
    # silently truncated.
    history: list[AssistantTurnIn] = Field(default_factory=list, max_length=10)
    locale: Literal["en", "bn"] = "en"
