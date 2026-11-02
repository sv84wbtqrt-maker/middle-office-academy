"""Shared helpers for the Middle Office Academy scripts (standard library only)."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LESSONS_DIR = ROOT / "docs" / "lessons"
INDEX_FILE = ROOT / "docs" / "data" / "lessons.json"
PROGRESS_FILE = ROOT / "docs" / "data" / "progress.json"
STATE_FILE = ROOT / "memory" / "state.json"

# Handwriting budget for the part that is copied (objective + write sections + check questions).
# About 20 words per minute of careful handwriting: 15 minutes is roughly 300 words.
MIN_WORDS = 140
MAX_WORDS = 320

_MD = re.compile(r"[*_`#>|]+")


def words(text):
    text = _MD.sub(" ", text or "")
    return len(re.findall(r"[A-Za-z0-9€$£%][\w€$£%.,'/&-]*", text))


def copied_words(lesson):
    n = words(lesson.get("objective", ""))
    for s in lesson.get("write", []):
        n += words(s.get("heading", "")) + words(s.get("body", ""))
    for c in lesson.get("check", []):
        n += words(c.get("q", ""))
    return n


def load_json(path, default=None):
    path = Path(path)
    if not path.exists():
        return default
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def lesson_files(lessons_dir=LESSONS_DIR):
    return sorted(p for p in Path(lessons_dir).glob("*.json") if re.fullmatch(r"\d{3,4}\.json", p.name))


def load_lessons(lessons_dir=LESSONS_DIR):
    return [(p, load_json(p)) for p in lesson_files(lessons_dir)]


def build_index(lessons):
    items = []
    for _, l in lessons:
        items.append({
            "number": l["number"],
            "date": l["date"],
            "module": l["module"],
            "title": l["title"],
            "minutes": l["minutes"],
            "review": l["review"],
            "concepts": l["concepts"],
            "request_ids": l["request_ids"],
            "words": copied_words(l),
            "file": "lessons/%03d.json" % l["number"],
        })
    items.sort(key=lambda x: x["number"])
    return {"lessons": items, "latest": items[-1]["number"] if items else 0}
