#!/usr/bin/env node
// sweet init — drop the always-on sweet activation rule into a target
// repo for every IDE agent we support. Idempotent. Safe to re-run.
//
// Usage:
//   node src/tools/sweet-init.js [target-dir] [--dry-run] [--force] [--only <agent>]
//   curl -fsSL https://raw.githubusercontent.com/HDomi/sweet-agent/main/src/tools/sweet-init.js | node - [args]
//
// Without args, runs in cwd. Generates the rule files for Cursor, Windsurf,
// Cline, Copilot, and AGENTS.md. Does NOT modify CLAUDE.md or compress
// existing memory files — that's the job of `/sweet:compress`.

const fs = require('fs');
const path = require('path');

// Embedded so the tool works standalone (npx-style) without the src/rules/ dir.
// Mirrors src/rules/sweet-activate.md verbatim — keep these in sync.
const RULE_BODY = `오빠에게 짧고 다정한 반말로 답한다. 기술 내용은 하나도 안 뺀다. 군더더기만 버린다.

규칙:
- 산문은 100% 한국어. 영어로 물어도 한국어로 답한다
- 반말. 존댓말 어미(~요/~습니다/~세요) 금지. 호칭 "오빠"는 응답당 0~1번만
- 버릴 것: 조사(뜻 안 흐려지면), 군더더기(그냥/진짜/사실/좀), 상투어(알겠어/도와줄게), 완충 표현(아마/~인 것 같아)
- 단문 OK. 짧은 동의어. 물결 최대 2개, 이모지 최대 1개
- 코드·명령어·파일 경로·에러 문자열·API 이름은 원문 그대로. 새 약어 만들지 마라
- 파일에 남는 산문(코드 주석, docstring, 로그 문자열, 테스트 이름, 커밋 메시지, PR 설명, 리포 문서)은 그 프로젝트의 기존 언어 관례를 따른다. 영어 주석 레포에 한국어 주석 넣지 마라
- 압축은 말투에만. 확인 안 한 걸 확인한 것처럼 쓰지 않고, 실패·에러·건너뛴 작업은 짧게 만들려고 생략하지 않는다
- 패턴: [대상] [상태·원인]. [할 일].
- 이렇게 안 한다: "네, 도와드릴게요! 아마도 문제는..."
- 이렇게 한다: "인증 미들웨어 버그야. 고칠 부분:"

강도 바꾸기: /sweet lite|full|ultra
끄기: "스윗 끄기" / "normal mode" / "그만"

자동 명확화: 보안 경고, 되돌릴 수 없는 작업, 순서 중요한 다단계 절차, 오빠가 못 알아들었을 때는 압축·애교 끄고 완전한 문장으로. 끝나면 복귀.

경계: 코드·커밋 메시지·PR 설명은 평문.
`;

const SENTINEL = '오빠에게 짧고 다정한 반말로 답한다';

// OpenClaw is a global workspace tool (not per-repo) and needs two write
// targets — a skill folder + a SOUL.md bootstrap block. The shared helper
// lives at bin/lib/openclaw.js; we require it lazily so sweet-init.js
// keeps working when run standalone (curl|node) without the helper on disk.
function loadOpenclawHelper() {
  try {
    return require(path.join(__dirname, '..', '..', 'bin', 'lib', 'openclaw.js'));
  } catch (_) { return null; }
}

const AGENTS = [
  { id: 'cursor',   file: '.cursor/rules/sweet.mdc',
    frontmatter: '---\ndescription: "스윗 모드 — 짧고 다정한 한국어 반말. 출력 토큰 절약, 기술 정확도 유지"\nalwaysApply: true\n---\n\n',
    mode: 'replace' },
  { id: 'windsurf', file: '.windsurf/rules/sweet.md',
    frontmatter: '---\ntrigger: always_on\n---\n\n',
    mode: 'replace' },
  { id: 'cline',    file: '.clinerules/sweet.md',
    frontmatter: '',
    mode: 'replace' },
  { id: 'copilot',  file: '.github/copilot-instructions.md',
    frontmatter: '',
    mode: 'append' },
  { id: 'opencode', file: '.opencode/AGENTS.md',
    frontmatter: '',
    mode: 'append' },
  { id: 'agents',   file: 'AGENTS.md',
    frontmatter: '',
    mode: 'append' },
  // OpenClaw — global workspace install, not per-repo. The `installer`
  // callback escape hatch bypasses the file/frontmatter/mode triple and
  // hands off to the shared helper. `description` is what `--help` prints.
  { id: 'openclaw', description: '~/.openclaw/workspace/{skills/sweet/, SOUL.md}',
    installer: 'openclaw' },
];

function loadRuleBody() {
  // Prefer the in-repo source-of-truth when available.
  try {
    const local = path.join(__dirname, '..', 'rules', 'sweet-activate.md');
    if (fs.existsSync(local)) return fs.readFileSync(local, 'utf8').trimEnd() + '\n';
  } catch (e) {}
  return RULE_BODY;
}

function processAgent(agent, targetDir, ruleBody, opts) {
  if (agent.installer === 'openclaw') {
    return processOpenclaw(opts);
  }
  const fullPath = path.join(targetDir, agent.file);
  const exists = fs.existsSync(fullPath);

  if (!exists) {
    if (!opts.dryRun) {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, agent.frontmatter + ruleBody, { mode: 0o644 });
    }
    return { status: 'added', label: '+' };
  }

  const existing = fs.readFileSync(fullPath, 'utf8');
  if (existing.includes(SENTINEL)) {
    return { status: 'skipped-already-installed', label: '=' };
  }

  if (agent.mode === 'append') {
    if (!opts.dryRun) {
      const sep = existing.endsWith('\n\n') ? '' : (existing.endsWith('\n') ? '\n' : '\n\n');
      fs.writeFileSync(fullPath, existing + sep + ruleBody, { mode: 0o644 });
    }
    return { status: 'appended', label: '~' };
  }

  if (opts.force) {
    if (!opts.dryRun) {
      fs.writeFileSync(fullPath, agent.frontmatter + ruleBody, { mode: 0o644 });
    }
    return { status: 'overwritten', label: '!' };
  }

  return { status: 'skipped-exists', label: '?' };
}

function processOpenclaw(opts) {
  const helper = loadOpenclawHelper();
  if (!helper) {
    return {
      status: 'unsupported-standalone',
      label: 'x',
      detail: '~/.openclaw/workspace (helper unavailable in standalone curl|node mode — use `npx -y github:HDomi/sweet-agent -- --only openclaw`)',
    };
  }
  const repoRoot = path.resolve(__dirname, '..', '..');
  const log = {
    write: (_) => {},
    note: (_) => {},
    warn: (_) => {},
  };
  const r = helper.installOpenclaw({
    workspace: process.env.OPENCLAW_WORKSPACE || undefined,
    repoRoot,
    dryRun: opts.dryRun,
    force: opts.force,
    log,
  });
  if (!r.ok) {
    return { status: 'skipped-' + (r.reason || 'failed'), label: '?', detail: helper.resolveWorkspace ? helper.resolveWorkspace() : '~/.openclaw/workspace' };
  }
  if (r.dryRun) return { status: 'would-add', label: '+', detail: helper.resolveWorkspace() };
  return { status: 'installed', label: '+', detail: helper.resolveWorkspace() };
}

function parseArgs(argv) {
  const opts = { dryRun: false, force: false, only: null, target: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--force' || a === '-f') opts.force = true;
    else if (a === '--only') { opts.only = argv[++i]; }
    else if (a === '-h' || a === '--help') opts.help = true;
    else if (!a.startsWith('-')) opts.target = path.resolve(a);
  }
  return opts;
}

function help() {
  console.log(`sweet init — drop always-on sweet rule into a target repo

Usage: sweet-init.js [target-dir] [--dry-run] [--force] [--only <agent>]

Defaults to current working directory. Idempotent — safe to re-run.

Targets installed:
${AGENTS.map(a => `  ${a.id.padEnd(10)} ${a.file || a.description || ''}`).join('\n')}

Flags:
  --dry-run   show what would change, do not write
  --force     overwrite existing rule files (default: skip)
  --only <id> only install for one agent (id from list above)
`);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { help(); return; }

  console.log(`🪨 sweet init — ${opts.target}${opts.dryRun ? ' (dry run)' : ''}\n`);

  const ruleBody = loadRuleBody();
  const counts = { added: 0, appended: 0, overwritten: 0, skipped: 0 };

  for (const agent of AGENTS) {
    if (opts.only && opts.only !== agent.id) continue;
    const result = processAgent(agent, opts.target, ruleBody, opts);
    const target = agent.file || result.detail || agent.description || agent.id;
    console.log(`  ${result.label} ${target} (${result.status})`);
    if (result.status === 'added' || result.status === 'installed' || result.status === 'would-add') counts.added++;
    else if (result.status === 'appended') counts.appended++;
    else if (result.status === 'overwritten') counts.overwritten++;
    else counts.skipped++;
  }

  console.log(`\n${counts.added} added, ${counts.appended} appended, ` +
              `${counts.overwritten} overwritten, ${counts.skipped} skipped`);
  if (opts.dryRun) console.log('(dry run — no files were written)');
}

// Run when executed directly AND when piped via `curl … | node -` (the
// documented standalone path, #603): under stdin execution require.main is
// undefined and module.id is '[stdin]', so the classic guard alone silently
// no-ops with exit code 0 — the worst kind of failure.
if (require.main === module || (!require.main && module.id === '[stdin]')) main();

module.exports = { processAgent, loadRuleBody, AGENTS, SENTINEL, RULE_BODY };
