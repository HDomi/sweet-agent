---
description: 현재 레포에 모든 IDE 에이전트용 상시 스윗 활성화 룰 파일을 심는다
argument-hint: "[--dry-run|--force] [--only <agent>]"
---

현재 레포에 레포별 스윗 룰 파일(Cursor, Windsurf, Cline, Copilot, AGENTS.md)을 쓰고 결과를 보고한다.

init 스크립트 실행 방법 — 먼저 해당되는 것을 고른다:

1. 현재 레포에 `src/tools/sweet-init.js` 가 있으면 (스윗 체크아웃 안에 있는 경우): `node src/tools/sweet-init.js $ARGUMENTS`
2. 없으면 독립 스크립트를 받아서 실행 (자체 완결형이고 stdin 실행 지원): `curl -fsSL https://raw.githubusercontent.com/HDomi/sweet-agent/main/src/tools/sweet-init.js | node - $ARGUMENTS`

사용자가 `--force` 를 안 줬으면 `--dry-run` 을 먼저 쓴다. 기존 룰 파일을 조용히 덮어쓰지 않기 위해서다.
