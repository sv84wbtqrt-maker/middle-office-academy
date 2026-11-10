#!/usr/bin/env python3
"""Blocking checks before any commit. Exit code 1 if an error is found.

Usage: python3 scripts/validate_lesson.py [--lessons DIR --progress FILE --index FILE --state FILE]
"""
import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path

from lesson_lib import (INDEX_FILE, LESSONS_DIR, MAX_WORDS, MIN_WORDS, PROGRESS_FILE, STATE_FILE,
                        build_index, copied_words, load_json, load_lessons)

REQUIRED = {"number": int, "date": str, "module": str, "title": str, "minutes": int, "story": str,
            "objective": str, "write": list, "check": list, "next": str, "concepts": list,
            "review": bool, "request_ids": list}
OPTIONAL = {"read_more": str, "links": list}
AHEAD = 2  # lessons prepared in advance, hidden until the previous one is written
REF = re.compile(r"→\s*L(\d+)")


def check_lesson(path, l, errors):
    tag = Path(path).name
    for k, t in REQUIRED.items():
        if k not in l:
            errors.append("%s: missing field '%s'" % (tag, k))
        elif not isinstance(l[k], t) or (t is int and isinstance(l[k], bool)):
            errors.append("%s: field '%s' must be %s" % (tag, k, t.__name__))
    for k in l:
        if k not in REQUIRED and k not in OPTIONAL:
            errors.append("%s: unknown field '%s'" % (tag, k))
    if errors and any(e.startswith(tag) for e in errors):
        return
    if Path(path).stem.lstrip("0") != str(l["number"]):
        errors.append("%s: file name does not match number %d" % (tag, l["number"]))
    try:
        dt.date.fromisoformat(l["date"])
    except ValueError:
        errors.append("%s: bad date %s" % (tag, l["date"]))
    if not 8 <= l["minutes"] <= 15:
        errors.append("%s: minutes must be between 8 and 15" % tag)
    if not 2 <= len(l["write"]) <= 5:
        errors.append("%s: 2 to 5 write sections" % tag)
    for s in l["write"]:
        if not isinstance(s, dict) or not s.get("heading") or not s.get("body"):
            errors.append("%s: each write section needs heading and body" % tag)
    if not 2 <= len(l["check"]) <= 4:
        errors.append("%s: 2 to 4 check questions" % tag)
    for c in l["check"]:
        if not isinstance(c, dict) or not c.get("q") or not c.get("a"):
            errors.append("%s: each check question needs q and a" % tag)
    if not l["concepts"]:
        errors.append("%s: concepts must not be empty" % tag)
    n = copied_words(l)
    if not MIN_WORDS <= n <= MAX_WORDS:
        errors.append("%s: %d words to copy, budget is %d to %d (15 minutes of handwriting max)"
                      % (tag, n, MIN_WORDS, MAX_WORDS))
    links = l.get("links", [])
    for k in links:
        if not isinstance(k, dict) or not isinstance(k.get("lesson"), int) or not k.get("why"):
            errors.append("%s: each link needs lesson (int) and why" % tag)
        elif not 1 <= k["lesson"] < l["number"]:
            errors.append("%s: link to L%s must point to an earlier lesson" % (tag, k.get("lesson")))
    if l["number"] >= 2:
        if not links:
            errors.append("%s: from lesson 2, at least one link to an earlier lesson is required" % tag)
        copied = l["objective"] + " ".join(s["heading"] + " " + s["body"] for s in l["write"]) + " ".join(c["q"] for c in l["check"])
        refs = {int(x) for x in REF.findall(copied)}
        for r in refs:
            if not 1 <= r < l["number"]:
                errors.append("%s: (→ L%d) in the text must point to an earlier lesson" % (tag, r))
        missing = {k["lesson"] for k in links if isinstance(k, dict) and isinstance(k.get("lesson"), int)} - refs
        if links and not refs:
            errors.append("%s: write the links in the text to copy as (→ L<number>)" % tag)
        elif missing:
            errors.append("%s: links %s are not written in the text as (→ L<number>)" % (tag, sorted(missing)))
    if l["number"] % 7 == 0 and not l["review"]:
        errors.append("%s: lesson %d is a multiple of 7, it must be a review lesson" % (tag, l["number"]))
    if l["number"] % 7 != 0 and l["review"]:
        errors.append("%s: review lessons are the multiples of 7" % tag)


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--lessons", default=str(LESSONS_DIR))
    ap.add_argument("--progress", default=str(PROGRESS_FILE))
    ap.add_argument("--index", default=str(INDEX_FILE))
    ap.add_argument("--state", default=str(STATE_FILE))
    a = ap.parse_args(argv)

    errors = []
    lessons = load_lessons(a.lessons)
    if not lessons:
        errors.append("no lesson found")
    for p, l in lessons:
        check_lesson(p, l, errors)
    if errors:
        print("\n".join("ERROR " + e for e in errors))
        return 1

    nums = [l["number"] for _, l in lessons]
    if nums != list(range(1, len(nums) + 1)):
        errors.append("lesson numbers must be 1..N without gaps: %s" % nums)
    dates = [l["date"] for _, l in lessons]
    if any(b < a_ for a_, b in zip(dates, dates[1:])):
        errors.append("lesson dates must not go backwards")
    titles = [l["title"].strip().lower() for _, l in lessons]
    if len(set(titles)) != len(titles):
        errors.append("two lessons have the same title")

    progress = load_json(a.progress, {}) or {}
    status = progress.get("lessons", {})
    # Highest lesson marked written (a lesson ticked late must not block the reserve).
    written = max([int(k) for k, v in status.items() if str(k).isdigit() and v.get("status") == "written"] or [0])
    max_allowed = written + 1 + AHEAD
    if nums and nums[-1] > max_allowed:
        errors.append("lesson %d is too far ahead: the highest lesson written is %d, so the last lesson allowed is %d "
                      "(the current one + %d in advance)" % (nums[-1], written, max_allowed, AHEAD))
    request_ids = {r.get("id") for r in progress.get("requests", [])}
    for _, l in lessons:
        for rid in l["request_ids"]:
            if rid not in request_ids:
                errors.append("lesson %d answers unknown request %s" % (l["number"], rid))

    state = load_json(a.state, {}) or {}
    for rid in state.get("handled_requests", []):
        if rid not in request_ids:
            errors.append("state.json: handled request %s not found in progress.json" % rid)

    index = load_json(a.index)
    if index != build_index(lessons):
        errors.append("memory/lessons_index.json is out of date: run python3 scripts/build_index.py")

    if errors:
        print("\n".join("ERROR " + e for e in errors))
        return 1
    last = lessons[-1][1]
    print("OK: %d lessons; latest %d (%s), %d words to copy"
          % (len(lessons), last["number"], last["date"], copied_words(last)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
