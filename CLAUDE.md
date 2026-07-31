# CLAUDE.md — sweet-agent

## README is a product artifact

README = product front door. Non-technical people read it to decide if sweet-agent worth install. Treat like UI copy.

**Rules for any README change:**

- README is written in Korean, because the product only speaks Korean. Users are Korean. Don't translate it back to English.
- Readable by non-AI-agent users. If you write "SessionStart hook injects system context," invisible to most — translate it.
- Keep Before/After examples first. That the pitch.
- Install table always complete + accurate. One broken install command costs real user. If a route is broken, say so in the README — never leave a command that fails.
- What You Get table must sync with actual code. Feature ships or removed → update table.
- Preserve voice. The README's own prose is normal Korean, but the *examples* must be real sweet output — 다정한 반말, 오빠 호칭, 짧은 단문. Don't sanitize the examples into 존댓말.
- **No unmeasured numbers.** There are currently zero committed benchmark results for Korean. Do not reintroduce the inherited English "65%" figure, and do not estimate. A number goes in the README only after a real run lands in `benchmarks/results/`. `tests/test_sweet_stats.js` has a guard test that fails if a ratio is hardcoded back into `sweet-stats.js`.
- Adding new agent to install table → add detail block in `<details>` section below.
- Readability check before any README commit: would non-programmer understand + install within 60 seconds?

---

## Project overview

sweet-agent makes AI coding agents respond in short, affectionate Korean 반말 — the persona of a woman in her early twenties addressing the user as "오빠". Prose is 100% Korean; code, commands, file paths, error strings, API/function/variable names, and commit-type keywords stay verbatim in their original form. The goal is fewer output tokens with full technical accuracy.

Ships as Codex plugin, Gemini CLI extension, opencode native plugin, OpenClaw workspace skill, standalone Claude Code hooks, and agent rule files for Cursor, Windsurf, Cline, Copilot, 30+ others via `npx skills`.

**Derived from** [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) (MIT). Upstream owns the compression-skill structure, hook architecture, and the 30+ agent install matrix. This repo replaced the persona (English caveman → Korean sweet), dropped the wenyan (classical Chinese) intensity levels, and removed every number that was measured on English prose. `LICENSE` keeps the upstream copyright notice alongside this fork's.

**Which tree is which plugin.** Upstream's CLAUDE.md called `plugins/caveman/` the "Claude Code plugin distribution". That is wrong, and the error was inherited here before being corrected:

- **Claude Code plugin = the repo root.** `.claude-plugin/marketplace.json` declares `"source": "./"`, and `.claude-plugin/plugin.json` wires its hooks to `${CLAUDE_PLUGIN_ROOT}/src/hooks/sweet-*.js`. So a plugin install uses `src/hooks/` and `skills/` at the root — which is why `sweet-activate.js` finds the full `skills/sweet/SKILL.md` on that path.
- **Codex plugin = `plugins/sweet-agent/`.** That is where `.codex-plugin/plugin.json` lives. Its `skills/` and `agents/` are CI-mirrored copies.

`claude plugin marketplace add HDomi/sweet-agent && claude plugin install sweet@sweet` (what `installClaude` runs) resolves marketplace name `sweet` + plugin name `sweet`. Both manifests must keep `name: "sweet"` or that command breaks.

**Plugin install vs standalone install differ in ruleset size.** The standalone path (`installHooks`) copies only `src/hooks/*` into `$CLAUDE_CONFIG_DIR/hooks/`; nothing copies `skills/` there, because Claude is the one provider with no `npx skills add` profile in `PROVIDERS`. `sweet-activate.js` then finds no SKILL.md and emits its hardcoded fallback ruleset — measured at 33 lines vs 66 for the real file. The fallback keeps the persona, language rule, and auto-clarity, but loses the intensity table and examples. To get the full ruleset on a standalone install, also `cp -R skills/sweet ~/.claude/skills/sweet`. Plugin installs are unaffected.

---

## What lives where

Post-cleanup layout. Sources of truth at the top, distribution mirrors below, build outputs in `dist/`, human docs alongside each skill.

```
sweet-agent/
├── README.md                    # Front door (product pitch)
├── INSTALL.md                   # Per-agent install commands
├── CONTRIBUTING.md              # Dev guide
├── CLAUDE.md                    # This file (maintainer instructions)
├── AGENTS.md / GEMINI.md        # Autodiscovery files (must stay at root)
│
├── install.sh / install.ps1     # 30-line shims → bin/install.js
│
├── bin/                         # Unified installer
│   ├── install.js               # Single source for all 30+ agents (PROVIDERS array)
│   └── lib/settings.js          # JSONC-tolerant settings.json reader/writer
│
├── skills/                      # ALL skills, single source of truth
│   ├── sweet/{SKILL.md, README.md}
│   ├── sweet-commit/{SKILL.md, README.md}
│   ├── sweet-review/{SKILL.md, README.md}
│   ├── sweet-help/{SKILL.md, README.md}
│   ├── sweet-stats/{SKILL.md, README.md}
│   ├── sweet-compress/{SKILL.md, README.md, scripts/}
│   └── sweetcrew/{SKILL.md, README.md}
│
├── agents/                      # sweetcrew subagents (single source — kept at root for plugin auto-discovery)
├── commands/                    # Codex/Gemini TOML command stubs (root for plugin auto-discovery)
│
├── src/                         # Internal source — not auto-discovered by plugin
│   ├── hooks/                   # Claude Code hooks (installer reads here)
│   ├── rules/                   # Auto-activation rule body (single source)
│   ├── tools/                   # sweet-init.js (per-repo rule writer)
│   ├── mcp-servers/             # sweet-shrink MCP middleware (source only — not published to npm)
│   └── plugins/opencode/        # opencode native plugin + command templates
│
├── .claude-plugin/              # Claude Code plugin manifest — source is "./" (repo root)
├── .codex/                      # Codex hooks.json + config.toml (inline Korean ruleset)
├── plugins/sweet-agent/         # CODEX plugin distribution + .codex-plugin manifest (CI-mirrored)
│   ├── skills/                  # ← from skills/
│   └── agents/                  # ← from agents/
│
├── dist/                        # dist/* gitignored EXCEPT sweet.skill (committed release artifact)
│   └── sweet.skill              # ZIP of skills/sweet/, rebuilt by CI
│
├── tests/                       # All tests (Node + Python)
├── benchmarks/                  # Measurement harness. results/*.json is GITIGNORED — never committed
├── evals/                       # Three-arm eval harness
├── docs/                        # User-facing docs site
└── .github/workflows/           # CI sync
```

---

## File structure and what owns what

### Single source of truth files — edit only these

| File | What it controls |
|------|-----------------|
| `skills/sweet/SKILL.md` | Sweet behavior: the Korean persona (반말, "오빠" 호칭, 애교 budget), intensity levels, language rules, auto-clarity, persistence. Only file to edit for behavior changes. Note `src/hooks/sweet-activate.js` parses this file: intensity rows must stay `| **<level>** |` and examples must stay `- <level>: ...` or the per-level filtering breaks. |
| `src/rules/sweet-activate.md` | Always-on auto-activation rule body. Consumed by `src/tools/sweet-init.js` when a user runs `npx sweet --with-init` (per-repo IDE rule files). Edit here, not in any per-agent rule copy. |
| `src/rules/sweet-openclaw-bootstrap.md` | Marker-fenced bootstrap snippet appended to `~/.openclaw/workspace/SOUL.md` by `bin/lib/openclaw.js`. Drives always-on sweet through the OpenClaw gateway. Must include the SENTINEL `오빠에게 짧고 다정한 반말로 답한다` and stay well under OpenClaw's 12K-per-bootstrap-file cap. |
| `bin/lib/openclaw.js` | OpenClaw install/uninstall helper. Frontmatter merge (`version`, `always: true`), SOUL.md marker append/strip, idempotent. Shared by `bin/install.js` and `src/tools/sweet-init.js`. |
| `skills/sweet-commit/SKILL.md` | Sweet commit message behavior. Fully independent skill. |
| `skills/sweet-review/SKILL.md` | Sweet code review behavior. Fully independent skill. |
| `skills/sweet-help/SKILL.md` | Quick-reference card. One-shot display, not a persistent mode. |
| `skills/sweet-compress/SKILL.md` | Compress sub-skill behavior. |
| `skills/sweetcrew/SKILL.md` | Sweetcrew decision guide — when to delegate to sweet subagents vs vanilla. Edit only here. |
| `agents/sweetcrew-investigator.md` | Read-only locator subagent (haiku — locating is mechanical). Output contract: `path:line — symbol — note`, plus `불완전: <reason>.` when the list may be partial. |
| `agents/sweetcrew-builder.md` | Surgical 1-2 file editor subagent. Refuses 3+ file scope. Has no `Bash`, so it cannot run tests — its receipt must end with a `테스트 미실행` line and the main thread owns verification. |
| `agents/sweetcrew-reviewer.md` | Diff/file reviewer subagent. One-line findings with severity emoji, `불완전:` line when coverage was partial. **No `model:` line on purpose** — bug-finding inherits the session model; pinning it to haiku traded review depth for tokens the output format already saves. |
| `src/plugins/opencode/plugin.js` | opencode native plugin. ESM Bun module — `session.created` writes flag, `tui.prompt.append` parses slash/natural-language activation and appends per-prompt reinforcement. Reuses `sweet-config.js` via `createRequire`. |
| `src/plugins/opencode/commands/*.md` | Six opencode slash-command prompt templates (`/sweet`, `/sweet-{commit,review,compress,stats,help}`). The first body line of `sweet.md` MUST stay `Activate sweet mode: $ARGUMENTS` in English — `plugin.js` recovers the level argument from it with `/^activate sweet mode:[ \t]*(\S*)/`. It is a parsing protocol, not user-facing prose. |
| `src/hooks/sweet-stats.js` | `/sweet-stats` implementation. Parses the Claude Code session JSONL, attributes output tokens to the mode active at each message (via the transition log), prices them, and appends to the lifetime history. `COMPRESSION` is the savings-ratio table and **ships empty on purpose** — see the Benchmarks section. |
| `src/hooks/sweetcrew-model-overrides.js` | Patches `model:` in installed `agents/sweetcrew-*.md` frontmatter from `SWEETCREW_{REVIEWER,BUILDER,INVESTIGATOR}_MODEL`. Called by `sweet-activate.js` early in SessionStart. Silent no-op on unset/blank/malformed values or missing files. |
| `src/mcp-servers/sweet-shrink/` | MCP proxy that wraps an upstream MCP server and compresses `description` fields in `tools/list`, `prompts/list`, `resources/list` responses. Same preservation boundaries as `sweet-compress`, **plus**: modality/scope words (`might`, `may`, `could`, `perhaps`, `potentially`, `only`, `literally`, `you can`) are never dropped, and `SKIP_SUBTREES` keeps the walker out of `inputSchema`/`properties`/`parameters` so parameter descriptions pass through byte-identical. A tool description is a contract the model calls against — terser is worth nothing if the call is wrong. Source only — not published to npm, so README must not link to an npm package page. |

### Auto-generated / auto-synced — do not edit directly

We removed the agent-specific dotdir mirrors at the repo root (`.cursor/`, `.windsurf/`, `.clinerules/`, `.github/copilot-instructions.md`, root `sweet/SKILL.md`). They were never read by the installer — only used to self-apply sweet to this repo when a maintainer opened it in Cursor/Windsurf/Cline. Devs who want sweet in their editor while editing this repo should run `npx sweet --with-init` once (writes per-repo rule files from `src/rules/sweet-activate.md` via `src/tools/sweet-init.js`). For per-user installs through the upstream skills CLI, `npx sweet --only <agent>` runs `npx skills add ... -a <profile>`.

A handful of dotdir leftovers (`.junie/`, `.kiro/`, `.roo/`, `.agents/`) still hold a stale `sweetcrew/SKILL.md` mirror from before the cleanup. They aren't read by anything in the current install path; remove on sight, no migration needed.

What's left is the Claude Code plugin distribution (required by the plugin loader) and the release ZIP.

| File | Synced from |
|------|-------------|
| `plugins/sweet-agent/skills/sweet/SKILL.md` | `skills/sweet/SKILL.md` |
| `plugins/sweet-agent/skills/sweet-compress/SKILL.md` (+ `scripts/`) | `skills/sweet-compress/SKILL.md` (+ `scripts/`) |
| `plugins/sweet-agent/skills/sweetcrew/SKILL.md` | `skills/sweetcrew/SKILL.md` |
| `plugins/sweet-agent/agents/sweetcrew-*.md` | `agents/sweetcrew-*.md` |
| `dist/sweet.skill` | ZIP of `skills/sweet/` directory (gitignored; rebuilt by CI on release) |

Skills not in this table (`sweet-commit`, `sweet-review`, `sweet-help`, `sweet-stats`) are not mirrored into the Claude Code plugin distribution by CI. They reach Claude Code through the standalone hook + skill install path, and reach other agents via `npx skills add`. A `plugins/sweet-agent/skills/sweet-stats/` directory is currently checked in as a hand-committed copy; the sync workflow does not touch it, so don't rely on edits there to propagate.

---

## CI sync workflow

`.github/workflows/sync-skill.yml` triggers on main push when `skills/**/SKILL.md` or `agents/sweetcrew-*.md` changes.

What it does:
1. Copies `skills/sweet/SKILL.md`, `skills/sweetcrew/SKILL.md`, and `skills/sweet-stats/SKILL.md` into their `plugins/sweet-agent/skills/<name>/` mirrors so the **Codex** plugin loader sees the latest behavior. (The Claude plugin reads `skills/` at the repo root directly — it needs no mirror. Upstream also left the `sweet-stats` mirror unsynced; this fork syncs it.)
2. Copies `skills/sweet-compress/SKILL.md` and its `scripts/` into `plugins/sweet-agent/skills/sweet-compress/`.
3. Copies `agents/sweetcrew-*.md` into `plugins/sweet-agent/agents/`.
4. Rebuilds `dist/sweet.skill` (ZIP of `skills/sweet/`) for the release artifact.
5. Runs `python3 tests/verify_repo.py` so a broken mirror fails the job instead of being pushed.
6. Commits and pushes with `[skip ci]` to avoid loops.

CI bot commits as `github-actions[bot]`. After PR merge, wait for workflow before declaring release complete.

The old steps that mirrored SKILL.md and rules into root dotdirs (`.cursor/`, `.windsurf/`, `.clinerules/`, `.github/copilot-instructions.md`) are gone — those mirrors no longer exist. The old `sweet-compress/` → `skills/compress/` rename-on-sync is also gone now that compress lives at `skills/sweet-compress/`.

---

## Hook system (Claude Code)

Three hooks in `src/hooks/` plus a `sweet-config.js` shared module and a `package.json` CommonJS marker. Communicate via flag file at `$CLAUDE_CONFIG_DIR/.sweet-active` (falls back to `~/.claude/.sweet-active`).

```
SessionStart hook ──writes "full"──▶ $CLAUDE_CONFIG_DIR/.sweet-active ◀──writes mode── UserPromptSubmit hook
                                                       │
                                                    reads
                                                       ▼
                                              sweet-statusline.sh
                                            [SWEET] / [SWEET:ULTRA] / ...
```

`src/hooks/package.json` pins the directory to `{"type": "commonjs"}` so the `.js` hooks resolve as CJS even when an ancestor `package.json` (e.g. `~/.claude/package.json` from another plugin) declares `"type": "module"`. Without this, `require()` blows up with `ReferenceError: require is not defined in ES module scope`.

All hooks honor `CLAUDE_CONFIG_DIR` for non-default Claude Code config locations.

### `src/hooks/sweet-config.js` — shared module

Exports:
- `getDefaultMode()` — resolves default mode in order: `SWEET_DEFAULT_MODE` env var → repo-local config (`<cwd>/.sweet/config.json` or `<cwd>/.sweet.json`, walking up to the filesystem root) → user config (`$XDG_CONFIG_HOME/sweet/config.json` / `~/.config/sweet/config.json` / `%APPDATA%\sweet\config.json`) → `'full'`. The env var short-circuits before any cwd walk. Repo-local config lets a team check in a per-project default without polluting every contributor's env or user config.
- `findRepoConfigPath(start)` — walks up from `start` (default `process.cwd()`) looking for the first `.sweet/config.json` or `.sweet.json`. Bounded to 64 ancestors. Refuses symlinked files (symmetric with `safeWriteFlag` / `readFlag`).
- `safeWriteFlag(flagPath, content)` — symlink-safe flag write. Refuses if flag target or its immediate parent is a symlink. Opens with `O_NOFOLLOW` where supported. Atomic temp + rename. Creates with `0600`. Protects against local attackers replacing the predictable flag path with a symlink to clobber files writable by the user. Used by both write hooks. Silent-fails on all filesystem errors.

### `src/hooks/sweet-activate.js` — SessionStart hook

Runs once per Claude Code session start. Three things:
1. Writes the active mode to `$CLAUDE_CONFIG_DIR/.sweet-active` via `safeWriteFlag` (creates if missing)
2. Emits sweet ruleset as hidden stdout — Claude Code injects SessionStart hook stdout as system context, invisible to user
3. Checks `settings.json` for statusline config; if missing, appends nudge to offer setup on first interaction

Silent-fails on all filesystem errors — never blocks session start.

### `src/hooks/sweet-mode-tracker.js` — UserPromptSubmit hook

Reads JSON from stdin. Three responsibilities:

**1. Slash-command activation.** If prompt starts with `/sweet`, writes mode to flag file via `safeWriteFlag`:
- `/sweet` → configured default (see `sweet-config.js`, defaults to `full`)
- `/sweet lite` → `lite`
- `/sweet ultra` → `ultra`
- `/sweet-commit` → `commit`
- `/sweet-review` → `review`
- `/sweet-compress` → `compress`

**2. Natural-language activation/deactivation.** Korean and English both. Activation: "스윗 켜", "다정하게 말해", "반말로 해", "짧게 말해", "토큰 아껴", plus the English "activate sweet" / "turn on sweet mode" / "talk like sweet". Deactivation: "스윗 끄기", "그만" (prompt-initial only), "일반 모드", "존댓말로 해", plus "stop sweet" / "normal mode" / "deactivate sweet". Deactivation is evaluated first so "스윗 그만" never falls through to the activation branch. README promises these triggers, the hook enforces them.

Two Korean-specific constraints when editing these regexes:
- **Never put `\b` next to Hangul.** JS `\w` excludes Hangul, so the word boundary lands in surprising places. Use explicit suffix alternatives (`(로|으로)?\s*(해|말해|답해)`) instead.
- **Bare "그만" must stay prompt-initial-only.** Mid-sentence it is ordinary Korean ("그만하고 다음 파일 봐") and would deactivate on an unrelated instruction.
- The Korean question filter is scoped to prompts that actually name the mode (`/(스윗|스위트)/` AND a question marker). A bare "반말로 설명해줘" is an activation request, not a question about sweet — do not widen the filter to swallow it.

`src/plugins/opencode/plugin.js` carries a mirror of both the activation and deactivation sets. Change one, change the other.

**3. Per-turn reinforcement.** When flag is set to a non-independent mode (i.e. not `commit`/`review`/`compress`), emits a small `hookSpecificOutput` JSON reminder so the model keeps sweet style after other plugins inject competing instructions mid-conversation. The full ruleset still comes from SessionStart — this is just an attention anchor.

### `src/hooks/sweet-statusline.sh` — Statusline badge

Reads flag file at `$CLAUDE_CONFIG_DIR/.sweet-active`. Outputs colored badge string for Claude Code statusline:
- `full` or empty → `[SWEET]` (orange)
- anything else → `[SWEET:<MODE_UPPERCASED>]` (orange)

Then appends the lifetime-savings suffix (`⛏ 12.4k`) read from `$CLAUDE_CONFIG_DIR/.sweet-statusline-suffix` — written by `sweet-stats.js` on every `/sweet-stats` run. **Default on**; users opt out with `SWEET_STATUSLINE_SAVINGS=0`. The suffix file is absent until `/sweet-stats` runs at least once, so fresh installs render no fake number.

Configured in `settings.json` under `statusLine.command`. PowerShell counterpart at `src/hooks/sweet-statusline.ps1` for Windows. Both scripts symlink-refuse and whitelist-validate the flag/suffix file contents — never echo arbitrary bytes.

### Hook installation

**Plugin install** — hooks wired automatically by plugin system.

**Standalone install** — `bin/install.js` (the unified Node installer) copies hook files into `$CLAUDE_CONFIG_DIR/hooks/` and merges SessionStart + UserPromptSubmit + statusline into `settings.json`. Uses the JSONC-tolerant helpers in `bin/lib/settings.js` so a commented `settings.json` no longer crashes the merge. Defensive `validateHookFields` runs before every write to prevent a single malformed hook from poisoning the entire file (Claude Code Zod silently discards the whole `settings.json` on schema mismatch).

The `install.sh` / `install.ps1` shims at the repo root delegate to `bin/install.js` via `node` (local clone) or `npx -y github:HDomi/sweet-agent` (curl|bash). No legacy fallback path remains — earlier `install.sh.legacy` / `install.ps1.legacy` files were removed.

**Uninstall** — `npx -y github:HDomi/sweet-agent -- --uninstall` (or `node bin/install.js --uninstall` from a clone). Strips sweet hook entries from `settings.json` via substring marker `sweet`, deletes hook files, and removes the Claude plugin / Gemini extension. Skill installs done via `npx skills add` must be removed via the IDE's skill manager (we don't track them).

---

## Skill system

Skills = Markdown files with YAML frontmatter consumed by Claude Code's skill/plugin system and by `npx skills` for other agents.

Each skill has a human-facing `README.md` alongside the LLM-facing `SKILL.md`. The README explains what the skill does for users browsing GitHub; the SKILL.md is the prompt body the agent loads. Don't merge them — different audiences, different formats.

### Intensity levels

Defined in `skills/sweet/SKILL.md`. Three levels: `lite`, `full` (default), `ultra`. Persists until changed or session ends. The wenyan (classical Chinese) levels upstream shipped were removed — they had nothing to do with a Korean persona. `VALID_MODES` in `src/hooks/sweet-config.js` and the whitelists in both statusline scripts must stay in sync with this list.

### Auto-clarity rule

Sweet drops to normal prose for: security warnings, irreversible action confirmations, multi-step sequences where fragment ambiguity risks misread, user confused or repeating question. Resumes after. Defined in skill — preserve in any SKILL.md edit.

### sweet-compress

Sub-skill in `skills/sweet-compress/SKILL.md`. Takes file path, compresses prose to sweet style, writes to original path, saves backup at `<filename>.original.md`. Validates headings, code blocks, URLs, file paths, commands preserved — **plus polarity**: `validate_polarity()` in `scripts/validate.py` fails the run when a section that carried a prohibition (`never`, `don't`, `avoid`, 금지, 절대) comes back with no negation of any kind, because "never mock the DB" → "mock the DB" passes every structural check and then silently reprograms the agent. The check is asymmetric on purpose — strong prohibitions trigger it, any negation satisfies it, so honest rewrites like "don't use `any`" → "No `any`" pass. Conditions and ordering are prose-level rules in the SKILL, not machine-checked. All five fixtures in `tests/sweet-compress/` pass; recalibration must keep them passing (`tests/test_validate_inline.py`). Retries up to 2 times on failure with targeted patches only. Requires Python 3.10+.

The slash command is `/sweet-compress` everywhere — same name in plugin and standalone install. CI no longer renames the directory on sync (the old `sweet-compress/` → `skills/compress/` sed rename is gone now that the source lives at `skills/sweet-compress/`).

### sweet-commit / sweet-review

Independent skills in `skills/sweet-commit/SKILL.md` and `skills/sweet-review/SKILL.md`. Both have own `description` and `name` frontmatter so they load independently. sweet-commit: Conventional Commits, ≤50 char subject. sweet-review: one-line comments in `L<line>: <severity> <problem>. <fix>.` format.

---

## Agent distribution

How sweet reaches each agent type:

| Agent | Mechanism | Auto-activates? |
|-------|-----------|----------------|
| Claude Code | Plugin (hooks + skills) or standalone hooks | Yes — SessionStart hook injects rules |
| Codex | Plugin in `plugins/sweet-agent/` plus repo `.codex/hooks.json` and `.codex/config.toml` | Yes on macOS/Linux — SessionStart hook |
| Gemini CLI | Extension with `GEMINI.md` context file | Yes — context file loads every session |
| opencode | Native plugin (`src/plugins/opencode/`) copied into `~/.config/opencode/plugins/sweet-agent/` + `AGENTS.md` ruleset + skills/agents/commands directories. Plugin uses `session.created` and `tui.prompt.append` lifecycle hooks. No statusline (opencode TUI exposes no plugin-writable badge). | Yes — `session.created` writes flag, `AGENTS.md` carries always-on ruleset |
| OpenClaw | Workspace skill at `~/.openclaw/workspace/skills/sweet/SKILL.md` (frontmatter merged with `version` + `always: true`) plus a marker-fenced bootstrap block in `~/.openclaw/workspace/SOUL.md`. Both writes go through `bin/lib/openclaw.js`; workspace path is overridable via `OPENCLAW_WORKSPACE`. | Yes — SOUL.md is auto-injected each turn under "Project Context" (subject to OpenClaw's 12K-per-file / 60K-total bootstrap caps) |
| Cursor | `npx skills add ... -a cursor` (default via `--only cursor`) writes the upstream skill profile; per-repo `.cursor/rules/sweet.mdc` via `--with-init` (calls `src/tools/sweet-init.js`) | Yes — always-on rule |
| Windsurf | `npx skills add ... -a windsurf` (default via `--only windsurf`); per-repo `.windsurf/rules/sweet.md` via `--with-init` | Yes — always-on rule |
| Cline | `npx skills add ... -a cline` (default via `--only cline`); per-repo `.clinerules/sweet.md` via `--with-init` | Yes — Cline auto-discovers `.clinerules/` |
| Copilot | `npx skills add ... -a github-copilot` (soft probe — pass `--only copilot`); per-repo `.github/copilot-instructions.md` + `AGENTS.md` via `--with-init` | Yes — repo-wide instructions |
| Others (Junie, Trae, Warp, Tabnine, Mistral, Qwen, Devin, Droid, ForgeCode, Bob, Crush, iFlow, OpenHands, Qoder, Rovo Dev, Replit, Antigravity, …) | `npx skills add HDomi/sweet-agent -a <profile>` | No — user must say `/sweet` each session |

opencode reaches Tier 1 minus the statusline (opencode's TUI has no plugin-writable badge). Mode flag lives at `~/.config/opencode/.sweet-active` for any external tooling that wants to surface it.

For agents without hook systems, the always-on snippet lives in `INSTALL.md`'s "Want it always on?" section — keep current with `src/rules/sweet-activate.md`.

**Adding a new agent.** Edit the `PROVIDERS` array in `bin/install.js` — single source of truth, no more bash/PS1 dual-source drift. Each entry has `id`, `label`, `mech`, `detect` (clause spec like `command:foo||dir:$HOME/x`), optional `profile` (vercel-labs/skills slug), optional `soft: true` (config-dir-only detection).

1. The profile slug must exist in upstream [vercel-labs/skills](https://github.com/vercel-labs/skills). Verify against the README before merging — wrong slugs cause `npx skills add` to fail at runtime, not at install-script load.
2. Run `node bin/install.js --list` to confirm the new row renders correctly.
3. Soft probes (config-dir-only) are fine but tag them with `soft: true`. They render with `(soft)` in `--list` so users know detection is best-effort.

---

## Evals

`evals/` has three-arm harness:
- `__baseline__` — no system prompt
- `__terse__` — `Answer concisely.`
- `<skill>` — `Answer concisely.\n\n{SKILL.md}`

Honest delta = **skill vs terse**, not skill vs baseline. Baseline comparison conflates skill with generic terseness — that cheating. Harness designed to prevent this.

`llm_run.py` calls `claude -p --system-prompt ...` per (prompt, arm), saves to `evals/snapshots/results.json`. `measure.py` reads snapshot offline with tiktoken (OpenAI BPE — approximates Claude tokenizer, ratios meaningful, absolute numbers approximate).

Add skill: drop `skills/<name>/SKILL.md`. Harness auto-discovers. Add prompt: append line to `evals/prompts/en.txt`.

Snapshots committed to git. CI reads without API calls. Only regenerate when SKILL.md or prompts change.

---

## Benchmarks

`benchmarks/` runs real prompts through Claude API (not Claude Code CLI), records raw token counts into `benchmarks/results/`.

**Those results are gitignored.** `.gitignore` carries `benchmarks/results/*.json` (inherited from upstream), so no benchmark JSON has ever been committed to either repo — only a `.gitkeep`. Upstream's CLAUDE.md said results were committed; that was wrong, and it means the inherited 65% figure was never reproducible from the repo either. If you want a number to be auditable, either commit the JSON (drop that ignore line) or paste the raw counts into the README next to the claim.

**Nothing has been measured for Korean yet.** `benchmarks/results/` contains only a `.gitkeep`. The inherited English figure (65% output reduction, mean of 10 tasks) was measured on English caveman prose and is not transferable — it has been removed from the README, from `sweet-stats.js`, and from every doc. Do not put it back.

To measure: translate/extend `benchmarks/prompts.json` for Korean, then `uv run python benchmarks/run.py` (needs `ANTHROPIC_API_KEY` in `.env.local`). Commit the JSON result, then:

1. Fill the README benchmark section with the real numbers.
2. Add the measured per-mode ratio to `COMPRESSION` in `src/hooks/sweet-stats.js`, and update the guard test in `tests/test_sweet_stats.js` ("ships no built-in compression ratio") which currently asserts the table is empty.

Until then, `/sweet-stats` reports real token counts and omits the savings estimate. Users who have their own measurement can supply it at runtime without editing code:

```bash
export SWEET_COMPRESSION_RATIOS='{"full":0.65}'
```

`parseCompressionRatios()` validates it: unknown modes, non-numbers, and ratios outside the exclusive range (0,1) are dropped, and malformed JSON is treated as unset. This is also how the stats tests exercise the estimate arithmetic without shipping a number.

---

## Key rules for agents working here

- Edit `skills/<name>/SKILL.md` for behavior changes. Never edit synced copies under `plugins/sweet-agent/skills/`.
- Edit `src/rules/sweet-activate.md` for auto-activation rule changes. Never edit any per-agent rule copy a user has on their machine.
- Edit `src/rules/sweet-openclaw-bootstrap.md` for the OpenClaw SOUL.md bootstrap snippet. Keep the `<!-- sweet-begin -->` / `<!-- sweet-end -->` markers and the `오빠에게 짧고 다정한 반말로 답한다` sentinel — `bin/lib/openclaw.js` keys idempotency off both. If you change the embedded fallback in `bin/lib/openclaw.js`, keep it byte-equivalent to the file.
- Per-skill human docs live in `skills/<name>/README.md`. The LLM-facing body is in `SKILL.md`. Don't merge them — different audiences.
- Build artifacts go in `dist/`. `.gitignore` is `dist/*` plus a `!dist/sweet.skill` negation — the release ZIP **is** committed and the CI job `git add`s it explicitly. Upstream's CLAUDE.md claimed all of `dist/` was gitignored; that was wrong. Don't hand-edit the ZIP; regenerate it (command in the CI sync section).
- README most important file for user-facing impact. Optimize for non-technical readers. Written in Korean; examples must show real sweet output.
- `INSTALL.md` is the per-agent install reference. Keep the install table in `README.md` short and link out to `INSTALL.md` for the full matrix.
- Benchmark and eval numbers must be real. Never fabricate or estimate. Right now that means **no numbers at all** — see Benchmarks above.
- The persona is Korean-only prose with English technical tokens. Any behavior edit must preserve both halves: 산문 100% 한국어, and code/commands/paths/error strings/API names/commit-type keywords verbatim. Never add a translation step for identifiers.
- **Compression applies to speech, never to work product or to certainty.** Four invariants protect code-generation quality; every behavior edit has to keep all four:
  1. **Repo-language carve-out.** The "산문 100% 한국어" rule governs what sweet *says to the user*. Anything written into a file — code comments, docstrings, log/error strings, test names, commit messages, PR descriptions, repo docs — follows the project's existing language convention. This clause exists in `skills/sweet/SKILL.md`, `src/rules/sweet-activate.md` (+ the `RULE_BODY` mirror in `src/tools/sweet-init.js`), `src/rules/sweet-openclaw-bootstrap.md` (+ the `bin/lib/openclaw.js` mirror), the `sweet-activate.js` fallback ruleset, `.codex/hooks.json`, and both per-turn reinforcement lines. Removing it from one surface silently reintroduces Korean comments in English repos.
  2. **Accuracy outranks tokens.** No claiming unrun checks, no omitting failed tests / errors / skipped work to keep an answer short. Same clause set as above.
  3. **Mode triggers must not fire on coding tasks.** The loose Korean triggers (`짧게 말해`, `반말로 해`, `토큰 아껴`, `존댓말로 해`) are gated behind `bareDirective` in `src/hooks/sweet-mode-tracker.js` — prompt ≤30 chars after whitespace collapse and no `CODE_TASK_OBJECT` word. `일반 모드` deactivates only prompt-initial or with sweet named. `src/plugins/opencode/plugin.js` mirrors this, but computes the guard on a **collapsed copy** — collapsing `prompt` itself makes its `.*`-based English deactivation patterns match across the expanded `/sweet` command template and delete the flag (caught by `tests/installer/opencode.test.mjs`). Covered by `tests/test_mode_tracker.py`.
  4. **sweetcrew compresses output, not diligence.** `sweetcrew-reviewer` and `-builder` inherit the session model; only `-investigator` pins haiku. investigator/reviewer emit `불완전:` when coverage was partial, builder emits `테스트 미실행` because it has no `Bash`. Don't "optimize" these back into silence.
- Auto-clarity is a safety feature, not a style flourish. Every SKILL.md edit must keep the escape hatch for security warnings, irreversible-action confirmations, order-sensitive multi-step procedures, and user confusion. Dropping it to save tokens is not an acceptable trade.
- `sweet-commit`, `sweet-review`, and the `sweetcrew-*` subagents deliberately do NOT use 반말/애교. They produce artifacts (commit messages, PR comments) or machine-read data. Keep them plain Korean.
- `VALID_MODES` (`src/hooks/sweet-config.js`) is the mode whitelist. Adding or removing a mode means updating it plus both statusline scripts (`sweet-statusline.sh`, `sweet-statusline.ps1`), the opencode plugin's parser, and `skills/sweet/SKILL.md`'s intensity table.
- CI workflow commits back to main after merge. Account for when checking branch state.
- Hook files must silent-fail on all filesystem errors. Never let hook crash block session start.
- Any new flag file write must go through `safeWriteFlag()` in `sweet-config.js`. Direct `fs.writeFileSync` on predictable user-owned paths reopens the symlink-clobber attack surface.
- Hooks must respect `CLAUDE_CONFIG_DIR` env var, not hardcode `~/.claude`. Same for `bin/install.js` / statusline scripts.
- `bin/install.js` is the only installer source. `install.sh` / `install.ps1` at repo root are 30-line shims that delegate to it. Never re-add per-OS install logic to the shims — that's how we got the Windows quoting bug (#249).
- **`src/hooks/checksums.sha256` must be regenerated whenever any file in `src/hooks/` changes.** The download path in `installHooks` verifies every fetched hook against this manifest and aborts the install on a mismatch. The caveman→sweet rename updated the filenames in it but left the old hash values, so 7 of 8 entries failed until regenerated. Regenerate and verify with:
  ```bash
  cd src/hooks && awk '{print $2}' checksums.sha256 > /tmp/o && : > n \
    && while IFS= read -r f; do shasum -a 256 "$f" >> n; done < /tmp/o \
    && mv n checksums.sha256 && shasum -a 256 -c checksums.sha256
  ```
- **`PINNED_REF` in `bin/install.js` is `main`, not a tag.** It should be an immutable release tag so a push to main can't change what a `curl | bash` install executes. This fork has no tags yet, and upstream's `v1.9.1` 404s under `HDomi/sweet-agent`. Create the first release tag, then set `PINNED_REF` to it and regenerate `checksums.sha256` at that ref. Until then the integrity check only proves the hooks match the manifest at the same ref — not that they are frozen.
- Any settings.json read in installer or hooks must go through `bin/lib/settings.js` `readSettings()` so JSONC comments don't crash the merge. Any settings.json write must run through `validateHookFields()` first.
- **`src/mcp-servers/sweet-shrink/compress.js` is invisible to `grep -r`.** It contains literal NUL bytes on purpose — the segment sentinels are `` `\0<index>\0` ``, chosen so they can never collide with real prose. Every text tool therefore classifies the file as binary, and `grep -r` skips it (the Claude Code shell wrapper runs ugrep with `-I`, and `--binary-files=without-match` does the same). The caveman→sweet rename missed this file's header for exactly this reason. For any repo-wide rename or audit, verify with a byte scan, not grep:
  ```bash
  python3 -c "
  import pathlib
  for p in pathlib.Path('.').rglob('*'):
      if p.is_file() and not {'.git','node_modules','dist'} & set(p.parts):
          n = p.read_bytes().lower().count(b'<needle>')
          if n: print(n, p)
  "
  ```
