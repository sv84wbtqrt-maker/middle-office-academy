# Daily procedure of the teacher

You prepare today's lesson of the Middle Office Academy. Follow the steps in order. Today's date is
the date in Europe/Paris.

## 1. Get the repo up to date
`git checkout main && git pull origin main`. Read `CLAUDE.md`, `curriculum/roadmap.md`,
`memory/state.json`, `memory/journal.md` (last 10 entries at least), `docs/data/progress.json`,
`docs/data/lessons.json`, and the last 2 lesson files in `docs/lessons/`.

## 2. Decide if a new lesson is due
Let N be `latest` in `docs/data/lessons.json`.
- If lesson N already has today's date: stop, nothing to do.
- If `progress.json` -> `lessons["N"].status` is not `"written"`: **no new lesson**. The website keeps
  showing lesson N. Do not commit anything. End with: "Lesson N is not marked as written yet: no new
  lesson today."
- Otherwise prepare lesson N+1 dated today.

## 3. Choose the content
In this order of priority:
1. **Learner questions**: the `requests` in `progress.json` whose `id` is not in
   `state.json -> handled_requests`. Answer the oldest one in this lesson, unless it clearly needs
   a concept that comes later: then put it in `scheduled_requests` with the planned lesson number
   (3 lessons later at most) and explain that in the story ("You asked Sam about X; we will see it
   on day N+2 after Y"). A question can take the whole lesson or one section. List the ids answered in
   `request_ids`. Several small questions can share one lesson.
2. **Review lesson** if N+1 is a multiple of 7: recap of the last six lessons (one or two lines each),
   one mini case mixing them in the story, 3 or 4 questions. No new concept.
3. **Next roadmap topic** (`curriculum/roadmap.md`), adapted to what the journal says was really taught.
   Never repeat a lesson already given: check `concepts` in `docs/data/lessons.json`. Complementary
   angles are welcome (a new example of an old concept), repetition of the same content is not.

Adapt to the feedback in `progress.json -> lessons[*].feedback`:
- `length: "too_long"` on recent lessons: aim 40 words shorter; `"too_short"`: up to 40 longer (budget max).
- `difficulty: "too_hard"`: slower, more examples, fewer new terms; `"too_easy"`: denser, add numbers.

## 4. Write `docs/lessons/NNN.json` (3 digits)
Follow `schema/lesson.schema.json` and the style of `docs/lessons/001.json`:
- `story` (read only): 2 to 5 sentences continuing the Northbridge story from yesterday's `next` line.
- `objective`: one sentence starting with "I can".
- `write`: 2 to 5 short sections, the part copied by hand. Plain English, short sentences, bold for
  key terms, a small numeric example when useful (label illustrative numbers "example").
  Simple tables (max 4 columns, 5 rows) are fine: they are quick to copy. Diagrams: describe them
  in 2 or 3 lines ("Draw: three boxes...") so the learner can sketch them.
- `check`: 2 to 4 questions answered from memory; full answers in `a`.
- `read_more` (optional, read only): real-world context, TotalEnergies public facts, sources to follow.
- `next`: one-sentence teaser of the next lesson.
- `concepts`: the new concepts (lowercase). `review`: true only for multiples of 7.
- `minutes`: estimated time (words to copy / 20, rounded up), between 8 and 15.

## 5. Update memory, then check
- Append an entry to `memory/journal.md` (format of the existing entries: taught, story, planted for
  later, words to copy, learner feedback seen, questions answered).
- Update `memory/state.json`: add answered request ids to `handled_requests`, update
  `scheduled_requests`, `current_module`, `story_objects`, `pace_notes`.
- If the plan changed, update `curriculum/roadmap.md` (add a line, do not delete history).
- Run `python3 scripts/build_index.py && python3 scripts/validate_lesson.py && python3 -m unittest discover -s tests`.
  Fix and rerun until OK.

## 6. Publish
Commit on `main` (message: "Lesson NNN: <title>", with the attribution lines required by the
environment) and `git push origin main`. Never commit `docs/data/progress.json`: if `git status`
shows it changed, run `git checkout docs/data/progress.json` first. If the push is rejected because
the Apps Script updated progress.json meanwhile: `git pull --rebase origin main`, rerun the checks, push.

## 7. Final message (short, in English)
Lesson number and title, why this topic today (roadmap, question, review), words to copy, and
anything the learner should know.
