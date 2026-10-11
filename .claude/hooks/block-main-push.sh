#!/bin/sh
# PreToolUse hook for Claude Code: blocks git pushes to main/master and
# --no-verify regardless of how the command is spelled. Exit 2 blocks the
# tool call.
cmd=$(node -e "
let s = '';
process.stdin.on('data', (d) => (s += d));
process.stdin.on('end', () => {
  try {
    const j = JSON.parse(s);
    console.log((j.tool_input && j.tool_input.command) || '');
  } catch {
    console.log('');
  }
});
")

case "$cmd" in
  *--no-verify*|*" -n "*)
    echo "Blocked: --no-verify skips the hooks that protect main (see AGENTS.md)." >&2
    exit 2
    ;;
esac

if printf '%s' "$cmd" | grep -Eq 'git[[:space:]]+push.*(^|[^a-z-])(main|master)([^a-z-]|$)'; then
  echo "Blocked: direct pushes to main are not allowed. Open a PR (see AGENTS.md)." >&2
  exit 2
fi

exit 0
