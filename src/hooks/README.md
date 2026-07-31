# Sweet Hooks

These hooks are **bundled with the sweet plugin** and activate automatically when the plugin is installed. No manual setup required.

If you installed sweet standalone (without the plugin), the unified Node installer at `bin/install.js` wires them into your `settings.json` for you — run `node bin/install.js --only claude` from a clone, or `npx -y github:HDomi/sweet-agent -- --only claude` for the curl-pipe path.

## What's Included

### `sweet-activate.js` — SessionStart hook

- Runs once when Claude Code starts
- Writes `full` to `$CLAUDE_CONFIG_DIR/.sweet-active` (default `~/.claude/.sweet-active`) via the symlink-safe `safeWriteFlag` helper
- Emits sweet rules as hidden SessionStart context
- Detects missing statusline config and emits setup nudge (Claude will offer to help)

### `sweet-mode-tracker.js` — UserPromptSubmit hook

- Fires on every user prompt, checks for `/sweet` commands and natural-language activation/deactivation phrases ("talk like sweet", "stop sweet", "normal mode")
- Writes the active mode to the flag file when a sweet command is detected; deletes it on deactivation
- Emits a small per-turn reinforcement reminder when the flag is set to a non-independent mode (`lite`/`full`/`ultra`)
- Supports: `lite`, `full`, `ultra`, `commit`, `review`, `compress`

### `sweet-statusline.sh` / `sweet-statusline.ps1` — Statusline badge script

- Reads `$CLAUDE_CONFIG_DIR/.sweet-active` (default `~/.claude/.sweet-active`) and outputs a colored badge
- Shows `[SWEET]`, `[SWEET:LITE]`, `[SWEET:ULTRA]`, `[SWEET:COMMIT]`, etc.
- Appends the lifetime savings suffix `⛏ 12.4k` from `$CLAUDE_CONFIG_DIR/.sweet-statusline-suffix` (written by `sweet-stats.js` on each `/sweet-stats` run; absent until the first run, so fresh installs render no fake number). Opt out with `SWEET_STATUSLINE_SAVINGS=0`.

## Statusline Badge

The statusline badge shows which sweet mode is active directly in your Claude Code status bar.

**Plugin users:** If you do not already have a `statusLine` configured, Claude will detect that on your first session after install and offer to set it up for you. Accept and you're done.

If you already have a custom statusline, sweet does not overwrite it and Claude stays quiet. Add the badge snippet to your existing script instead.

**Standalone users:** the unified installer (`bin/install.js`, invoked by the `install.sh` / `install.ps1` shims at the repo root) wires the statusline automatically if you do not already have a custom statusline. If you do, the installer leaves it alone and prints the merge note.

**Manual setup:** If you need to configure it yourself, add one of these to `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "bash /path/to/sweet-statusline.sh"
  }
}
```

```json
{
  "statusLine": {
    "type": "command",
    "command": "powershell -ExecutionPolicy Bypass -File C:\\path\\to\\sweet-statusline.ps1"
  }
}
```

Replace the path with the actual script location (e.g. `~/.claude/hooks/` for standalone installs, or the plugin install directory for plugin installs).

**Custom statusline:** If you already have a statusline script, add this snippet to it:

```bash
sweet_text=""
sweet_flag="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/.sweet-active"
if [ -f "$sweet_flag" ]; then
  sweet_mode=$(cat "$sweet_flag" 2>/dev/null)
  if [ "$sweet_mode" = "full" ] || [ -z "$sweet_mode" ]; then
    sweet_text=$'\033[38;5;172m[SWEET]\033[0m'
  else
    sweet_suffix=$(echo "$sweet_mode" | tr '[:lower:]' '[:upper:]')
    sweet_text=$'\033[38;5;172m[SWEET:'"${sweet_suffix}"$']\033[0m'
  fi
fi
```

Badge examples:
- `/sweet` → `[SWEET]`
- `/sweet ultra` → `[SWEET:ULTRA]`
- `/sweet-commit` → `[SWEET:COMMIT]`
- `/sweet-review` → `[SWEET:REVIEW]`

## How It Works

```
SessionStart hook ──writes "full"──▶ $CLAUDE_CONFIG_DIR/.sweet-active ◀──writes mode── UserPromptSubmit hook
                                              │
                                           reads
                                              ▼
                                     Statusline script
                                    [SWEET:ULTRA] │ ...
```

SessionStart stdout is injected as hidden system context — Claude sees it, users don't. The statusline runs as a separate process. The flag file is the bridge.

## Uninstall

If installed via plugin: disable the plugin — hooks deactivate automatically.

If installed via the standalone Node installer:
```bash
npx -y github:HDomi/sweet-agent -- --uninstall
# or, from a clone:
node bin/install.js --uninstall
```

Or manually:
1. Remove the sweet hook files from `$CLAUDE_CONFIG_DIR/hooks/` (default `~/.claude/hooks/`): `sweet-activate.js`, `sweet-mode-tracker.js`, `sweet-stats.js`, `sweet-config.js`, and `sweet-statusline.{sh,ps1}`.
2. Remove the SessionStart, UserPromptSubmit, and statusLine entries from `$CLAUDE_CONFIG_DIR/settings.json`.
3. Delete `$CLAUDE_CONFIG_DIR/.sweet-active` (and `$CLAUDE_CONFIG_DIR/.sweet-statusline-suffix` if you ran `/sweet-stats`).
