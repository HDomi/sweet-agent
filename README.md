<p align="center">
  <strong>말 짧게 해도 다 알아들어</strong>
</p>

<p align="center">
  AI 코딩 에이전트가 20대 여자애처럼 다정한 반말로 답하게 만든다.<br>
  답은 똑같이 정확하고, <strong>말은 짧아진다</strong>. 머리는 그대로, 입만 작아짐.
</p>

<p align="center">
  <a href="./INSTALL.md"><img src="https://img.shields.io/badge/%EC%A7%80%EC%9B%90-30%2B%20%EC%97%90%EC%9D%B4%EC%A0%84%ED%8A%B8-ff69b4?style=flat" alt="30+ 에이전트"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat" alt="License"></a>
</p>

<p align="center">
  <a href="#before--after">보기</a> ·
  <a href="#설치">설치</a> ·
  <a href="#강도-고르기">강도</a> ·
  <a href="#뭐가-들어있나">기능</a> ·
  <a href="#숫자에-대해">숫자</a> ·
  <a href="#어떻게-동작하나">동작 방식</a>
</p>

---

sweet-agent 는 [Claude Code](https://docs.anthropic.com/en/docs/claude-code), Codex, Gemini CLI, Cursor, Windsurf, Cline, Copilot 등 30여 개 에이전트용 스킬/플러그인이다. 한 번 설치하면 에이전트가 군더더기를 버리고 짧은 한국어 반말로 답한다. 코드, 명령어, 에러 메시지는 한 글자도 안 바뀐다.

## Before / After

<table>
<tr>
<th width="50%">🗣️ 평범한 에이전트</th>
<th width="50%">🍬 sweet-agent</th>
</tr>
<tr>
<td valign="top">

> React 컴포넌트가 리렌더링되는 이유는 렌더링 사이클마다 새로운 객체 참조가 생성되고 있기 때문일 가능성이 높습니다. 인라인 객체를 prop으로 전달하면 React의 얕은 비교가 매번 다른 객체로 인식하여 리렌더링이 발생합니다. useMemo를 사용해 객체를 메모이제이션하는 것을 권장합니다.

</td>
<td valign="top">

> 렌더마다 새 객체 참조 생겨. 인라인 객체 prop = 새 참조 = 리렌더. `useMemo`로 감싸 오빠~

</td>
</tr>
<tr>
<td valign="top">

> 네! 기꺼이 도와드리겠습니다. 지금 겪고 계신 문제는 인증 미들웨어가 토큰 만료를 제대로 검증하지 않아서 발생한 것으로 보입니다. 제가 한번 살펴보고 수정 방안을 제안해 드리겠습니다.

</td>
<td valign="top">

> 인증 미들웨어 버그야. 만료 검사가 `<=` 말고 `<` 써야 해. 고칠 부분:

</td>
</tr>
</table>

같은 내용. 3분의 1 길이. 기술적으로 빠진 것 없음.

머리를 작게 만드는 게 아니다. *입*을 작게 만드는 거다. 에이전트가 **아는 것**이 아니라 **말하는 것**만 줄인다.

## 설치

**명령 하나. 컴퓨터에 있는 에이전트를 찾아서 각각 설치한다.**

```bash
# macOS · Linux · WSL · Git Bash
curl -fsSL https://raw.githubusercontent.com/HDomi/sweet-agent/main/install.sh | bash
```

```powershell
# Windows · PowerShell 5.1+
irm https://raw.githubusercontent.com/HDomi/sweet-agent/main/install.ps1 | iex
```

30초 정도. Node 18 이상 필요. 없는 에이전트는 건너뛴다. 여러 번 실행해도 안전하다.

> [!TIP]
> **켜기:** `/sweet` 또는 *"다정하게 말해"*, *"반말로 해"*. **끄기:** *"스윗 끄기"*, *"그만"*, *"normal mode"*. Claude Code, Codex, Gemini, opencode, OpenClaw 에서는 첫 메시지부터 이미 켜져 있다.

<details>
<summary><strong>에이전트 하나만 설치하거나, 30여 개 중에 골라 설치</strong></summary>

<br>

에이전트마다 경로가 다르다 (플러그인, 확장, 룰 파일, `npx skills add`). 에이전트별 전체 표, 모든 플래그, dry-run, 삭제는 **[INSTALL.md](./INSTALL.md)** 에 있다. 자주 쓰는 것 몇 개:

```bash
# 무엇이 설치될지 먼저 보기 (아무것도 안 씀)
curl -fsSL https://raw.githubusercontent.com/HDomi/sweet-agent/main/install.sh | bash -s -- --dry-run

# Gemini CLI 확장
gemini extensions install https://github.com/HDomi/sweet-agent

# Cursor / Windsurf / Cline / Codex 등 30여 개, skills 레지스트리 경유
npx skills add HDomi/sweet-agent -a cursor
```

</details>

> [!NOTE]
> **Claude Code 는 플러그인으로 설치하는 게 좋다.** 플러그인은 레포 루트의 전체 규칙 파일을 읽는다. 위 설치 스크립트가 쓰는 독립 훅 방식은 훅 파일만 복사하고 스킬은 안 옮겨서, 축약된 규칙만 들어간다(33줄 vs 66줄). 축약본에도 반말·오빠 호칭·자동 명확화는 있지만 강도별 표와 예시가 빠진다.
>
> ```bash
> claude plugin marketplace add HDomi/sweet-agent && claude plugin install sweet@sweet
> ```
>
> 독립 훅 방식으로 이미 설치했다면 `cp -R skills/sweet ~/.claude/skills/sweet` 로 전체 규칙을 채울 수 있다. 어느 쪽이든 **새 세션**을 시작해야 적용된다.

## 강도 고르기

3단계. `/sweet <강도>` 로 언제든 바꾼다. 바꾸거나 세션이 끝날 때까지 유지된다.

| 강도 | 같은 문장, 줄어든 모습 |
|---|---|
| *평범한 에이전트* | 렌더링마다 새로운 참조가 생성되므로, 객체를 `useMemo`로 감싸시는 것이 좋습니다. |
| `lite` | 렌더할 때마다 새 참조가 생겨. `useMemo`로 감싸면 돼~ |
| `full` *(기본)* | 렌더마다 새 참조 생겨. `useMemo`로 감싸 오빠~ |
| `ultra` | 렌더마다 새 참조. `useMemo`. |

`lite` 는 조사와 완결 문장을 유지하고 군더더기만 버린다. `full` 은 조사를 생략하고 단문을 쓴다. `ultra` 는 호칭·물결·이모지까지 다 빼고 최대로 압축한다.

> [!NOTE]
> **한국어 전용이다.** 영어로 물어도 한국어로 답한다. 대신 코드, 명령어, 파일 경로, 에러 문자열, API·함수·변수 이름, 커밋 타입 키워드(`feat`/`fix`/...)는 원문 그대로 둔다. 압축하는 건 *말투*고, 기술 용어는 절대 번역하지 않는다.

## 뭐가 들어있나

| 명령 | 뭐 하나 |
|---|---|
| `/sweet [lite\|full\|ultra]` | 모든 답을 압축한다. 강도는 세션 동안 유지. |
| `/sweet-commit` | Conventional Commits 형식 한국어 커밋 메시지, 제목 50자 이내. 무엇보다 왜. |
| `/sweet-review` | 한 줄 PR 코멘트: `L42: 🔴 버그: user null. 가드 추가.` |
| `/sweet-stats` | 이번 세션 실제 토큰 사용량. `--share` 로 공유용 한 줄. |
| `/sweet-compress <파일>` | `CLAUDE.md` 같은 메모리 파일을 압축본으로 다시 쓴다. **이후 모든 세션에서** 입력 토큰이 줄어든다. 코드·URL·경로는 바이트 단위 보존. |
| `/sweet-help` | 강도, 명령어, 트리거 참조 카드. |
| `sweet-shrink` | MCP 미들웨어. 아무 MCP 서버나 감싸서 tool description 을 압축한다. `src/mcp-servers/sweet-shrink/` 에 소스가 있고, npm 에는 아직 배포 안 됨. |
| `sweetcrew-*` | 스윗 서브에이전트 (investigator, builder, reviewer). 출력이 압축돼서 메인 컨텍스트가 더 오래 버틴다. |

> [!TIP]
> Claude Code 에서는 상태 표시줄에 `[SWEET]` 이 뜬다. `/sweet-stats` 를 한 번 이상 돌리고 압축률을 설정하면 누적 절감 토큰(`⛏ 12.4k`)이 뒤에 붙는다. `SWEET_STATUSLINE_SAVINGS=0` 으로 끌 수 있다.

## 숫자에 대해

**아직 측정 안 했다.** 이 프로젝트는 영어 caveman 스킬에서 갈라져 나왔고, 원본에는 "출력 토큰 65% 절감" 이라는 측정치가 있었다. 그 숫자는 **영어** 압축 문체를 측정한 값이라 한국어 반말에 그대로 적용되지 않는다. 근거 없는 숫자를 옮겨 적지 않기로 했으므로 지웠다.

한국어 압축률을 직접 재려면:

```bash
# ANTHROPIC_API_KEY 를 .env.local 에 넣고
uv run python benchmarks/run.py
```

결과는 `benchmarks/results/*.json` 에 저장된다. 그다음 `/sweet-stats` 에 압축률을 알려주면 절감 추정치가 나온다:

```bash
export SWEET_COMPRESSION_RATIOS='{"full":0.65}'   # 직접 측정한 값으로
```

측정된 값이 없으면 `/sweet-stats` 는 실제 토큰 수만 보여주고 절감 추정은 생략한다. 추측한 숫자를 내놓지 않는다.

`evals/` 에는 3-arm 평가 하네스가 있다. 정직한 비교 대상은 **스킬 vs "간결하게 답해"** 지, 아무 지시도 없는 기본값이 아니다. 기본값과 비교하면 스킬 효과와 일반적인 간결함이 뒤섞인다.

> [!IMPORTANT]
> **줄어드는 건 출력 토큰뿐이다.** 입력 토큰과 추론 토큰은 그대로고, 스킬 자체가 매 턴 입력 토큰을 추가한다. 그래서 세션 전체 절감은 출력 절감률보다 작고, 이미 짧게 답하는 작업에서는 오히려 마이너스가 될 수도 있다. 진짜 이득은 **읽기 편하고 빠르다**는 것이고, 비용 절감은 보너스다. 자세한 내용: **[docs/HONEST-NUMBERS.md](./docs/HONEST-NUMBERS.md)**.

## 어떻게 동작하나

1. 설치 스크립트가 에이전트에 스킬 파일을 넣는다.
2. 스킬이 에이전트에게 지시한다: 군더더기 버리고, 내용은 지키고, 단문 써라 — 단 코드·명령어·에러는 절대 건드리지 마라.
3. Claude Code 에서는 훅이 세션마다 작은 플래그 파일을 써서, `/sweet` 없이 첫 메시지부터 스윗 말투로 답한다.
4. `/sweet-stats` 가 세션 로그를 읽어 실제 토큰 수를 세고 상태 표시줄에 쓴다.
5. `/sweet-compress` 가 `CLAUDE.md` 같은 메모리 파일을 다시 써서, 이후 모든 세션이 더 작은 컨텍스트로 시작한다.

훅 구조, 파일 소유권, CI 동기화는 유지보수용으로 [CLAUDE.md](./CLAUDE.md) 에 정리돼 있다.

## 자동으로 압축을 끄는 경우

압축된 반말이 위험해지는 지점이 있다. 이때는 스킬이 알아서 완전한 문장으로 돌아간다:

- 보안 경고
- 되돌릴 수 없는 작업 확인 (`DROP TABLE`, `rm -rf`, force push, 배포, 과금)
- 순서를 잘못 읽으면 안 되는 다단계 절차
- 압축 자체가 기술적 모호함을 만들 때
- 사용자가 못 알아들어서 같은 질문을 다시 할 때

코드, 커밋 메시지, PR 설명은 항상 평문으로 쓴다.

## 개인정보

서버로 아무것도 안 보낸다. 텔레메트리, 분석, 계정, 백엔드 전부 없다. 설치 후에는 네트워크 호출이 0이다 — 스킬은 그냥 프롬프트고, 훅은 로컬 스크립트고, `/sweet-stats` 는 이미 디스크에 있는 로그를 읽는다. 설치할 때 발생하는 네트워크 요청(GitHub, 각 에이전트의 레지스트리)은 [SECURITY.md](./SECURITY.md#privacy--telemetry) 에 적혀 있다.

## 유래

sweet-agent 는 Julius Brussee 의 [caveman](https://github.com/JuliusBrussee/caveman) (MIT) 에서 갈라져 나왔다. 압축 스킬 구조, 훅 아키텍처, 30여 개 에이전트 설치 매트릭스는 그쪽 작업이다. 이 레포는 페르소나를 한국어 반말로 바꾸고, 문언문 강도를 없애고, 측정되지 않은 숫자를 지웠다. 원본 MIT 저작권 표시는 [LICENSE](./LICENSE) 에 그대로 유지한다.

---

<sub>
<strong>문서:</strong>
<a href="./INSTALL.md">설치 매트릭스</a> ·
<a href="./docs/HONEST-NUMBERS.md">숫자에 대해</a> ·
<a href="./CONTRIBUTING.md">기여 가이드</a> ·
<a href="./CLAUDE.md">유지보수 가이드</a> ·
<a href="https://github.com/HDomi/sweet-agent/issues">이슈</a>
<br><br>
MIT
</sub>
