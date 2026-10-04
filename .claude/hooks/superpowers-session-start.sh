#!/usr/bin/env bash
# SessionStart hook: injects the using-superpowers skill into context.
# Adapted from obra/superpowers hooks/session-start for project-level use
# (the original relies on CLAUDE_PLUGIN_ROOT, which is only set for plugins).
set -euo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
SKILL="$ROOT/.claude/skills/using-superpowers/SKILL.md"

[ -f "$SKILL" ] || exit 0

python3 - "$SKILL" <<'PY'
import json, sys
body = open(sys.argv[1], encoding="utf-8").read()
ctx = ("<EXTREMELY_IMPORTANT>\nYou have superpowers.\n\n"
       "**Below is the full content of your 'using-superpowers' skill - your introduction to using skills. "
       "For all other skills, use the 'Skill' tool:**\n\n" + body + "\n</EXTREMELY_IMPORTANT>")
print(json.dumps({"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": ctx}}))
PY
