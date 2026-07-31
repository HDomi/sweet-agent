// opencode native install — fresh install, idempotency, uninstall, plugin smoke.
//
// Detection of opencode is gated behind `command -v opencode`, so to run on a
// CI box without opencode installed we prepend a tmpdir with a no-op `opencode`
// shim to PATH. The installer's per-provider dispatch only checks PATH; it
// never invokes the binary itself.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const INSTALLER = path.join(REPO_ROOT, 'bin', 'install.js');
const requireCjs = createRequire(import.meta.url);
const SETTINGS = requireCjs(path.join(REPO_ROOT, 'bin', 'lib', 'settings.js'));

const IS_WIN = process.platform === 'win32';

function freshTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sweet-opencode-'));
}

// Make a throwaway `opencode` binary on PATH so detectMatch('command:opencode')
// returns true. The shim never executes — installer only checks PATH presence.
function shimOpencode() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-shim-'));
  if (IS_WIN) {
    fs.writeFileSync(path.join(dir, 'opencode.cmd'), '@echo off\r\n');
  } else {
    const f = path.join(dir, 'opencode');
    fs.writeFileSync(f, '#!/bin/sh\nexit 0\n');
    fs.chmodSync(f, 0o755);
  }
  return dir;
}

function runInstaller(args, env) {
  return spawnSync('node', [INSTALLER, ...args, '--non-interactive', '--no-mcp-shrink'], {
    env, encoding: 'utf8',
  });
}

function pathWith(prependDir) {
  const sep = IS_WIN ? ';' : ':';
  return prependDir + sep + (process.env.PATH || '');
}

// ── 1. Fresh install populates expected files ────────────────────────────
test('opencode fresh install drops plugin, commands, agents, skills, AGENTS.md, opencode.json', () => {
  const xdg = freshTmpDir();
  const shimDir = shimOpencode();
  try {
    const r = runInstaller(['--only', 'opencode'], {
      ...process.env,
      XDG_CONFIG_HOME: xdg,
      PATH: pathWith(shimDir),
      NO_COLOR: '1',
    });
    assert.notEqual(r.status, 2, `argv error: ${r.stderr}`);

    const ocDir = path.join(xdg, 'opencode');
    assert.ok(fs.existsSync(path.join(ocDir, 'plugins', 'sweet', 'plugin.js')), 'plugin.js missing');
    assert.ok(fs.existsSync(path.join(ocDir, 'plugins', 'sweet', 'package.json')), 'plugin package.json missing');
    assert.ok(fs.existsSync(path.join(ocDir, 'plugins', 'sweet', 'sweet-config.cjs')), 'sweet-config.cjs sibling missing');

    for (const f of ['sweet.md', 'sweet-commit.md', 'sweet-review.md', 'sweet-compress.md', 'sweet-stats.md', 'sweet-help.md']) {
      assert.ok(fs.existsSync(path.join(ocDir, 'commands', f)), `command ${f} missing`);
    }
    for (const f of ['sweetcrew-investigator.md', 'sweetcrew-builder.md', 'sweetcrew-reviewer.md']) {
      assert.ok(fs.existsSync(path.join(ocDir, 'agents', f)), `agent ${f} missing`);
    }
    for (const name of ['sweet', 'sweet-commit', 'sweet-review', 'sweet-help', 'sweet-stats', 'sweet-compress', 'sweetcrew']) {
      assert.ok(fs.existsSync(path.join(ocDir, 'skills', name, 'SKILL.md')), `skill ${name}/SKILL.md missing`);
    }
    assert.ok(fs.existsSync(path.join(ocDir, 'AGENTS.md')), 'AGENTS.md missing');
    const agentsBody = fs.readFileSync(path.join(ocDir, 'AGENTS.md'), 'utf8');
    assert.match(agentsBody, /오빠에게 짧고 다정한 반말로 답한다/);
    // Block must be wrapped in begin/end markers so uninstall can isolate it
    // from user-authored content above and below.
    assert.match(agentsBody, /<!-- sweet-begin -->/);
    assert.match(agentsBody, /<!-- sweet-end -->/);

    const cfgPath = path.join(ocDir, 'opencode.json');
    assert.ok(fs.existsSync(cfgPath), 'opencode.json missing');
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    assert.ok(Array.isArray(cfg.plugin), 'opencode.json missing plugin array');
    assert.ok(cfg.plugin.includes('./plugins/sweet-agent/plugin.js'), 'plugin entry missing');
  } finally {
    fs.rmSync(xdg, { recursive: true, force: true });
    fs.rmSync(shimDir, { recursive: true, force: true });
  }
});

// ── 2. Idempotency: install twice, plugin array stays length 1 ───────────
test('opencode idempotent install does not duplicate plugin entries', () => {
  const xdg = freshTmpDir();
  const shimDir = shimOpencode();
  try {
    const env = { ...process.env, XDG_CONFIG_HOME: xdg, PATH: pathWith(shimDir), NO_COLOR: '1' };
    const r1 = runInstaller(['--only', 'opencode'], env);
    assert.notEqual(r1.status, 2);
    const r2 = runInstaller(['--only', 'opencode'], env);
    assert.notEqual(r2.status, 2);

    const cfg = JSON.parse(fs.readFileSync(path.join(xdg, 'opencode', 'opencode.json'), 'utf8'));
    const matches = cfg.plugin.filter(p => p === './plugins/sweet-agent/plugin.js');
    assert.equal(matches.length, 1, `expected 1 plugin entry, got ${matches.length}`);

    // AGENTS.md should not have the ruleset duplicated either.
    const agentsMd = fs.readFileSync(path.join(xdg, 'opencode', 'AGENTS.md'), 'utf8');
    const sentinelCount = (agentsMd.match(/오빠에게 짧고 다정한 반말로 답한다/g) || []).length;
    assert.equal(sentinelCount, 1, `expected 1 sentinel, got ${sentinelCount}`);
  } finally {
    fs.rmSync(xdg, { recursive: true, force: true });
    fs.rmSync(shimDir, { recursive: true, force: true });
  }
});

// ── 2b. Plugin payload not overwritten on re-install (without --force) ────
test('opencode re-install preserves user edits to plugin.js without --force', () => {
  const xdg = freshTmpDir();
  const shimDir = shimOpencode();
  try {
    const env = { ...process.env, XDG_CONFIG_HOME: xdg, PATH: pathWith(shimDir), NO_COLOR: '1' };
    const r1 = runInstaller(['--only', 'opencode'], env);
    assert.notEqual(r1.status, 2);

    const pluginPath = path.join(xdg, 'opencode', 'plugins', 'sweet', 'plugin.js');
    const tweak = '\n// USER-TWEAK-DO-NOT-OVERWRITE\n';
    fs.appendFileSync(pluginPath, tweak);
    const beforeBytes = fs.readFileSync(pluginPath, 'utf8');

    const r2 = runInstaller(['--only', 'opencode'], env);
    assert.notEqual(r2.status, 2);

    const afterBytes = fs.readFileSync(pluginPath, 'utf8');
    assert.equal(afterBytes, beforeBytes, 'second install should not overwrite plugin.js without --force');
    assert.match(afterBytes, /USER-TWEAK-DO-NOT-OVERWRITE/);

    // With --force, the file should be replaced (no tweak afterward).
    const r3 = runInstaller(['--only', 'opencode', '--force'], env);
    assert.notEqual(r3.status, 2);
    const forced = fs.readFileSync(pluginPath, 'utf8');
    assert.doesNotMatch(forced, /USER-TWEAK-DO-NOT-OVERWRITE/, '--force should overwrite plugin.js');
  } finally {
    fs.rmSync(xdg, { recursive: true, force: true });
    fs.rmSync(shimDir, { recursive: true, force: true });
  }
});

// ── 2c. AGENTS.md fence preserves user content above and below ───────────
test('opencode uninstall strips fenced AGENTS.md block, preserving user prefix and suffix', () => {
  const xdg = freshTmpDir();
  const shimDir = shimOpencode();
  try {
    const env = { ...process.env, XDG_CONFIG_HOME: xdg, PATH: pathWith(shimDir), NO_COLOR: '1' };
    const r1 = runInstaller(['--only', 'opencode'], env);
    assert.notEqual(r1.status, 2);

    const agentsMd = path.join(xdg, 'opencode', 'AGENTS.md');
    const installed = fs.readFileSync(agentsMd, 'utf8');
    // Sandwich the sweet block between user prefix and suffix.
    const userPrefix = '# my project\n\nuse 2-space indent.\n\n';
    const userSuffix = '\n## extra\n\nkeep PRs small.\n';
    fs.writeFileSync(agentsMd, userPrefix + installed.trimEnd() + '\n' + userSuffix);

    const r2 = runInstaller(['--uninstall'], env);
    assert.notEqual(r2.status, 2);

    const after = fs.readFileSync(agentsMd, 'utf8');
    assert.doesNotMatch(after, /<!-- sweet-begin -->/, 'sweet block should be stripped');
    assert.doesNotMatch(after, /<!-- sweet-end -->/, 'sweet end marker should be stripped');
    assert.doesNotMatch(after, /오빠에게 짧고 다정한 반말로 답한다/, 'sweet body should be stripped');
    assert.match(after, /# my project/, 'user prefix should survive');
    assert.match(after, /use 2-space indent/, 'user prefix body should survive');
    assert.match(after, /## extra/, 'user suffix should survive');
    assert.match(after, /keep PRs small/, 'user suffix body should survive');
  } finally {
    fs.rmSync(xdg, { recursive: true, force: true });
    fs.rmSync(shimDir, { recursive: true, force: true });
  }
});

// ── 3. Tolerates JSONC opencode.json (#249-class regression guard) ───────
test('opencode install tolerates JSONC opencode.json (comments + trailing commas)', () => {
  const xdg = freshTmpDir();
  const shimDir = shimOpencode();
  try {
    const ocDir = path.join(xdg, 'opencode');
    fs.mkdirSync(ocDir, { recursive: true });
    fs.writeFileSync(path.join(ocDir, 'opencode.json'),
      `// hand-written
{
  /* user prefs */
  "model": "anthropic/claude-sonnet-4-5",
  "theme": "dark",
}
`);

    const env = { ...process.env, XDG_CONFIG_HOME: xdg, PATH: pathWith(shimDir), NO_COLOR: '1' };
    const r = runInstaller(['--only', 'opencode'], env);
    assert.notEqual(r.status, 2);

    const cfg = JSON.parse(fs.readFileSync(path.join(ocDir, 'opencode.json'), 'utf8'));
    assert.equal(cfg.model, 'anthropic/claude-sonnet-4-5', 'user model setting wiped');
    assert.equal(cfg.theme, 'dark', 'user theme setting wiped');
    assert.ok(cfg.plugin.includes('./plugins/sweet-agent/plugin.js'), 'plugin entry missing');
  } finally {
    fs.rmSync(xdg, { recursive: true, force: true });
    fs.rmSync(shimDir, { recursive: true, force: true });
  }
});

// ── 4. Uninstall removes opencode artifacts and prunes config ────────────
test('opencode uninstall removes plugin dir, command/agent/skill files, prunes opencode.json', () => {
  const xdg = freshTmpDir();
  const shimDir = shimOpencode();
  try {
    const env = { ...process.env, XDG_CONFIG_HOME: xdg, PATH: pathWith(shimDir), NO_COLOR: '1' };
    const r1 = runInstaller(['--only', 'opencode'], env);
    assert.notEqual(r1.status, 2);

    const r2 = runInstaller(['--uninstall'], env);
    assert.notEqual(r2.status, 2);

    const ocDir = path.join(xdg, 'opencode');
    assert.equal(fs.existsSync(path.join(ocDir, 'plugins', 'sweet')), false, 'plugin dir survived');
    assert.equal(fs.existsSync(path.join(ocDir, 'commands', 'sweet.md')), false, 'sweet.md command survived');
    assert.equal(fs.existsSync(path.join(ocDir, 'agents', 'sweetcrew-builder.md')), false, 'sweetcrew agent survived');
    assert.equal(fs.existsSync(path.join(ocDir, 'skills', 'sweet')), false, 'sweet skill dir survived');
    assert.equal(fs.existsSync(path.join(ocDir, 'AGENTS.md')), false, 'AGENTS.md (we wrote it) survived');

    if (fs.existsSync(path.join(ocDir, 'opencode.json'))) {
      const cfg = JSON.parse(fs.readFileSync(path.join(ocDir, 'opencode.json'), 'utf8'));
      const stillHasPlugin = Array.isArray(cfg.plugin) && cfg.plugin.includes('./plugins/sweet-agent/plugin.js');
      assert.equal(stillHasPlugin, false, 'plugin entry survived in opencode.json');
    }
  } finally {
    fs.rmSync(xdg, { recursive: true, force: true });
    fs.rmSync(shimDir, { recursive: true, force: true });
  }
});

// ── 5. Plugin smoke: load installed plugin.js, fire the real opencode hooks ──
// opencode (>= 1.15) has no `tui.prompt.append` or top-level `session.created`
// plugin-hook keys (#418/#421). The plugin now uses `chat.message` for mode
// parsing, `experimental.chat.system.transform` for reinforcement, and the
// `event` dispatcher (filtering event.type === 'session.created') for session
// init. This test drives those real hooks.
test('opencode plugin handles /sweet ultra, stop sweet, and session init via real hooks', async () => {
  const xdg = freshTmpDir();
  const shimDir = shimOpencode();
  const origDefault = process.env.SWEET_DEFAULT_MODE;
  try {
    const env = { ...process.env, XDG_CONFIG_HOME: xdg, PATH: pathWith(shimDir), NO_COLOR: '1' };
    const r = runInstaller(['--only', 'opencode'], env);
    assert.notEqual(r.status, 2);

    const pluginPath = path.join(xdg, 'opencode', 'plugins', 'sweet', 'plugin.js');
    const flagPath = path.join(xdg, 'opencode', '.sweet-active');

    // Set XDG_CONFIG_HOME so the plugin's flagPath resolves to our temp dir,
    // and pin the default mode so session-init is deterministic regardless of
    // any ambient user/repo-local sweet config.
    process.env.XDG_CONFIG_HOME = xdg;
    process.env.SWEET_DEFAULT_MODE = 'full';

    const mod = await import(pathToFileURL(pluginPath).href);
    const factory = mod.default || mod.SweetPlugin;
    const handlers = await factory({});

    // The dead direct-key hooks must NOT be registered.
    assert.equal(handlers['tui.prompt.append'], undefined, 'tui.prompt.append should not exist');
    assert.equal(handlers['session.created'], undefined, 'session.created direct key should not exist');
    assert.equal(typeof handlers.event, 'function', 'event dispatcher should be a function');
    assert.equal(typeof handlers['chat.message'], 'function', 'chat.message should be a function');
    assert.equal(typeof handlers['experimental.chat.system.transform'], 'function',
      'system.transform should be a function');

    // Slash command in a chat.message text part activates ultra.
    await handlers['chat.message']({}, { parts: [{ type: 'text', text: '/sweet ultra' }] });
    assert.equal(fs.readFileSync(flagPath, 'utf8'), 'ultra');

    // opencode expands "/sweet <level>" into the command template before
    // chat.message fires — the level must be recovered from the expanded text.
    await handlers['chat.message']({}, { parts: [{ type: 'text', text:
      'Activate sweet mode: lite\n\nIf no level given, use full. If "off", deactivate.' }] });
    assert.equal(fs.readFileSync(flagPath, 'utf8'), 'lite');
    await handlers['chat.message']({}, { parts: [{ type: 'text', text:
      'Activate sweet mode: off\n\nIf no level given, use full. If "off", deactivate.' }] });
    assert.equal(fs.existsSync(flagPath), false, 'expanded template with off should delete the flag');
    await handlers['chat.message']({}, { parts: [{ type: 'text', text:
      'Activate sweet mode: \n\nIf no level given, use full. If "off", deactivate.' }] });
    assert.equal(fs.readFileSync(flagPath, 'utf8'), 'full', 'expanded template without level uses default');
    await handlers['chat.message']({}, { parts: [{ type: 'text', text: '/sweet ultra' }] });
    assert.equal(fs.readFileSync(flagPath, 'utf8'), 'ultra');

    // opencode's non-interactive `run` path wraps the message in literal
    // quotes ("/sweet lite"\n) — the parser must unwrap them.
    await handlers['chat.message']({}, { parts: [{ type: 'text', text: '"/sweet lite"\n' }] });
    assert.equal(fs.readFileSync(flagPath, 'utf8'), 'lite');
    await handlers['chat.message']({}, { parts: [{ type: 'text', text: '/sweet ultra' }] });
    assert.equal(fs.readFileSync(flagPath, 'utf8'), 'ultra');

    // system.transform injects the reinforcement line while active.
    const sys1 = { system: [] };
    await handlers['experimental.chat.system.transform']({}, sys1);
    assert.equal(sys1.system.length, 1, 'expected one reinforcement line');
    assert.match(sys1.system[0], /SWEET MODE ACTIVE \(ultra\)/);

    // Natural-language deactivation removes the flag.
    await handlers['chat.message']({}, { parts: [{ type: 'text', text: 'stop sweet please' }] });
    assert.equal(fs.existsSync(flagPath), false, 'flag should be deleted after deactivation');

    // No reinforcement injected when inactive.
    const sys2 = { system: [] };
    await handlers['experimental.chat.system.transform']({}, sys2);
    assert.equal(sys2.system.length, 0, 'no reinforcement when flag absent');

    // The `event` dispatcher writes the default mode on session.created, and
    // ignores unrelated event types.
    await handlers.event({ event: { type: 'session.idle' } });
    assert.equal(fs.existsSync(flagPath), false, 'non-session.created event must not write the flag');
    await handlers.event({ event: { type: 'session.created' } });
    assert.equal(fs.readFileSync(flagPath, 'utf8'), 'full');
  } finally {
    if (origDefault === undefined) delete process.env.SWEET_DEFAULT_MODE;
    else process.env.SWEET_DEFAULT_MODE = origDefault;
    fs.rmSync(xdg, { recursive: true, force: true });
    fs.rmSync(shimDir, { recursive: true, force: true });
  }
});
