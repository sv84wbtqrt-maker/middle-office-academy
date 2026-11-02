#!/usr/bin/env python3
"""Rebuild memory/lessons_index.json from lessons/NNN.json. Never edit the index by hand."""
import json
import sys
from lesson_lib import INDEX_FILE, build_index, load_lessons


def main():
    index = build_index(load_lessons())
    INDEX_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(INDEX_FILE, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print("index: %d lessons, latest = %d" % (len(index["lessons"]), index["latest"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
