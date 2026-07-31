"""Tests for sweet-mode-tracker.js prompt parsing (issues #598, #599).

Drives the UserPromptSubmit hook with real prompts over stdin against an
isolated CLAUDE_CONFIG_DIR and asserts the flag-file state afterwards.

#598: natural-language triggers misfired — "turn sweet mode off"
ACTIVATED sweet (and clobbered the level to default), "turn sweet off"
was a no-op, questions about sweet armed it, and vim's "normal mode"
deactivated it.

#599: one-shot independent modes (/sweet-commit etc.) permanently
overwrote the active prose level, and the plugin-namespaced
/sweet:sweet-commit|-review variants were not recognized at all.
"""

import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
TRACKER = REPO_ROOT / "src" / "hooks" / "sweet-mode-tracker.js"


class ModeTrackerTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory(prefix="sweet-tracker-")
        self.claude_dir = Path(self._tmp.name) / ".claude"
        self.claude_dir.mkdir(parents=True)
        self.flag = self.claude_dir / ".sweet-active"
        self.prev = self.claude_dir / ".sweet-active.prev"

    def tearDown(self):
        self._tmp.cleanup()

    def send(self, prompt):
        env = os.environ.copy()
        env.pop("SWEET_DEFAULT_MODE", None)
        env["HOME"] = self._tmp.name
        env["USERPROFILE"] = self._tmp.name
        env["CLAUDE_CONFIG_DIR"] = str(self.claude_dir)
        return subprocess.run(
            ["node", str(TRACKER)],
            cwd=REPO_ROOT,
            env=env,
            input=json.dumps({"prompt": prompt}),
            text=True,
            capture_output=True,
            check=True,
        )

    def flag_value(self):
        return self.flag.read_text() if self.flag.exists() else None

    # ── #598: deactivation word orders ──────────────────────────────────

    def test_turn_sweet_mode_off_deactivates(self):
        # Pre-fix: this ACTIVATED sweet and downgraded ultra -> full.
        self.flag.write_text("ultra")
        self.send("turn sweet mode off")
        self.assertIsNone(self.flag_value())

    def test_turn_sweet_off_deactivates(self):
        self.flag.write_text("full")
        self.send("turn sweet off")
        self.assertIsNone(self.flag_value())

    def test_turn_off_sweet_deactivates(self):
        self.flag.write_text("full")
        self.send("turn off sweet")
        self.assertIsNone(self.flag_value())

    def test_stop_sweet_multiline_deactivates(self):
        # Pre-fix: `.*` without the s flag never matched across lines.
        self.flag.write_text("ultra")
        self.send("stop\nsweet")
        self.assertIsNone(self.flag_value())

    def test_normal_mode_command_deactivates(self):
        self.flag.write_text("full")
        self.send("normal mode")
        self.assertIsNone(self.flag_value())

    def test_back_to_normal_mode_deactivates(self):
        self.flag.write_text("full")
        self.send("back to normal mode please")
        self.assertIsNone(self.flag_value())

    def test_vim_normal_mode_does_not_deactivate(self):
        self.flag.write_text("full")
        self.send("how do I exit vim normal mode")
        self.assertEqual(self.flag_value(), "full")

    # ── #598: activation guards ─────────────────────────────────────────

    def test_enable_sweet_with_stop_elsewhere_activates(self):
        # Pre-fix: "stop" anywhere suppressed activation, then the
        # deactivation regex matched "sweet and stop" and deleted the flag.
        self.flag.write_text("full")
        self.send("enable sweet and stop apologizing")
        self.assertEqual(self.flag_value(), "full")

    def test_question_does_not_activate(self):
        self.send("what is sweet mode?")
        self.assertIsNone(self.flag_value())
        self.send("does sweet lite mode drop articles?")
        self.assertIsNone(self.flag_value())

    def test_scoped_brevity_does_not_activate(self):
        self.send("be brief in the summary section")
        self.assertIsNone(self.flag_value())

    def test_unscoped_brevity_activates(self):
        self.send("be brief")
        self.assertEqual(self.flag_value(), "full")

    def test_activate_sweet_still_works(self):
        self.send("activate sweet")
        self.assertEqual(self.flag_value(), "full")

    def test_turn_on_sweet_mode_still_works(self):
        self.send("turn on sweet mode")
        self.assertEqual(self.flag_value(), "full")

    def test_talk_like_sweet_still_works(self):
        self.send("다정하게 말해줘")
        self.assertEqual(self.flag_value(), "full")

    def test_bare_sweet_mode_still_works(self):
        self.send("sweet mode")
        self.assertEqual(self.flag_value(), "full")

    # ── coding tasks must not flip the mode ─────────────────────────────
    # The Korean words for "briefly", "casually", "save tokens" are also
    # ordinary words in a work request. Flipping a session-wide mode on those
    # is a silent false positive: the user asked for an edit to a file, not for
    # a different speaking style.

    def test_code_task_with_style_words_does_not_activate(self):
        for prompt in [
            "이 함수 로직 간단히 해줘",
            "주석 좀 간결하게 해줘",
            "리팩터링해서 코드 짧게 해줘",
            "이 API 응답 페이로드 토큰 줄여",
            "프롬프트 캐싱으로 토큰 절약하는 코드 써줘",
            "CLI 출력을 반말로 써",
            "UI 문구 다정하게 바꿔줘",
        ]:
            with self.subTest(prompt=prompt):
                self.send(prompt)
                self.assertIsNone(self.flag_value(), f"{prompt!r} must not activate")

    def test_bare_style_directives_still_activate(self):
        for prompt in ["짧게 말해", "반말로 해", "토큰 좀 아껴", "다정하게 말해줘"]:
            with self.subTest(prompt=prompt):
                if self.flag.exists():
                    self.flag.unlink()
                self.send(prompt)
                self.assertEqual(self.flag_value(), "full", f"{prompt!r} must activate")

    def test_feature_named_normal_mode_does_not_deactivate(self):
        self.flag.write_text("full")
        self.send("설정 화면에 일반 모드 토글 추가해")
        self.assertEqual(self.flag_value(), "full")

    def test_rewriting_a_doc_in_jondaemal_does_not_deactivate(self):
        self.flag.write_text("full")
        self.send("이 문서 존댓말로 바꿔")
        self.assertEqual(self.flag_value(), "full")

    def test_korean_deactivation_commands_still_work(self):
        for prompt in ["일반 모드로 해", "존댓말로 해", "스윗 끄기"]:
            with self.subTest(prompt=prompt):
                self.flag.write_text("full")
                self.send(prompt)
                self.assertIsNone(self.flag_value(), f"{prompt!r} must deactivate")

    # ── slash commands ──────────────────────────────────────────────────

    def test_slash_sweet_level_switch(self):
        self.send("/sweet ultra")
        self.assertEqual(self.flag_value(), "ultra")

    def test_slash_sweet_off(self):
        self.flag.write_text("full")
        self.send("/sweet off")
        self.assertIsNone(self.flag_value())

    # ── #599: one-shot independent modes ────────────────────────────────

    def test_commit_restores_prior_level_on_next_prompt(self):
        self.flag.write_text("ultra")
        self.send("/sweet-commit")
        self.assertEqual(self.flag_value(), "commit")
        r = self.send("ordinary follow-up question")
        self.assertEqual(self.flag_value(), "ultra")
        self.assertIn("SWEET MODE ACTIVE (ultra)", r.stdout)

    def test_commit_with_no_prior_mode_deactivates_after(self):
        self.send("/sweet-commit")
        self.assertEqual(self.flag_value(), "commit")
        r = self.send("ordinary follow-up question")
        self.assertIsNone(self.flag_value())
        self.assertNotIn("SWEET MODE ACTIVE", r.stdout)

    def test_chained_independent_modes_keep_original_prev(self):
        self.flag.write_text("ultra")
        self.send("/sweet-commit")
        self.send("/sweet-review")
        self.assertEqual(self.flag_value(), "review")
        self.send("ordinary follow-up question")
        self.assertEqual(self.flag_value(), "ultra")

    def test_namespaced_commit_and_review_recognized(self):
        # Pre-fix: only compress and stats had the /sweet:sweet- variant.
        self.flag.write_text("full")
        self.send("/sweet:sweet-commit")
        self.assertEqual(self.flag_value(), "commit")
        self.send("next prompt")  # restore
        self.send("/sweet:sweet-review")
        self.assertEqual(self.flag_value(), "review")

    def test_no_reinforcement_during_independent_turn(self):
        self.flag.write_text("full")
        r = self.send("/sweet-commit")
        self.assertNotIn("SWEET MODE ACTIVE", r.stdout)

    def test_deactivation_clears_saved_prev(self):
        self.flag.write_text("ultra")
        self.send("/sweet-commit")
        self.send("stop sweet")
        self.assertIsNone(self.flag_value())
        self.assertFalse(self.prev.exists(), "prev file must not survive deactivation")
        self.send("ordinary prompt")
        self.assertIsNone(self.flag_value(), "nothing should resurrect the mode")


if __name__ == "__main__":
    unittest.main()
