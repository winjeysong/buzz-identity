"""Disable Hermes-style slash commands at the Buzz adapter boundary."""

from pathlib import Path
import sys


path = Path(sys.argv[1])
source = path.read_text(encoding="utf-8")


def is_slash_command(text: str) -> bool:
    token = text.lstrip().split(maxsplit=1)[0]
    return token.startswith("/") and "/" not in token[1:]


assert is_slash_command("/start")
assert is_slash_command("  /model deepseek")
assert not is_slash_command("/api/users 是什么")
assert not is_slash_command("普通问题")

needle = """        event = MessageEvent(
            text=text, message_type=message_type, source=source, raw_message=raw_message, message_id=message_id,
"""
replacement = """        command_token = (text or "").lstrip().split(maxsplit=1)[0]
        if command_token.startswith("/") and "/" not in command_token[1:]:
            await self.send(
                chat_id,
                "该知识分身不支持系统命令，请直接描述要查询的问题。",
                reply_to=message_id,
            )
            return
        event = MessageEvent(
            text=text, message_type=message_type, source=source, raw_message=raw_message, message_id=message_id,
"""

if source.count(needle) != 1:
    raise SystemExit("unexpected Buzz adapter source; slash-command hardening was not applied")

updated = source.replace(needle, replacement)
compile(updated, str(path), "exec")
path.write_text(updated, encoding="utf-8")
