"""Derive a private on-disk memory directory from the Buzz conversation."""

from hashlib import sha256
import os
from pathlib import Path
from typing import Optional

_CHANNEL_TYPES = frozenset({"group", "channel", "thread"})


def is_buzz_platform(platform: object) -> bool:
    value = getattr(platform, "value", platform)
    return str(value or "").strip().lower() == "buzz"


def memory_scope_key(chat_type: object, chat_id: object, relay_url: str) -> Optional[str]:
    """Return a stable, non-identifying scope key for one Buzz conversation."""
    kind = str(chat_type or "").strip().lower()
    if kind == "dm":
        prefix = "dm"
    elif kind in _CHANNEL_TYPES:
        prefix = "channel"
    else:
        return None
    conversation_id = str(chat_id or "").strip()
    relay = str(relay_url or "").strip()
    if not conversation_id or not relay:
        return None
    digest = sha256(f"{relay}\0{prefix}:{conversation_id}".encode("utf-8")).hexdigest()
    return f"{prefix}-{digest}"


def memory_dir_for_chat(chat_type: object, chat_id: object, relay_url: str) -> Optional[Path]:
    """Return the scoped Buzz memory directory for a channel or DM."""
    from hermes_constants import get_hermes_home

    scope = memory_scope_key(chat_type, chat_id, relay_url)
    return get_hermes_home() / "memories" / "scoped" / scope if scope else None


def memory_dir_for_agent(agent: object, platform: object) -> Optional[Path]:
    """Return a scoped directory for Buzz, or None for Hermes' normal fallback."""
    if not is_buzz_platform(platform):
        return None
    return memory_dir_for_chat(
        getattr(agent, "_chat_type", None),
        getattr(agent, "_chat_id", None),
        os.environ.get("BUZZ_RELAY_URL", ""),
    )


def memory_prompt_for_source(platform: object, chat_type: object, chat_id: object) -> str:
    """Read the current scoped memory for a Buzz turn, bypassing session prompt snapshots."""
    if not is_buzz_platform(platform):
        return ""
    memory_dir = memory_dir_for_chat(chat_type, chat_id, os.environ.get("BUZZ_RELAY_URL", ""))
    if memory_dir is None:
        return ""
    from tools.memory_tool_store import MemoryStore

    store = MemoryStore(memory_enabled=True, user_profile_enabled=False, memory_dir=memory_dir)
    store.load_from_disk()
    return store.format_for_system_prompt("memory") or ""


def _self_check() -> None:
    relay = "wss://relay.example"
    channel = memory_scope_key("channel", "channel-a", relay)
    thread = memory_scope_key("thread", "channel-a", relay)
    dm = memory_scope_key("dm", "user-a", relay)
    assert channel and channel == thread
    assert dm and dm != channel
    assert memory_scope_key("dm", "user-a", "wss://other-relay") != dm
    assert memory_scope_key("group", "", relay) is None
    assert memory_dir_for_chat("group", "channel-a", relay) == memory_dir_for_chat("thread", "channel-a", relay)


if __name__ == "__main__":
    _self_check()
