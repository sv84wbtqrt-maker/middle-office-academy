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
        if n >= 2:
            l["links"] = [{"lesson": n - 1, "why": "builds on it"}]
            l["write"][0]["body"] += " (→ L%d)" % (n - 1)
        return l

    def test_repo_is_valid(self):
        self.assertEqual(validate_lesson.main([]), 0)

    def test_first_lesson_within_budget(self):
        self.assertTrue(140 <= copied_words(BASE) <= 320)

    def test_at_most_two_lessons_in_advance(self):
        ls = [self.lesson(i, "2026-11-02") for i in range(1, 5)]
        self.assertEqual(self.run_case(ls[:3]), 0)          # current + 2 in advance
        self.assertEqual(self.run_case(ls), 1)              # 3 in advance: refused
        ok = {"lessons": {"1": {"status": "written"}}, "requests": []}
        self.assertEqual(self.run_case(ls, ok), 0)

    def test_lesson_ticked_late_does_not_block(self):
        ls = [self.lesson(i, "2026-11-02") for i in range(1, 7)]
        prog = {"lessons": {"1": {"status": "written"}, "3": {"status": "written"}}, "requests": []}
        self.assertEqual(self.run_case(ls, prog), 0)        # L2 not ticked, but L3 is: up to L6 allowed

    def test_too_long_lesson_rejected(self):
        l = self.lesson(1, "2026-11-02")
        l["write"].append({"heading": "Extra", "body": "word " * 200})
        self.assertEqual(self.run_case([l]), 1)

    def test_dates_do_not_go_backwards(self):
        ls = [self.lesson(1, "2026-11-03"), self.lesson(2, "2026-11-02")]
        self.assertEqual(self.run_case(ls), 1)
        ls[1]["date"] = "2026-11-03"
        self.assertEqual(self.run_case(ls), 0)

    def test_seventh_lesson_is_review(self):
        ls = [self.lesson(i, "2026-11-%02d" % (i + 1)) for i in range(1, 8)]
        prog = {"lessons": {str(i): {"status": "written"} for i in range(1, 7)}, "requests": []}
        self.assertEqual(self.run_case(ls, prog), 0)
        ls[6]["review"] = False
        self.assertEqual(self.run_case(ls, prog), 1)

    def test_links_required_and_written(self):
        prog = {"lessons": {"1": {"status": "written"}}, "requests": []}
        l2 = self.lesson(2, "2026-11-03")
        self.assertEqual(self.run_case([self.lesson(1, "2026-11-02"), l2], prog), 0)
        no_link = copy.deepcopy(l2); no_link.pop("links")
        self.assertEqual(self.run_case([self.lesson(1, "2026-11-02"), no_link], prog), 1)
        not_written = copy.deepcopy(l2); not_written["write"][0]["body"] = "plain text"
        self.assertEqual(self.run_case([self.lesson(1, "2026-11-02"), not_written], prog), 1)
        future = copy.deepcopy(l2); future["links"] = [{"lesson": 5, "why": "x"}]
        self.assertEqual(self.run_case([self.lesson(1, "2026-11-02"), future], prog), 1)

    def test_unknown_request_rejected(self):
        l = self.lesson(1, "2026-11-02")
        l["request_ids"] = ["q1"]
        self.assertEqual(self.run_case([l]), 1)
        self.assertEqual(self.run_case([l], {"lessons": {}, "requests": [{"id": "q1", "text": "x"}]}), 0)


if __name__ == "__main__":
    unittest.main()
