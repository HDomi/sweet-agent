import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "skills" / "sweet-compress"))

from scripts.validate import (  # noqa: E402
    ValidationResult,
    extract_inline_codes,
    validate,
    validate_inline_codes,
    validate_polarity,
)


class TestExtractInlineCodes(unittest.TestCase):
    def test_fenced_blocks_excluded(self):
        text = "```\ncode here\n```\n`inline code`"
        result = extract_inline_codes(text)
        self.assertEqual(result, ["inline code"])

    def test_inline_only(self):
        text = "Use `rm -rf /` to delete everything"
        result = extract_inline_codes(text)
        self.assertEqual(result, ["rm -rf /"])

    def test_mixed_content(self):
        text = """
Some text with `inline1` and `inline2`.

```
code block
```

More text with `inline3`.
"""
        result = extract_inline_codes(text)
        self.assertEqual(set(result), {"inline1", "inline2", "inline3"})

    def test_empty(self):
        self.assertEqual(extract_inline_codes("no backticks here"), [])


class TestValidateInlineCodes(unittest.TestCase):
    def test_match(self):
        result = ValidationResult()
        validate_inline_codes("use `cmd` here", "use `cmd` here", result)
        self.assertTrue(result.is_valid)

    def test_lost(self):
        result = ValidationResult()
        validate_inline_codes("use `cmd` here", "use  here", result)
        self.assertFalse(result.is_valid)
        self.assertIn("Inline code lost", result.errors[0])

    def test_added(self):
        result = ValidationResult()
        validate_inline_codes("use  here", "use `new` here", result)
        self.assertTrue(result.is_valid)
        self.assertIn("Inline code added", result.warnings[0])

    def test_empty_orig(self):
        result = ValidationResult()
        validate_inline_codes("no codes", "use `new` here", result)
        self.assertTrue(result.is_valid)

    def test_both_empty(self):
        result = ValidationResult()
        validate_inline_codes("plain text", "also plain", result)
        self.assertTrue(result.is_valid)


class TestValidatePolarity(unittest.TestCase):
    """Structural validation passes an inverted rule; this check is what stops
    a compressed CLAUDE.md from telling the agent the opposite thing."""

    def check(self, orig, comp):
        result = ValidationResult()
        validate_polarity(orig, comp, result)
        return result

    def test_dropped_prohibition_is_an_error(self):
        r = self.check(
            "## Testing\n\nNever mock the database in integration tests.\n",
            "## Testing\n\nMock database in integration tests.\n",
        )
        self.assertFalse(r.is_valid)
        self.assertIn("Negation lost", r.errors[0])

    def test_dropped_korean_prohibition_is_an_error(self):
        r = self.check(
            "## 커밋\n\n`.env` 파일은 절대 커밋 금지.\n",
            "## 커밋\n\n`.env` 커밋.\n",
        )
        self.assertFalse(r.is_valid)

    def test_rephrased_negation_passes(self):
        # "Please don't use any" -> "No `any`" is a legitimate compression.
        r = self.check(
            "## Style\n\nPlease don't use the any type.\n",
            "## Style\n\nNo any type.\n",
        )
        self.assertTrue(r.is_valid)

    def test_incidental_not_does_not_trigger(self):
        # Descriptive "not", no rule attached — dropping it is free.
        r = self.check(
            "## Notes\n\nAll other fields are optional and use defaults if not provided.\n",
            "## Notes\n\nOptional fields use defaults.\n",
        )
        self.assertTrue(r.is_valid)

    def test_negation_inside_code_does_not_count(self):
        # Code is preserved verbatim, so a `--no-verify` in a fence must not
        # satisfy a prose prohibition that got dropped.
        r = self.check(
            "## Hooks\n\nNever bypass the pre-commit hook.\n\n```\ngit commit --no-verify\n```\n",
            "## Hooks\n\nBypass pre-commit hook.\n\n```\ngit commit --no-verify\n```\n",
        )
        self.assertFalse(r.is_valid)

    def test_lost_constraint_words_are_a_warning_not_an_error(self):
        r = self.check(
            "## Order\n\nAlways run the migration before the deploy.\n",
            "## Order\n\n마이그레이션 실행, 배포.\n",
        )
        self.assertTrue(r.is_valid)
        self.assertTrue(any("Constraint words lost" in w for w in r.warnings))


class TestValidateIntegration(unittest.TestCase):
    def test_validate_inline_codes_wired(self):
        with tempfile.TemporaryDirectory() as tmp:
            orig = Path(tmp) / "original.md"
            comp = Path(tmp) / "compressed.md"
            orig.write_text("Run `rm -rf /` to delete")
            comp.write_text("Run  to delete")
            result = validate(orig, comp)
            self.assertFalse(result.is_valid)
            self.assertTrue(any("Inline code lost" in e for e in result.errors))


if __name__ == "__main__":
    unittest.main()