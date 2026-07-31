#!/usr/bin/env node
// sweet — UserPromptSubmit hook to track which sweet mode is active
// Inspects user input for /sweet commands and writes mode to flag file

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { getDefaultMode, safeWriteFlag, readFlag, recordModeChange, VALID_MODES } = require('./sweet-config');

// Modes handled by their own slash commands (/sweet-commit, etc.) — not
// selectable via /sweet <arg>.
const INDEPENDENT_MODES = new Set(['commit', 'review', 'compress']);

const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const flagPath = path.join(claudeDir, '.sweet-active');
// Remembers the prose mode active before a one-shot independent mode
// (/sweet-commit etc.) so the next ordinary prompt can restore it (#599).
const prevPath = path.join(claudeDir, '.sweet-active.prev');

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
// Abnormal stdin close (broken pipe, parent crash) emits 'error'; without a
// listener Node throws it as an uncaught exception and the hook exits
// non-zero — a spurious hook failure (#538). Hooks must always exit 0.
process.stdin.on('error', () => process.exit(0));
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    // Collapse whitespace so phrase triggers still match multiline prompts —
    // every regex below sees a single-line prompt (#598).
    const prompt = (data.prompt || '').trim().toLowerCase().replace(/\s+/g, ' ');

    // Deactivation intent — computed FIRST so "turn sweet mode off" never
    // falls through to the activation patterns (#598: the old contiguous
    // "turn off" phrasing missed the "turn X off" word order entirely, and
    // the activation regex then re-armed sweet at the default level).
    const wantsOff =
      /\b(stop|disable|deactivate|quit|exit|kill)\s+(the\s+)?sweet\b/.test(prompt) ||
      /\bsweet(\s+mode)?\s+(off|stop|disabled?)\b/.test(prompt) ||
      /\bturn\s+off\s+(the\s+)?sweet\b/.test(prompt) ||
      // "normal mode" only as a command (prompt-initial, optionally led by a
      // switch-back verb) or with sweet context — never mid-sentence for
      // e.g. vim's normal mode ("how do I exit vim normal mode").
      /^(please\s+)?(go\s+|back\s+to\s+|switch\s+(back\s+)?to\s+|return\s+to\s+)?normal\s+mode\b/.test(prompt) ||
      (/\bnormal\s+mode\b/.test(prompt) && /\bsweet\b/.test(prompt)) ||
      // Korean deactivation. "그만" alone is ordinary Korean mid-sentence
      // ("그만하고 다음 파일 봐"), so bare 그만 only counts prompt-initial.
      // Avoid \b next to Hangul — JS \w excludes Hangul, so the boundary
      // lands in surprising places. Use explicit suffix alternatives instead.
      /(스윗|스위트)\s*(모드)?\s*(끄기|꺼줘|꺼|끄고|해제|그만|중단|off)/.test(prompt) ||
      /(일반|보통|평소)\s*모드/.test(prompt) ||
      /존댓말(로|으로)?\s*(해|말해|답해|바꿔|써)/.test(prompt) ||
      /^(스윗\s*)?그만\s*(해|하자|해줘)?\s*[.!]*$/.test(prompt);

    // Questions about sweet are not activation commands
    // ("what is sweet mode?", "does sweet lite drop articles?").
    const isQuestion =
      /^(what|whats|what's|how|why|when|where|who|does|do|did|is|are|can|could|would|should|tell me|explain)\b/.test(prompt) ||
      // Korean equivalent, scoped to prompts that actually name the mode —
      // a bare "반말로 설명해줘" is an activation request, not a question
      // about sweet, so the question filter must not swallow it.
      (/(스윗|스위트)/.test(prompt) &&
        /(뭐야|뭔데|무엇|뭐지|어떻게|어떤|어떡|왜|인가|맞아|\?)/.test(prompt));

    // Natural language activation (e.g. "activate sweet", "turn on sweet
    // mode", "talk like sweet"). README tells users they can say these.
    // Also brevity requests ("less tokens", "be brief/terse", "fewer tokens",
    // "shorter answers") — but not when scoped to a single section
    // ("be brief in the summary"), which is a one-off instruction, not a
    // session-wide mode switch.
    if (!wantsOff && !isQuestion) {
      if (/\b(activate|enable|start|turn on|use|switch to|want|give me)\b[^.]{0,40}\bsweet\b/.test(prompt) ||
          /\btalk like\b[^.]{0,40}\bsweet\b/.test(prompt) ||
          /\bsweet\s+mode\s+(on|please|now)\b/.test(prompt) ||
          /^sweet(\s+mode)?\s*[.!]*$/.test(prompt) ||
          /\b(less tokens|fewer tokens|be brief|be terse|shorter answers)\b(?!\s+(in|for|on|about|when|during|with)\b)/.test(prompt) ||
          // Korean activation. README promises these phrases.
          /(스윗|스위트)\s*(모드)?\s*(켜|켜줘|활성|시작|on)/.test(prompt) ||
          /^(스윗|스위트)(\s*모드)?\s*[.!]*$/.test(prompt) ||
          /(다정하게|귀엽게|애교|사근사근)\s*(말해|답해|얘기해|해줘|해)/.test(prompt) ||
          /반말(로|루)?\s*(해|말해|답해|얘기해|해줘|써)/.test(prompt) ||
          /(짧게|간단히|간결하게|간략히)\s*(말해|답해|얘기해|대답|해줘)/.test(prompt) ||
          /토큰\s*(좀\s*)?(아껴|아끼|절약|줄여)/.test(prompt)) {
        const mode = getDefaultMode();
        if (mode !== 'off') {
          recordModeChange(claudeDir, mode); // #601: timestamped transition log
          safeWriteFlag(flagPath, mode);
        }
      }
    }

    // /sweet-stats [--share] — block the prompt and inject stats output as
    // the hook's reason. The script reads the active session log, so we pass
    // transcript_path through when Claude Code provides it.
    const statsMatch = /^\/sweet(?::sweet)?-stats(?:\s+(.*))?$/.exec(prompt);
    if (statsMatch) {
      const tailArgs = (statsMatch[1] || '').trim().split(/\s+/).filter(Boolean);
      try {
        const statsPath = path.join(__dirname, 'sweet-stats.js');
        const argv = [statsPath];
        if (data.transcript_path) argv.push('--session-file', data.transcript_path);
        if (tailArgs.includes('--share')) argv.push('--share');
        if (tailArgs.includes('--all')) argv.push('--all');
        const sinceIdx = tailArgs.indexOf('--since');
        if (sinceIdx !== -1 && tailArgs[sinceIdx + 1]) {
          argv.push('--since', tailArgs[sinceIdx + 1]);
        }
        const out = execFileSync(process.execPath, argv, { encoding: 'utf8', timeout: 5000 });
        process.stdout.write(JSON.stringify({ decision: 'block', reason: out.trim() }));
      } catch (e) {
        process.stdout.write(JSON.stringify({
          decision: 'block',
          reason: 'sweet-stats: could not run stats script.\nTry manually: node hooks/sweet-stats.js'
        }));
      }
      return;
    }

    // Match /sweet commands. Independent one-shot modes remember the prose
    // mode active before them so the next ordinary prompt restores it (#599)
    // — SKILL.md promises "Level persist until changed or session end", and a
    // one-shot skill invocation should not count as "changed" forever.
    let setIndependentThisTurn = false;
    if (prompt.startsWith('/sweet')) {
      const parts = prompt.split(/\s+/);
      const cmd = parts[0]; // /sweet, /sweet-commit, /sweet-review, etc.
      const arg = parts[1] || '';

      let mode = null;

      // Marketplace plugin installs surface commands namespaced as
      // /sweet:sweet-<name> — accept both forms for every skill (#599:
      // only compress and stats had the namespaced variant).
      if (cmd === '/sweet-commit' || cmd === '/sweet:sweet-commit') {
        mode = 'commit';
      } else if (cmd === '/sweet-review' || cmd === '/sweet:sweet-review') {
        mode = 'review';
      } else if (cmd === '/sweet-compress' || cmd === '/sweet:sweet-compress') {
        mode = 'compress';
      } else if (cmd === '/sweet' || cmd === '/sweet:sweet') {
        // Bare /sweet → activate at configured default
        if (!arg) {
          mode = getDefaultMode();
        } else if (arg === 'off' || arg === 'stop' || arg === 'disable') {
          mode = 'off';
        } else if (VALID_MODES.includes(arg) && !INDEPENDENT_MODES.has(arg)) {
          mode = arg;
        }
        // Unknown arg → mode stays null, flag untouched (no silent overwrite)
      }

      if (mode && mode !== 'off') {
        if (INDEPENDENT_MODES.has(mode)) {
          // Save the prose mode being displaced — but never overwrite an
          // already-saved one with another independent mode (/sweet-commit
          // followed by /sweet-review must still restore the original).
          const current = readFlag(flagPath);
          if (current && !INDEPENDENT_MODES.has(current)) {
            safeWriteFlag(prevPath, current);
          }
          setIndependentThisTurn = true;
        }
        recordModeChange(claudeDir, mode); // #601
        safeWriteFlag(flagPath, mode);
      } else if (mode === 'off') {
        recordModeChange(claudeDir, null); // #601
        try { fs.unlinkSync(flagPath); } catch (e) {}
        try { fs.unlinkSync(prevPath); } catch (e) {}
      }
    }

    // Apply deactivation detected above
    if (wantsOff) {
      recordModeChange(claudeDir, null); // #601
      try { fs.unlinkSync(flagPath); } catch (e) {}
      try { fs.unlinkSync(prevPath); } catch (e) {}
    }

    // Per-turn reinforcement: emit a structured reminder when sweet is active.
    // The SessionStart hook injects the full ruleset once, but models lose it
    // when other plugins inject competing style instructions every turn.
    // This keeps sweet visible in the model's attention on every user message.
    //
    // Skip independent modes (commit, review, compress) — they have their own
    // skill behavior and the base sweet rules would conflict.
    // readFlag enforces symlink-safe read + size cap + VALID_MODES whitelist.
    // If the flag is missing, corrupted, oversized, or a symlink pointing at
    // something like ~/.ssh/id_rsa, readFlag returns null and we emit nothing
    // — never inject untrusted bytes into model context.
    let activeMode = readFlag(flagPath);

    // One-shot restore (#599): an independent mode set on a PREVIOUS prompt
    // has served its turn — bring back the prose mode that was active before
    // it, or deactivate if sweet wasn't active then.
    if (activeMode && INDEPENDENT_MODES.has(activeMode) && !setIndependentThisTurn) {
      const prev = readFlag(prevPath);
      try { fs.unlinkSync(prevPath); } catch (e) {}
      if (prev && !INDEPENDENT_MODES.has(prev)) {
        recordModeChange(claudeDir, prev); // #601
        safeWriteFlag(flagPath, prev);
        activeMode = prev;
      } else {
        recordModeChange(claudeDir, null); // #601
        try { fs.unlinkSync(flagPath); } catch (e) {}
        activeMode = null;
      }
    }

    if (activeMode && !INDEPENDENT_MODES.has(activeMode)) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext: "SWEET MODE ACTIVE (" + activeMode + "). " +
            "한국어 반말로만 답한다. 호칭 '오빠'는 응답당 0~1번. " +
            "조사·군더더기·상투어·완충 표현 버린다. 단문 OK. " +
            "코드·커밋 메시지·보안 경고는 평문."
        }
      }));
    }
  } catch (e) {
    // Silent fail
  }
});
