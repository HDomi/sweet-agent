// sweet — opencode plugin
//
// Provides dynamic sweet mode tracking for opencode:
// - Writes the mode flag on each session start (via the `event` dispatcher)
// - Parses user messages for /sweet commands and natural-language toggles
// - Injects per-turn reinforcement into the system prompt
//
// Bun ESM module; loads the existing security-hardened helpers from
// sweet-config.js via createRequire so the symlink-safe flag-write code
// lives in one place.
//
// Layout once installed:
//   ~/.config/opencode/plugins/sweet-agent/
//   ├── package.json
//   ├── plugin.js              ← this file
//   └── sweet-config.cjs     ← copied sibling of src/hooks/sweet-config.js
//
// The always-on sweet ruleset is provided separately via
// ~/.config/opencode/AGENTS.md (Tier-3 base). This plugin handles dynamic
// state only: flag writes, slash-command parsing, natural-language
// activation, and per-turn reinforcement.
//
// Hook mapping (opencode >= 1.15.x):
//   - event (event.type === 'session.created'): session-init flag write,
//     re-fires per session rather than once per plugin-process load
//   - chat.message: intercept user prompts for mode changes
//   - experimental.chat.system.transform: inject reinforcement per-turn
//
// Note: opencode does NOT support 'session.created' or 'tui.prompt.append'
// as named plugin-hook keys. 'session.created' is an event *type* dispatched
// through the single `event` handler; the old direct-key handlers were
// silently ignored. See:
// https://github.com/HDomi/sweet-agent/issues/418
// https://github.com/HDomi/sweet-agent/issues/421

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, unlinkSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

// When installed: sweet-config.cjs sits next to plugin.js (copied by
// bin/install.js, renamed to .cjs because this directory's package.json
// declares "type": "module" — bare .js would be loaded as ESM). When loaded
// from the source tree (tests, dev): fall back to the canonical
// src/hooks/sweet-config.js, which lives in a directory whose own
// package.json pins "type": "commonjs". One source of truth either way.
//
// Loaded by evaluating the file as CommonJS by hand, NOT via the module
// loader: opencode runs plugins inside a compiled Bun binary where
// require() of on-disk files is rejected ("require() async module is
// unsupported") and await import() of a CJS file yields an empty namespace —
// both silently break the plugin (#418 follow-up). createRequire() still
// resolves node BUILT-INS fine in the compiled binary, which is all
// sweet-config needs (fs/path/os).
function loadConfig() {
  const installed = join(here, 'sweet-config.cjs');
  const dev = join(here, '..', '..', 'hooks', 'sweet-config.js');
  const target = existsSync(installed) ? installed : dev;
  const code = readFileSync(target, 'utf8').replace(/^#![^\n]*\n/, '');
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', '__dirname', '__filename', code)(
    mod, mod.exports, createRequire(import.meta.url), dirname(target), target
  );
  return mod.exports;
}
const config = loadConfig();

const { getDefaultMode, safeWriteFlag, readFlag, VALID_MODES } = config;

// Modes handled by independent skills — not selectable via /sweet <arg>.
const INDEPENDENT_MODES = new Set(['commit', 'review', 'compress']);

// opencode resolves its config dir from $XDG_CONFIG_HOME, else ~/.config/opencode
// on every platform — including Windows, where it uses %USERPROFILE%\.config\opencode
// (NOT %APPDATA%). os.homedir() is %USERPROFILE% on win32, so the default branch
// is already correct cross-platform.
function opencodeConfigDir() {
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, 'opencode');
  }
  return path.join(os.homedir(), '.config', 'opencode');
}

const flagPath = path.join(opencodeConfigDir(), '.sweet-active');

function reinforcementLine(mode) {
  return 'SWEET MODE ACTIVE (' + mode + '). ' +
    "한국어 반말로만 답한다. 호칭 '오빠'는 응답당 0~1번. " +
    '조사·군더더기·상투어·완충 표현 버린다. 단문 OK. ' +
    '코드·커밋 메시지·보안 경고는 평문. ' +
    '파일에 남는 산문(주석·docstring·문서)은 레포 언어 관례. ' +
    '압축은 말투에만 — 실패·에러·미완료는 생략 금지.';
}

// Parse a prompt for slash-command activation or natural-language toggles.
// Returns the new mode to write, the literal string 'off' to deactivate, or
// null when the prompt doesn't change state. Mirrors sweet-mode-tracker.js.
function parseModeChange(promptRaw) {
  let prompt = (promptRaw || '').trim();
  // opencode's non-interactive `run` path delivers the message wrapped in
  // literal quote characters ("/sweet ultra"\n) — unwrap symmetric quotes
  // so the slash-command branch still matches.
  const wrapped = /^(["'`])([\s\S]*)\1$/.exec(prompt);
  if (wrapped) prompt = wrapped[2].trim();
  prompt = prompt.toLowerCase();
  if (!prompt) return null;

  // Loose Korean style triggers only count on a short bare directive with no
  // code-task object — "이 함수 간단히 해줘" / "CLI 출력을 반말로 써" are work
  // requests, not mode switches. Mirrors sweet-mode-tracker.js.
  //
  // Measured on a whitespace-collapsed COPY, never on `prompt` itself: the
  // English deactivation patterns below use `.*` without the s flag and rely
  // on newlines to stay non-matching inside the expanded /sweet command
  // template ("Activate sweet mode: lite\n\n… deactivate.").
  const collapsed = prompt.replace(/\s+/g, ' ');
  const CODE_TASK_OBJECT = /(코드|함수|메서드|클래스|변수|주석|docstring|파일|경로|출력|로그|스크립트|커밋|문서|readme|리드미|리팩터|리팩토링|테스트|스키마|쿼리|응답|요청|페이로드|필드|프롬프트|캐싱|번역|카피|문구|api|cli|ui|json|yaml|sql)/;
  const bareDirective = collapsed.length <= 30 && !CODE_TASK_OBJECT.test(collapsed);

  // Natural-language deactivation — checked before activation so "stop talking
  // like sweet" doesn't trip the activation regex.
  if (/\b(stop|disable|deactivate|turn off)\b.*\bsweet\b/i.test(prompt) ||
      /\bsweet\b.*\b(stop|disable|deactivate|turn off)\b/i.test(prompt) ||
      /\bnormal mode\b/i.test(prompt) ||
      // Korean deactivation — mirrors sweet-mode-tracker.js.
      /(스윗|스위트)\s*(모드)?\s*(끄기|꺼줘|꺼|끄고|해제|그만|중단|off)/.test(prompt) ||
      /^(다시\s*|이제\s*)?(일반|보통|평소)\s*모드(로|으로)?\s*(해|해줘|가|가자|바꿔|전환|복귀)?\s*[.!]*$/.test(prompt) ||
      (/(일반|보통|평소)\s*모드/.test(prompt) && /(스윗|스위트)/.test(prompt)) ||
      (bareDirective && /존댓말(로|으로)?\s*(해|말해|답해|바꿔|써)/.test(prompt)) ||
      /^(스윗\s*)?그만\s*(해|하자|해줘)?\s*[.!]*$/.test(prompt)) {
    return 'off';
  }

  // Expanded /sweet command template. opencode replaces a typed
  // "/sweet <level>" with the command file's body ("Activate sweet
  // mode: $ARGUMENTS ...") before chat.message fires, so the literal
  // slash-command branch below never sees it — recover the level argument
  // from the template's first line instead. Must run before the generic
  // NL-activation match, which would swallow it and drop the level.
  const tpl = /^activate sweet mode:[ \t]*(\S*)/.exec(prompt);
  if (tpl) {
    const arg = tpl[1] || '';
    if (arg === 'off' || arg === 'stop' || arg === 'disable') return 'off';
    if (VALID_MODES.includes(arg) && !INDEPENDENT_MODES.has(arg)) return arg;
    return getDefaultMode();
  }

  // Natural-language activation
  if (/\b(activate|enable|turn on|start|talk like)\b.*\bsweet\b/i.test(prompt) ||
      /\bsweet\b.*\b(mode|activate|enable|turn on|start)\b/i.test(prompt) ||
      // Korean activation — mirrors sweet-mode-tracker.js.
      /(스윗|스위트)\s*(모드)?\s*(켜|켜줘|활성|시작|on)/.test(prompt) ||
      /^(스윗|스위트)(\s*모드)?\s*[.!]*$/.test(prompt) ||
      (bareDirective && /(다정하게|귀엽게|애교|사근사근)\s*(말해|답해|얘기해|해줘|해)/.test(prompt)) ||
      (bareDirective && /반말(로|루)?\s*(해|말해|답해|얘기해|해줘|써)/.test(prompt)) ||
      (bareDirective && /(짧게|간단히|간결하게|간략히)\s*(말해|답해|얘기해|대답|해줘)/.test(prompt)) ||
      (bareDirective && /토큰\s*(좀\s*)?(아껴|아끼|절약|줄여)/.test(prompt))) {
    const mode = getDefaultMode();
    return mode === 'off' ? null : mode;
  }

  // Slash-command parsing — opencode also expands command files, but if the
  // user types the literal slash command we still want to flip the flag.
  if (prompt.startsWith('/sweet')) {
    const parts = prompt.split(/\s+/);
    const cmd = parts[0];
    const arg = parts[1] || '';

    if (cmd === '/sweet-commit')   return 'commit';
    if (cmd === '/sweet-review')   return 'review';
    if (cmd === '/sweet-compress') return 'compress';

    if (cmd === '/sweet') {
      if (!arg)                                     return getDefaultMode();
      if (arg === 'off' || arg === 'stop' || arg === 'disable') return 'off';
      if (VALID_MODES.includes(arg) && !INDEPENDENT_MODES.has(arg)) return arg;
      // Unknown arg — leave flag alone. No silent overwrite.
      return null;
    }
  }

  return null;
}

function applyModeChange(mode) {
  if (!mode) return;
  if (mode === 'off') {
    try { if (existsSync(flagPath)) unlinkSync(flagPath); } catch (e) {}
    return;
  }
  safeWriteFlag(flagPath, mode);
}

// Session-start logic — extracted so the `event` dispatcher (opencode >= 1.15)
// drives one shared implementation. Re-fires on every `session.created` event,
// so a new session in a long-lived plugin process re-asserts the flag.
function handleSessionCreated() {
  const mode = getDefaultMode();
  if (mode === 'off') {
    try { if (existsSync(flagPath)) unlinkSync(flagPath); } catch (e) {}
    return;
  }
  safeWriteFlag(flagPath, mode);
}

export const SweetPlugin = async (_ctx) => {
  // Assert the flag at plugin load as well: in one-shot `opencode run` the
  // first session.created publishes before plugin event dispatch is wired,
  // so the event handler alone misses it. The factory-time write covers that
  // race; the event handler re-asserts on every later session in long-lived
  // TUI processes.
  handleSessionCreated();

  return {
  // opencode dispatches session/lifecycle events through a single `event`
  // handler keyed on event.type; the older direct top-level
  // 'session.created' key is silently ignored. Routing session-init through
  // here means the flag is rewritten on every new session, not just once when
  // the plugin module loads. See https://opencode.ai/docs/plugins#events.
  event: async ({ event } = {}) => {
    if (event && event.type === 'session.created') handleSessionCreated();
  },

  // Intercept user messages to detect /sweet commands and natural-language
  // mode toggles. opencode fires chat.message with (input, output) where
  // output.parts is the array of message parts; text parts carry .text.
  // Return value is ignored — state changes happen via the flag file.
  'chat.message': async (_input, output) => {
    if (!output || !output.parts) return;
    for (const part of output.parts) {
      if (part && part.type === 'text' && part.text) {
        const change = parseModeChange(part.text);
        if (change) applyModeChange(change);
      }
    }
  },

  // Inject the reinforcement line into the system prompt when sweet is
  // active. opencode calls this before every LLM request and expects the hook
  // to mutate output.system (a string[]); the return value is discarded.
  'experimental.chat.system.transform': async (_input, output) => {
    if (!output || !Array.isArray(output.system)) return;
    const active = readFlag(flagPath);
    if (active && !INDEPENDENT_MODES.has(active)) {
      output.system.push(reinforcementLine(active));
    }
  },
  };
};

export default SweetPlugin;
