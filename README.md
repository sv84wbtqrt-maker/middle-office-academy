# Middle Office Academy

A daily course, copied by hand in 10 to 15 minutes, to become a **middle office analyst in the
trading department of TotalEnergies**. Same principle as the market brief: every morning a Claude
scheduled task writes the next lesson and drops it in Google Drive; a Google Apps Script imports it
into a Google Sheet and shows it on a web page. A new lesson comes only after you mark the previous
one as written.

## How it works
```
Claude scheduled task (05:47 Paris) ── lesson_NNN.json ──▶ Drive "Middle Office Academy/Imports"
        ▲                                                         │ (Apps Script imports it)
        │ reads your progress and questions                       ▼
Google Sheet "Suivi Middle Office Academy" ◀── your clicks ── web page (Apps Script web app)
```
- **Web page**: today's lesson (part to read, part to copy, self-check questions with hidden answers),
  archive, concepts learned, "Ask the teacher".
- **"I have written this lesson"**: saved in the Sheet (tab Progress). Not written? No new lesson the
  next day: the same lesson waits for you.
- **Questions**: tab Questions; each becomes the topic of one of the next lessons (3 lessons later at most).
- **Feedback** (too easy / too hard, too short / too long) adapts the next lessons.
- **Every 7th lesson is a review.**
- **Memory of the teacher** (this repo): `memory/journal.md`, `memory/state.json`,
  `memory/progress_snapshot.json`, `curriculum/roadmap.md` (11 modules, about 160 lessons, then a
  deepening phase) and all lessons in `lessons/`. Rules: `CLAUDE.md`, `prompts/daily_lesson.md`.

## Setup (once, about 5 minutes, like the market brief)
1. Go to https://script.google.com > **New project**, name it "Middle Office Academy".
2. Replace the content of `Code.gs` with `apps-script/Code.gs`.
3. **+ > HTML**, name it `Index` (exactly), paste `apps-script/Index.html`.
4. Project Settings (gear icon) > tick "Show appsscript.json manifest file in editor"; back in the
   editor, replace `appsscript.json` with `apps-script/appsscript.json`.
5. Select the function `setup` and click **Run**, accept the permissions. It creates in your Drive the
   folder "Middle Office Academy", its subfolder "Imports" and the Sheet "Suivi Middle Office Academy",
   plus an hourly import.
6. **Deploy > New deployment > Web app**: execute as "User accessing the web app", access "Only myself".
   Open the URL and bookmark it (also on your phone).
7. In claude.ai, open the scheduled task "Middle Office Academy: daily lesson" and, as for the market
   brief, select the repository `sv84wbtqrt-maker/middle-office-academy` and add the **Google Drive**
   connector.

Lesson 1 is uploaded to Drive by the first morning run (or by Claude on request), then appears on the page.

## Checks
```
python3 scripts/build_index.py && python3 scripts/validate_lesson.py && python3 -m unittest discover -s tests
```
The validator blocks: missing fields, more than 320 words to copy (15 min of handwriting), two lessons
on the same day, a new lesson while the previous one is not marked written, a 7th lesson that is not a
review, an out-of-date index.

## Known limits
- The Apps Script code was tested here with a simulated Google environment only; the first real run
  is the true test.
- The page updates when you open it (import on load) and every hour.
