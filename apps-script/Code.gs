/**
 * Middle Office Academy: same principle as the market brief.
 * - Every morning the Claude scheduled task drops lesson_NNN.json in the Drive folder "Middle Office Academy/Imports".
 * - This script imports the lessons into the Google Sheet and serves the web page (Deploy > Web app).
 * - Your clicks ("I have written it", feedback, questions) are saved in the Sheet; the teacher reads them each morning.
 *
 * Setup (once): Project Settings > tick "Show appsscript.json" and paste appsscript.json, create an HTML file "Index"
 * with Index.html, run setup() and accept the permissions (it creates the folder, the Imports subfolder and the Sheet),
 * then Deploy > New deployment > Web app, execute as: user accessing, access: only me. Bookmark the URL.
 */
var FOLDER_NAME = 'Middle Office Academy';
var IMPORTS_NAME = 'Imports';
var SHEET_NAME = 'Suivi Middle Office Academy';
var LESSON_COLS = ['number', 'date', 'module', 'title', 'json', 'file_id'];
var PROGRESS_COLS = ['number', 'status', 'status_at', 'difficulty', 'length', 'feedback_at'];
var QUESTION_COLS = ['id', 'asked_at', 'lesson', 'text'];

// ---------- Drive and Sheet ----------

function folder_() {
  var it = DriveApp.getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
}

function imports_() {
  var root = folder_(), it = root.getFoldersByName(IMPORTS_NAME);
  return it.hasNext() ? it.next() : root.createFolder(IMPORTS_NAME);
}

function ss_() {
  var ps = PropertiesService.getScriptProperties();
  var id = ps.getProperty('sheet_id');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* deleted: find or recreate below */ }
  }
  var it = DriveApp.getFilesByName(SHEET_NAME);
  var ss;
  if (it.hasNext()) {
    ss = SpreadsheetApp.openById(it.next().getId());
  } else {
    ss = SpreadsheetApp.create(SHEET_NAME);
    DriveApp.getFileById(ss.getId()).moveTo(folder_());
  }
  ps.setProperty('sheet_id', ss.getId());
  return ss;
}

function sheet_(name, cols) {
  var ss = ss_();
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.appendRow(cols);
    sh.getRange(1, 1, 1, cols.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function rows_(sh) {
  var v = sh.getDataRange().getValues();
  var head = v.shift();
  return v.map(function (r, i) {
    var o = { _row: i + 2 };
    head.forEach(function (h, j) { o[h] = r[j]; });
    return o;
  });
}

function setup() {
  imports_();
  sheet_('Lessons', LESSON_COLS);
  sheet_('Progress', PROGRESS_COLS);
  sheet_('Questions', QUESTION_COLS);
  var ss = ss_();
  ['Sheet1', 'Feuille 1'].forEach(function (n) {
    var def = ss.getSheetByName(n);
    if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
  });
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('importLessons').timeBased().everyHours(1).create();
  importLessons();
  Logger.log('Folder: ' + folder_().getUrl());
  Logger.log('Imports: ' + imports_().getUrl());
  Logger.log('Sheet: ' + ss.getUrl());
}

// ---------- Import of the lessons dropped by the teacher ----------

/** Imports Imports/lesson_NNN.json into the Lessons tab. A corrected file for the same number replaces the row. */
function importLessons() {
  var sh = sheet_('Lessons', LESSON_COLS);
  var existing = {};
  rows_(sh).forEach(function (r) { existing[String(r.number)] = r; });
  var files = imports_().getFiles(), list = [];
  while (files.hasNext()) {
    var f = files.next();
    if (/^lesson_\d{3,4}\.json$/.test(f.getName())) list.push(f);
  }
  // Same name twice (a correction): the most recent file is applied last.
  list.sort(function (a, b) {
    if (a.getName() !== b.getName()) return a.getName() < b.getName() ? -1 : 1;
    return a.getLastUpdated() - b.getLastUpdated();
  });
  var added = 0;
  list.forEach(function (f) {
    var l;
    try { l = JSON.parse(f.getBlob().getDataAsString('UTF-8')); } catch (e) { Logger.log('Invalid JSON: ' + f.getName()); return; }
    if (!l.number || !l.title || !l.write) { Logger.log('Not a lesson: ' + f.getName()); return; }
    var row = [l.number, l.date, l.module, l.title, JSON.stringify(l), f.getId()];
    var ex = existing[String(l.number)];
    if (!ex) {
      sh.appendRow(row);
      existing[String(l.number)] = { _row: sh.getLastRow(), file_id: f.getId(), json: row[4] };
      added++;
    } else if (ex.json !== row[4]) {
      sh.getRange(ex._row, 1, 1, row.length).setValues([row]);
      ex.file_id = f.getId(); ex.json = row[4];
    }
  });
  if (added && sh.getLastRow() > 2) sh.getRange(2, 1, sh.getLastRow() - 1, LESSON_COLS.length).sort(1);
  return added;
}

// ---------- Web page ----------

function doGet() {
  try { importLessons(); } catch (e) { Logger.log(e); }
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Middle Office Academy')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Everything the page needs, in one call. */
function getData() {
  var lessons = rows_(sheet_('Lessons', LESSON_COLS)).map(function (r) { return JSON.parse(r.json); })
    .sort(function (a, b) { return a.number - b.number; });
  var progress = {};
  rows_(sheet_('Progress', PROGRESS_COLS)).forEach(function (r) {
    progress[String(r.number)] = {
      status: r.status || 'not_written', at: iso_(r.status_at),
      feedback: { difficulty: r.difficulty || null, length: r.length || null, at: iso_(r.feedback_at) }
    };
  });
  var requests = rows_(sheet_('Questions', QUESTION_COLS)).map(function (r) {
    return { id: String(r.id), at: iso_(r.asked_at), lesson: r.lesson || null, text: String(r.text) };
  });
  return { lessons: lessons, progress: progress, requests: requests };
}

function iso_(d) { return d instanceof Date ? d.toISOString() : (d ? String(d) : null); }

function progressRow_(n) {
  var sh = sheet_('Progress', PROGRESS_COLS);
  var r = rows_(sh).filter(function (x) { return String(x.number) === String(n); })[0];
  if (r) return r._row;
  sh.appendRow([n, 'not_written', '', '', '', '']);
  return sh.getLastRow();
}

function lessonNumber_(x) {
  var n = parseInt(x, 10);
  if (!(n >= 1 && n < 100000)) throw new Error('bad lesson number');
  return n;
}

/** status: 'written' or 'not_written'. */
function setStatus(lesson, status) {
  if (['written', 'not_written'].indexOf(status) < 0) throw new Error('bad status');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var row = progressRow_(lessonNumber_(lesson));
    sheet_('Progress', PROGRESS_COLS).getRange(row, 2, 1, 2).setValues([[status, new Date()]]);
  } finally { lock.releaseLock(); }
  return getData();
}

/** kind: 'difficulty' (too_easy, right, too_hard) or 'length' (too_short, right, too_long). */
function setFeedback(lesson, kind, value) {
  var allowed = { difficulty: ['too_easy', 'right', 'too_hard'], length: ['too_short', 'right', 'too_long'] };
  if (!allowed[kind] || allowed[kind].indexOf(value) < 0) throw new Error('bad feedback');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var row = progressRow_(lessonNumber_(lesson)), sh = sheet_('Progress', PROGRESS_COLS);
    sh.getRange(row, kind === 'difficulty' ? 4 : 5).setValue(value);
    sh.getRange(row, 6).setValue(new Date());
  } finally { lock.releaseLock(); }
  return getData();
}

function askQuestion(text, lesson) {
  text = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 600);
  if (text.length < 3) throw new Error('empty question');
  var id = 'q' + Utilities.formatDate(new Date(), 'Etc/UTC', 'yyyyMMddHHmmss');
  sheet_('Questions', QUESTION_COLS).appendRow([id, new Date(), lesson ? lessonNumber_(lesson) : '', text]);
  return getData();
}
