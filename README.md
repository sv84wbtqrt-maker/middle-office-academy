# Middle Office Academy

A daily course, written by hand in 10 to 15 minutes, to become a **middle office analyst in the
trading department of TotalEnergies**. Each morning a teacher (Claude, run by a scheduled task)
publishes the next lesson on the website, but only if you marked the previous one as written.

## How it works
```
 You (website)  ──"I wrote it" / feedback / question──▶  Apps Script web app ──▶ docs/data/progress.json (GitHub)
                                                                                         │
 Every morning: Claude scheduled task ── reads progress + memory ── writes lesson N+1 ───┘
                                          (memory/journal.md, memory/state.json, curriculum/roadmap.md)
 GitHub Pages serves docs/ ──▶ the website
```
- **Memory**: `memory/journal.md` (what was taught, story threads, feedback), `memory/state.json`,
  `curriculum/roadmap.md` (11 modules, about 160 lessons, then a deepening phase), and every lesson
  in `docs/lessons/`.
- **Not written yet?** No new lesson: the same lesson waits for you, with no pressure.
- **Questions**: the "Ask" page sends a question; it becomes the topic of one of the next lessons
  (at most 3 lessons later).
- **Every 7th lesson is a review** (spaced repetition).
- **Feedback** (too easy / too hard, too short / too long) adapts the next lessons.
- Rules and daily procedure for the teacher: `CLAUDE.md`, `prompts/daily_lesson.md`.

## Setup (once, about 15 minutes)

### 1. GitHub Pages
Repository **Settings > Pages**: Source "Deploy from a branch", branch `main`, folder `/docs`.
The site appears at `https://sv84wbtqrt-maker.github.io/middle-office-academy/`.
(Free plan: the repository must be public for Pages.)

### 2. GitHub token for the Apps Script
GitHub **Settings > Developer settings > Personal access tokens > Fine-grained tokens > Generate**:
- Repository access: only `sv84wbtqrt-maker/middle-office-academy`
- Permissions: **Contents: Read and write** (nothing else)
- Expiration: 1 year (put a reminder to renew it).

### 3. Apps Script
1. Go to https://script.google.com > New project, name it "Middle Office Academy".
2. Replace `Code.gs` with `apps-script/Code.gs`. In Project Settings, tick "Show appsscript.json"
   and replace it with `apps-script/appsscript.json`.
3. Project Settings > Script properties: add `GITHUB_TOKEN` (the token) and `PIN` (a code you choose,
   e.g. 6 digits).
4. Run `testConnection` once from the editor, accept the permissions; the log shows the progress JSON.
5. Deploy > New deployment > type **Web app**, Execute as **Me**, Who has access **Anyone**.
   Copy the URL ending in `/exec`.
6. Put this URL in `docs/config.json` (`appsScriptUrl`), commit, push (or send it to Claude).
7. On the website, Settings > Enter PIN > Test connection. Do it once per device (phone, laptop).

After a code change in `Code.gs`: Deploy > Manage deployments > edit > Version "New version"
(the URL stays the same).

### 4. The daily teacher
A Claude scheduled task runs every morning with `prompts/daily_lesson.md`. This repository must be
selected in the scheduled task's settings so the session can clone and push it.

## Checks
```
python3 scripts/build_index.py && python3 scripts/validate_lesson.py && python3 -m unittest discover -s tests
```
The validator blocks: missing fields, more than 320 words to copy (15 min of handwriting), two lessons
on the same day, a new lesson while the previous is not marked written, a non-review 7th lesson,
an out-of-date index.

## Security note
The PIN stops strangers from clicking your buttons; the GitHub token stays in Apps Script, never
in the website. Progress and questions are public if the repository is public: don't write
personal information in questions.
