import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import validate_lesson  # noqa: E402
from lesson_lib import build_index, copied_words, load_lessons  # noqa: E402

BASE = json.loads((ROOT / "lessons" / "001.json").read_text(encoding="utf-8"))


class ValidatorTest(unittest.TestCase):
    def run_case(self, lessons, progress=None, state=None):
        d = Path(tempfile.mkdtemp())
        (d / "lessons").mkdir()
        for l in lessons:
            (d / "lessons" / ("%03d.json" % l["number"])).write_text(json.dumps(l), encoding="utf-8")
        (d / "progress.json").write_text(json.dumps(progress or {"lessons": {}, "requests": []}))
        (d / "state.json").write_text(json.dumps(state or {"handled_requests": []}))
        (d / "index.json").write_text(json.dumps(build_index(load_lessons(d / "lessons"))))
        return validate_lesson.main(["--lessons", str(d / "lessons"), "--progress", str(d / "progress.json"),
                                     "--index", str(d / "index.json"), "--state", str(d / "state.json")])

    def lesson(self, n, date, title=None):
        l = copy.deepcopy(BASE)
        l.update(number=n, date=date, title=title or "Lesson %d" % n, review=(n % 7 == 0))
        return l

    def test_repo_is_valid(self):
        self.assertEqual(validate_lesson.main([]), 0)

    def test_first_lesson_within_budget(self):
        self.assertTrue(140 <= copied_words(BASE) <= 320)

    def test_second_lesson_requires_written(self):
        ls = [self.lesson(1, "2026-11-02"), self.lesson(2, "2026-11-03")]
        self.assertEqual(self.run_case(ls), 1)
        ok = {"lessons": {"1": {"status": "written"}}, "requests": []}
        self.assertEqual(self.run_case(ls, ok), 0)

    def test_too_long_lesson_rejected(self):
        l = self.lesson(1, "2026-11-02")
        l["write"].append({"heading": "Extra", "body": "word " * 200})
        self.assertEqual(self.run_case([l]), 1)

    def test_one_lesson_per_day(self):
        ls = [self.lesson(1, "2026-11-02"), self.lesson(2, "2026-11-02")]
        self.assertEqual(self.run_case(ls, {"lessons": {"1": {"status": "written"}}, "requests": []}), 1)

    def test_seventh_lesson_is_review(self):
        ls = [self.lesson(i, "2026-11-%02d" % (i + 1)) for i in range(1, 8)]
        prog = {"lessons": {str(i): {"status": "written"} for i in range(1, 7)}, "requests": []}
        self.assertEqual(self.run_case(ls, prog), 0)
        ls[6]["review"] = False
        self.assertEqual(self.run_case(ls, prog), 1)

    def test_unknown_request_rejected(self):
        l = self.lesson(1, "2026-11-02")
        l["request_ids"] = ["q1"]
        self.assertEqual(self.run_case([l]), 1)
        self.assertEqual(self.run_case([l], {"lessons": {}, "requests": [{"id": "q1", "text": "x"}]}), 0)


if __name__ == "__main__":
    unittest.main()
