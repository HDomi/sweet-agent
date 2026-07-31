# Windows install fallback

If `irm https://raw.githubusercontent.com/HDomi/sweet-agent/main/install.ps1 | iex` fails on Windows (issues #249, #199, #72), set up plugin-skill activation by hand. This does **not** install the standalone hooks or the statusline — for those, run the unified Node installer afterwards: `npx -y github:HDomi/sweet-agent -- --only claude` (or `node bin/install.js --only claude` from a clone).

```powershell
$ClaudeDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME ".claude" }
$PluginSkillDir = Join-Path $ClaudeDir ".agents\plugins\sweet\skills\sweet"
$MarketplaceDir = Join-Path $ClaudeDir ".agents\plugins"
$MarketplaceFile = Join-Path $MarketplaceDir "marketplace.json"

# Copy SKILL.md into the plugin path (run from a clone of the repo)
New-Item -ItemType Directory -Path $PluginSkillDir -Force | Out-Null
Copy-Item ".\skills\sweet\SKILL.md" "$PluginSkillDir\SKILL.md" -Force

# Create or update marketplace.json with the sweet entry
New-Item -ItemType Directory -Path $MarketplaceDir -Force | Out-Null
if (Test-Path $MarketplaceFile) {
  $marketplace = Get-Content $MarketplaceFile -Raw | ConvertFrom-Json
} else {
  $marketplace = [pscustomobject]@{}
}
if (-not ($marketplace.PSObject.Properties.Name -contains "plugins")) {
  $marketplace | Add-Member -NotePropertyName plugins -NotePropertyValue ([pscustomobject]@{})
}
$plugins = [ordered]@{}
foreach ($p in $marketplace.plugins.PSObject.Properties) { $plugins[$p.Name] = $p.Value }
$plugins["sweet"] = [ordered]@{ name = "sweet"; source = "HDomi/sweet-agent"; version = "main" }
$marketplace.plugins = [pscustomobject]$plugins
$marketplace | ConvertTo-Json -Depth 10 | Set-Content -Path $MarketplaceFile -Encoding UTF8
```

Verify: `Test-Path "$PluginSkillDir\SKILL.md"` should print `True`. Restart Claude Code, then run `/sweet` to confirm the skill loads.

## Codex on Windows

1. Enable symlinks first: `git config --global core.symlinks true` (requires Developer Mode or admin).
2. Clone repo → Open VS Code → Codex Settings → Plugins → find "Sweet" under the local marketplace → Install → Reload Window.
3. Codex hooks are currently disabled on Windows, so use `$sweet` to start the mode manually each session.

## `npx skills` symlink fallback

`npx skills` uses symlinks by default. If symlinks fail, add `--copy`:

```powershell
npx skills add HDomi/sweet-agent --copy
```

## Want it always on (any agent)?

Paste this into the agent's system prompt or rules file:

```
오빠에게 짧고 다정한 반말로 답한다. 기술 내용은 하나도 안 뺀다. 군더더기만 버린다.
산문은 100% 한국어. 존댓말 어미(~요/~습니다/~세요) 금지. 호칭 "오빠"는 응답당 0~1번만.
버릴 것: 조사(뜻 안 흐려지면), 군더더기(그냥/진짜/사실/좀), 상투어(알겠어/도와줄게), 완충 표현(아마/~인 것 같아).
단문 OK. 짧은 동의어. 물결 최대 2개, 이모지 최대 1개.
코드·명령어·파일 경로·에러 문자열·API 이름은 원문 그대로. 새 약어 만들지 마라.
패턴: [대상] [상태·원인]. [할 일].
응답마다 계속 켜져 있다. 턴 많이 지나도 원래대로 안 돌아간다.
자동 명확화: 보안 경고, 되돌릴 수 없는 작업, 순서 중요한 다단계 절차는 완전한 문장으로. 끝나면 복귀.
코드·커밋 메시지·PR 설명은 평문. 끄기: "스윗 끄기" / "normal mode" / "그만".
```
