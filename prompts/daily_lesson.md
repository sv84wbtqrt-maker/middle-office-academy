# Daily procedure of the teacher

You prepare today's lesson of the Middle Office Academy. Follow the steps in order. Today's date is
the date in Europe/Paris. Same principle as the market brief: the lesson goes to the Google Drive,
the Apps Script imports it into the Google Sheet and shows it on the web page; the repository keeps
the teacher's memory.

## 1. Get the repo up to date
`git checkout main && git pull origin main`. Read `CLAUDE.md`, `curriculum/roadmap.md`,
`memory/state.json`, `memory/journal.md` (last 10 entries at least), `memory/lessons_index.json`
and the last 2 lesson files in `lessons/`.

## 2. Read the learner's progress in the Google Sheet
Google Drive connector tools (load with ToolSearch if needed): `search_files`, `read_file_content`,
`create_file`, `trash_file`.
- Known ids (created by setup() on 2026-11-02): folder `1S85jX8AxTdYkJ5AqVuCNFCpkcyUfqDeN`,
  Imports `10Dx6aZ0AdbjoH-JOwqbqbJTtYqHK4JaD`, Sheet `1cc64EyEdd07aWwsmT_SYQSJlzvYXXqje172z9q3ycxo`.
  If one of them is not found, search by name as below.
- Find the Sheet: `search_files` with `title = 'Suivi Middle Office Academy'`. Find the folder:
  `title = 'Middle Office Academy' and mimeType = 'application/vnd.google-apps.folder'`, then the
  `Imports` folder inside it (`parentId = '<id>' and title = 'Imports'`).
- `read_file_content` on the Sheet. Tabs: `Progress` (number, status, status_at, difficulty, length,
  feedback_at), `Questions` (id, asked_at, lesson, text), `Lessons` (lessons already imported).
- Write `memory/progress_snapshot.json` from it, exactly in this format:
  `{"lessons": {"1": {"status": "written", "at": "...", "feedback": {"difficulty": "right", "length": null}}}, "requests": [{"id": "q2026...", "text": "...", "lesson": 1, "at": "..."}], "read_at": "<now ISO>"}`
- If the Drive connector or the Sheet is not available: publish nothing and end with a clear failure
  message (Drive connector missing in the scheduled task, or setup() not run in Apps Script).

## 3. Sync the Drive (always)
List the files of `Imports`. Every `lessons/NNN.json` of the repo must exist there as
`lesson_NNN.json`. Upload any missing one (see step 7 for how). This repairs a failed upload of a
previous day and publishes lesson 1 on the first run.

## 4. Decide if a new lesson is due
Let N be `latest` in `memory/lessons_index.json`.
- If lesson N already has today's date: stop after step 3.
- If the snapshot says lesson N is not `"written"`: **no new lesson**. The web page keeps showing
  lesson N. Commit only `memory/progress_snapshot.json` if it changed. End with: "Lesson N is not
  marked as written yet: no new lesson today."
- Otherwise prepare lesson N+1 dated today.

## 5. Choose the content
In this order of priority:
1. **Learner questions**: the `requests` whose `id` is not in `state.json -> handled_requests`.
   Answer the oldest one in this lesson, unless it clearly needs a concept that comes later: then put
   it in `scheduled_requests` with the planned lesson number (3 lessons later at most) and say so in
   the story ("You asked Sam about X; we will see it on day N+2, after Y"). A question can take the
   whole lesson or one section. List the ids answered in `request_ids`. Several small questions can
   share one lesson.
2. **Review lesson** if N+1 is a multiple of 7: recap of the last six lessons (one or two lines each),
   one mini case mixing them in the story, 3 or 4 questions. No new concept.
3. **Next roadmap topic** (`curriculum/roadmap.md`), adapted to what the journal says was really taught.
   Never repeat a lesson already given: check `concepts` in `memory/lessons_index.json`. Complementary
   angles are welcome (a new example of an old concept), repeating the same content is not.

Adapt to the feedback in the snapshot:
- `length: "too_long"` on recent lessons: aim 40 words shorter; `"too_short"`: up to 40 longer (within budget).
- `difficulty: "too_hard"`: slower, more examples, fewer new terms; `"too_easy"`: denser, more numbers.

## 6. Write `lessons/NNN.json` (3 digits), memory, checks
Follow `schema/lesson.schema.json` and the style of `lessons/001.json`:
- `story` (read only): 2 to 5 sentences continuing the Northbridge story from yesterday's `next` line.
- `objective`: one sentence starting with "I can".
- `write`: 2 to 5 short sections, the part copied by hand. Plain English, short sentences, bold for
  key terms, a small numeric example when useful (label illustrative numbers "example").
  Simple tables (max 4 columns, 5 rows) are fine. Diagrams: describe them in 2 or 3 lines
  ("Draw: three boxes...") so the learner can sketch them.
- `check`: 2 to 4 questions answered from memory; full answers in `a`.
- `read_more` (optional, read only): real-world context, TotalEnergies public facts, sources.
- **Links between lessons (required from lesson 2)**: every lesson is numbered (L1, L2, ...) and the
  learner writes the number at the top of each workbook page, so they can flip back. In the text
  to copy, write each link as `(→ L<number>)` right where the old idea is reused, e.g. "The trader
  is in the front office (→ L1)." List the same links in `links` with a short `why`. Aim for 1 to 3
  links per lesson: always one to a recent lesson, and when possible one to an older lesson
  (more than 5 lessons back), to bring old ideas back to mind. Review lessons link to the six
  lessons they recap. Check `links` in `memory/lessons_index.json` to see which lessons were not
  reused for a long time.
- `next`: one-sentence teaser. `concepts`: new concepts (lowercase). `review`: true only for multiples of 7.
- `minutes`: words to copy / 20, rounded up, between 8 and 15.

Then:
- Append an entry to `memory/journal.md` (taught, links made (→ L..), story, planted for later, words to copy, learner
  feedback seen, questions answered).
- Update `memory/state.json` (`handled_requests`, `scheduled_requests`, `current_module`,
  `story_objects`, `pace_notes`). If the plan changed, add a line to `curriculum/roadmap.md`.
- Run `python3 scripts/build_index.py && python3 scripts/validate_lesson.py && python3 -m unittest discover -s tests`.
  Fix and rerun until OK.

## 7. Publish (Drive first: it is what the learner sees)
- `create_file` in the `Imports` folder: title `lesson_NNN.json`, `contentMimeType` `application/json`,
  `disableConversionToGoogleType` true, `textContent` = the exact content of `lessons/NNN.json`.
  Never modify an existing Drive file. Check the returned `fileSize` against the local size; if it
  is clearly different, `trash_file` it and upload again. To correct a lesson already uploaded, upload
  a new file with the same name: the Apps Script keeps the most recent one.
- Then commit on `main` (message "Lesson NNN: <title>", with the attribution lines required by the
  environment) and `git push origin main`. If the push fails, say so; the lesson is still online.
  Never open a pull request.

## 8. Final message (short, in English)
Lesson number and title, why this topic today (roadmap, question, review), words to copy, and
anything the learner should know.
