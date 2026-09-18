"""Patch Hermes memory for scoped, per-turn Buzz channel and DM memory."""

from pathlib import Path
import sys


def replace_once(source: str, needle: str, replacement: str, label: str) -> str:
    count = source.count(needle)
    if count != 1:
        raise SystemExit(f"unexpected Hermes source in {label}: expected one match, got {count}")
    return source.replace(needle, replacement)


store_path = Path(sys.argv[1])
agent_path = Path(sys.argv[2])
turn_runner_path = Path(sys.argv[3])

store_source = store_path.read_text(encoding="utf-8")
store_source = replace_once(
    store_source,
    """    def __init__(self, memory_char_limit: int = 2200, user_char_limit: int = 1375, *,
                 memory_enabled: bool = True, user_profile_enabled: bool = True):
""",
    """    def __init__(self, memory_char_limit: int = 2200, user_char_limit: int = 1375, *,
                 memory_enabled: bool = True, user_profile_enabled: bool = True,
                 memory_dir: Optional[Path] = None):
""",
    "memory store constructor",
)
store_source = replace_once(
    store_source,
    """        self.memory_enabled, self.user_profile_enabled = memory_enabled, user_profile_enabled
        self._system_prompt_snapshot: Dict[str, str] = {"memory": "", "user": ""}
""",
    """        self.memory_enabled, self.user_profile_enabled = memory_enabled, user_profile_enabled
        self.memory_dir = memory_dir
        self._system_prompt_snapshot: Dict[str, str] = {"memory": "", "user": ""}
""",
    "memory store state",
)
store_source = replace_once(
    store_source,
    """    @staticmethod
    def _path_for(target: str) -> Path:
        from tools import memory_tool  # get_memory_dir is monkeypatched there
        return memory_tool.get_memory_dir() / ("USER.md" if target == "user" else "MEMORY.md")
""",
    """    def _path_for(self, target: str) -> Path:
        from tools import memory_tool  # get_memory_dir is monkeypatched there
        root = self.memory_dir or memory_tool.get_memory_dir()
        return root / ("USER.md" if target == "user" else "MEMORY.md")
""",
    "memory store path",
)
compile(store_source, str(store_path), "exec")
store_path.write_text(store_source, encoding="utf-8")

agent_source = agent_path.read_text(encoding="utf-8")
agent_source = replace_once(
    agent_source,
    """            from tools.memory_tool import (
                MemoryStore, get_builtin_memory_config, get_builtin_memory_store_flags,
            )
""",
    """            from tools.memory_tool import (
                MemoryStore, get_builtin_memory_config, get_builtin_memory_store_flags,
            )
            from tools.fork_memory_scope import is_buzz_platform, memory_dir_for_agent
""",
    "memory imports",
)
agent_source = replace_once(
    agent_source,
    """                agent._memory_store = MemoryStore(
                    memory_char_limit=mem_config.get("memory_char_limit", 2200),
                    user_char_limit=mem_config.get("user_char_limit", 1375),
                    memory_enabled=agent._memory_enabled,
                    user_profile_enabled=agent._user_profile_enabled,
                )
                agent._memory_store.load_from_disk()
""",
    """                memory_dir = memory_dir_for_agent(agent, platform)
                if is_buzz_platform(platform) and memory_dir is None:
                    # Fail closed if the Buzz adapter did not provide a conversation identity.
                    agent._memory_enabled = False
                    agent._user_profile_enabled = False
                else:
                    agent._memory_store = MemoryStore(
                        memory_char_limit=mem_config.get("memory_char_limit", 2200),
                        user_char_limit=mem_config.get("user_char_limit", 1375),
                        memory_enabled=agent._memory_enabled,
                        user_profile_enabled=agent._user_profile_enabled,
                        memory_dir=memory_dir,
                    )
                    agent._memory_store.load_from_disk()
                    if is_buzz_platform(platform):
                        # Gateway session prompts are frozen. The current scoped memory is instead
                        # injected in the per-turn ephemeral prompt so sibling threads see updates.
                        agent._memory_enabled = False
""",
    "memory store initialization",
)
compile(agent_source, str(agent_path), "exec")
agent_path.write_text(agent_source, encoding="utf-8")

turn_runner_source = turn_runner_path.read_text(encoding="utf-8")
turn_runner_source = replace_once(
    turn_runner_source,
    """        ctx = self._ctx
        combined = ctx.context_prompt or ""
        for extra in (
            (ctx.channel_prompt or "").strip(),
            self._runner._get_system_prompt_for_channel(
                ctx.source.platform, ctx.source.chat_id or "", thread_id=getattr(ctx.source, "thread_id", None),
                parent_id=getattr(ctx.source, "parent_chat_id", None),
            ),
        ):
""",
    """        from tools.fork_memory_scope import memory_prompt_for_source

        ctx = self._ctx
        combined = ctx.context_prompt or ""
        for extra in (
            (ctx.channel_prompt or "").strip(),
            self._runner._get_system_prompt_for_channel(
                ctx.source.platform, ctx.source.chat_id or "", thread_id=getattr(ctx.source, "thread_id", None),
                parent_id=getattr(ctx.source, "parent_chat_id", None),
            ),
            memory_prompt_for_source(ctx.source.platform, ctx.source.chat_type, ctx.source.chat_id),
        ):
""",
    "gateway dynamic memory prompt",
)
compile(turn_runner_source, str(turn_runner_path), "exec")
turn_runner_path.write_text(turn_runner_source, encoding="utf-8")
