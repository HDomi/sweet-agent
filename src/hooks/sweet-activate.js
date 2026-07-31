#!/usr/bin/env node
// sweet — Claude Code SessionStart activation hook
//
// Runs on every session start:
//   1. Writes flag file at $CLAUDE_CONFIG_DIR/.sweet-active (statusline reads this)
//   2. Emits sweet ruleset as hidden SessionStart context
//   3. Detects missing statusline config and emits setup nudge

const fs = require('fs');
const path = require('path');
const os = require('os');
const { getDefaultMode, safeWriteFlag, recordModeChange } = require('./sweet-config');

const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const flagPath = path.join(claudeDir, '.sweet-active');
const settingsPath = path.join(claudeDir, 'settings.json');

// Apply per-agent model overrides from env vars before emitting rules.
// Best-effort: any error is swallowed so SessionStart is never blocked.
try {
  const { applyOverrides, resolvePluginRoot } = require('./sweetcrew-model-overrides');
  applyOverrides(resolvePluginRoot(__dirname));
} catch (e) {}

const mode = getDefaultMode();

// "off" mode — skip activation entirely, don't write flag or emit rules
if (mode === 'off') {
  recordModeChange(claudeDir, null); // #601: timestamped transition log
  try { fs.unlinkSync(flagPath); } catch (e) {}
  process.stdout.write('OK');
  process.exit(0);
}

// 1. Write flag file (symlink-safe)
recordModeChange(claudeDir, mode); // #601
safeWriteFlag(flagPath, mode);

// 2. Emit full sweet ruleset, filtered to the active intensity level.
//    The old 2-sentence summary was too weak — models drifted back to verbose
//    mid-conversation, especially after context compression pruned it away.
//    Full rules with examples anchor behavior much more reliably.
//
//    Reads SKILL.md at runtime so edits to the source of truth propagate
//    automatically — no hardcoded duplication to go stale.

// Modes that have their own independent skill files — not sweet intensity levels.
// For these, emit a short activation line; the skill itself handles behavior.
const INDEPENDENT_MODES = new Set(['commit', 'review', 'compress']);

if (INDEPENDENT_MODES.has(mode)) {
  process.stdout.write('SWEET MODE ACTIVE — level: ' + mode + '. Behavior defined by /sweet-' + mode + ' skill.');
  process.exit(0);
}

// Intensity levels have no aliases — the flag value is the label.
const modeLabel = mode;

// Read SKILL.md — the single source of truth for sweet behavior.
// Candidate locations, tried in order (#587/#589 — the old single '..' path
// resolved to <plugin_root>/src/skills/, which doesn't exist, so plugin
// installs silently used the stale fallback ruleset):
//   1. $CLAUDE_PLUGIN_ROOT/skills/sweet/SKILL.md — Claude Code sets
//      CLAUDE_PLUGIN_ROOT when invoking plugin hooks; authoritative when present.
//   2. ../../skills/sweet/SKILL.md — hook at <plugin_root>/src/hooks/
//      (plugin.json layout) or a repo checkout.
//   3. ../skills/sweet/SKILL.md — standalone install with hooks at
//      $CLAUDE_CONFIG_DIR/hooks/ and the skill at $CLAUDE_CONFIG_DIR/skills/sweet/.
// All misses fall through to the hardcoded fallback ruleset below.
const skillCandidates = [];
if (process.env.CLAUDE_PLUGIN_ROOT) {
  skillCandidates.push(path.join(process.env.CLAUDE_PLUGIN_ROOT, 'skills', 'sweet', 'SKILL.md'));
}
skillCandidates.push(
  path.join(__dirname, '..', '..', 'skills', 'sweet', 'SKILL.md'),
  path.join(__dirname, '..', 'skills', 'sweet', 'SKILL.md')
);

let skillContent = '';
for (const candidate of skillCandidates) {
  try {
    skillContent = fs.readFileSync(candidate, 'utf8');
    break;
  } catch (e) { /* try next candidate */ }
}

let output;

if (skillContent) {
  // Strip YAML frontmatter
  const body = skillContent.replace(/^---[\s\S]*?---\s*/, '');

  // Filter intensity table: keep header rows + only the active level's row
  const filtered = body.split('\n').reduce((acc, line) => {
    // Intensity table rows start with | **level** |
    const tableRowMatch = line.match(/^\|\s*\*\*(\S+?)\*\*\s*\|/);
    if (tableRowMatch) {
      // Keep only the active level's row (and always keep header/separator)
      if (tableRowMatch[1] === modeLabel) {
        acc.push(line);
      }
      return acc;
    }

    // Example lines start with "- level:" — keep only lines matching active level
    const exampleMatch = line.match(/^- (\S+?):\s/);
    if (exampleMatch) {
      if (exampleMatch[1] === modeLabel) {
        acc.push(line);
      }
      return acc;
    }

    acc.push(line);
    return acc;
  }, []);

  output = 'SWEET MODE ACTIVE — level: ' + modeLabel + '\n\n' + filtered.join('\n');
} else {
  // Fallback when SKILL.md is not found (standalone hook install without skills dir).
  // This is the minimum viable ruleset — better than nothing.
  output =
    'SWEET MODE ACTIVE — level: ' + modeLabel + '\n\n' +
    '오빠에게 짧고 다정한 반말로 답한다. 기술 내용은 하나도 안 뺀다. 군더더기만 버린다.\n\n' +
    '## 유지\n\n' +
    '응답마다 계속 켜져 있다. 턴 많이 지나도 원래대로 안 돌아간다. 애매하면 켜진 상태로 둔다. 끄는 건 "스윗 끄기" / "normal mode" / "그만" 뿐.\n\n' +
    '현재 강도: **' + modeLabel + '**. 바꾸기: `/sweet lite|full|ultra`.\n\n' +
    '## 규칙\n\n' +
    '산문은 100% 한국어. 오빠가 영어로 물어도 한국어로 답한다. 코드·명령어·파일 경로·에러 문자열·API 이름·함수명·커밋 타입 키워드는 원문 그대로 두고 번역하지 않는다.\n\n' +
    '이 한국어 규칙은 오빠에게 말할 때만 적용된다. 파일에 남는 산문(코드 주석, docstring, 로그·에러 문자열, 테스트 이름, 커밋 메시지, PR 설명, 리포 문서)은 그 프로젝트의 기존 언어 관례를 따른다 — 영어 주석 레포에 한국어 주석을 넣지 않는다.\n\n' +
    '정확도가 토큰보다 위. 압축은 말투에만 적용된다. 확인 안 한 걸 확인한 것처럼 쓰지 않고, 실패한 테스트·에러·건너뛴 작업·남은 위험은 짧게 만들려고 생략하지 않는다.\n\n' +
    '반말. 존댓말 어미(~요/~습니다/~세요) 금지. 호칭 "오빠"는 응답당 0~1번만.\n\n' +
    '버릴 것: 조사(뜻 안 흐려지면), 군더더기(그냥/진짜/사실/좀/일단), 상투어(알겠어/도와줄게/좋은 질문이야), 완충 표현(아마/~인 것 같아). ' +
    '단문 OK. 짧은 동의어. 물결(~) 최대 2개, 이모지 최대 1개. 도구 호출 나레이션·장식 표·화살표(→) 금지. 새 약어 만들지 마라.\n\n' +
    '자기 언급 금지. 모드 이름을 말하거나 알리지 않는다. "스윗 모드 켰어" 같은 말 금지. 압축된 답 하나만 낸다.\n\n' +
    '패턴: `[대상] [상태·원인]. [할 일].`\n\n' +
    '이렇게 안 한다: "네, 도와드릴게요! 지금 겪고 계신 문제는 아마도 인증 미들웨어가..."\n' +
    '이렇게 한다: "인증 미들웨어 버그야. 만료 검사가 `<=` 말고 `<` 써야 해. 고칠 부분:"\n\n' +
    '## 자동 명확화\n\n' +
    '압축과 애교를 끄는 경우: 보안 경고, 되돌릴 수 없는 작업 확인, 순서를 잘못 읽을 위험이 있는 다단계 절차, 오빠가 못 알아듣거나 같은 질문을 다시 할 때. 완전한 문장으로 쓰고, 끝나면 복귀.\n\n' +
    '## 경계\n\n' +
    '코드·커밋 메시지·PR 설명은 평문. "스윗 끄기" / "normal mode" / "그만" 하면 해제. 강도는 바꾸거나 세션 끝날 때까지 유지.';
}

// 3. Detect missing statusline config — nudge Claude to help set it up
try {
  let hasStatusline = false;
  if (fs.existsSync(settingsPath)) {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    if (settings.statusLine) {
      hasStatusline = true;
    }
  }

  if (!hasStatusline) {
    const isWindows = process.platform === 'win32';
    const scriptName = isWindows ? 'sweet-statusline.ps1' : 'sweet-statusline.sh';
    const scriptPath = path.join(__dirname, scriptName);
    const command = isWindows
      ? `powershell -ExecutionPolicy Bypass -File "${scriptPath}"`
      : `bash "${scriptPath}"`;
    const statusLineSnippet =
      '"statusLine": { "type": "command", "command": ' + JSON.stringify(command) + ' }';
    output += "\n\n" +
      "STATUSLINE SETUP NEEDED: The sweet plugin includes a statusline badge showing active mode " +
      "(e.g. [SWEET], [SWEET:ULTRA]). It is not configured yet. " +
      "To enable, add this to " + path.join(claudeDir, 'settings.json') + ": " +
      statusLineSnippet + " " +
      "Proactively offer to set this up for the user on first interaction.";
  }
} catch (e) {
  // Silent fail — don't block session start over statusline detection
}

process.stdout.write(output);
