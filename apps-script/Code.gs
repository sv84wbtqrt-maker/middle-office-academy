/**
 * Middle Office Academy: web app behind the buttons of the website.
 * It records "I wrote it", feedback and questions in docs/data/progress.json on GitHub.
 *
 * Setup (once): see README.md, section "Apps Script".
 * Script properties (Project Settings > Script properties):
 *   GITHUB_TOKEN : fine-grained token, only this repository, permission "Contents: Read and write"
 *   PIN          : a short secret code you also type once in the website (protects the buttons)
 * Deploy > New deployment > Web app: Execute as "Me", Who has access "Anyone".
 */
var REPO = 'sv84wbtqrt-maker/middle-office-academy';
var BRANCH = 'main';
var PATH = 'docs/data/progress.json';
var MAX_REQUEST_LENGTH = 600;

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'ping';
  try {
    if (action === 'progress') return json_({ ok: true, progress: readProgress_().data });
    return json_({ ok: true, service: 'middle-office-academy' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var pin = PropertiesService.getScriptProperties().getProperty('PIN');
    if (!pin || String(req.pin || '') !== pin) return json_({ ok: false, error: 'bad_pin' });
    if (req.action === 'check_pin') return json_({ ok: true });
    var progress = updateProgress_(function (p) { return apply_(p, req); }, messageFor_(req));
    return json_({ ok: true, progress: progress });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

/** Applies one action to the progress object. Throws on invalid input. */
function apply_(p, req) {
  var now = new Date().toISOString();
  p.lessons = p.lessons || {};
  p.requests = p.requests || [];
  if (req.action === 'status') {
    var n = lessonNumber_(req.lesson);
    if (['written', 'not_written'].indexOf(req.status) < 0) throw new Error('bad status');
    var entry = p.lessons[n] || {};
    entry.status = req.status;
    entry.at = now;
    p.lessons[n] = entry;
  } else if (req.action === 'feedback') {
    var m = lessonNumber_(req.lesson);
    var allowed = { difficulty: ['too_easy', 'right', 'too_hard'], length: ['too_short', 'right', 'too_long'] };
    var e2 = p.lessons[m] || { status: 'not_written' };
    e2.feedback = e2.feedback || {};
    Object.keys(allowed).forEach(function (k) {
      if (req[k] !== undefined) {
        if (allowed[k].indexOf(req[k]) < 0) throw new Error('bad ' + k);
        e2.feedback[k] = req[k];
      }
    });
    e2.feedback.at = now;
    p.lessons[m] = e2;
  } else if (req.action === 'ask') {
    var text = String(req.text || '').replace(/\s+/g, ' ').trim();
    if (text.length < 3) throw new Error('empty question');
    p.requests.push({
      id: 'q' + Utilities.formatDate(new Date(), 'Etc/UTC', 'yyyyMMddHHmmss'),
      text: text.slice(0, MAX_REQUEST_LENGTH),
      lesson: req.lesson ? lessonNumber_(req.lesson) : null,
      at: now
    });
  } else {
    throw new Error('unknown action');
  }
  p.updated_at = now;
  return p;
}

function lessonNumber_(x) {
  var n = parseInt(x, 10);
  if (!(n >= 1 && n < 100000)) throw new Error('bad lesson number');
  return String(n);
}

function messageFor_(req) {
  if (req.action === 'status') return 'Progress: lesson ' + req.lesson + ' ' + req.status;
  if (req.action === 'feedback') return 'Progress: feedback on lesson ' + req.lesson;
  return 'Progress: new question';
}

// ---------- GitHub ----------

function api_(method, path, body) {
  var token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('GITHUB_TOKEN missing in script properties');
  var opts = {
    method: method,
    muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  };
  if (body) { opts.contentType = 'application/json'; opts.payload = JSON.stringify(body); }
  var r = UrlFetchApp.fetch('https://api.github.com/repos/' + REPO + path, opts);
  return { code: r.getResponseCode(), json: JSON.parse(r.getContentText() || '{}') };
}

function readProgress_() {
  var r = api_('get', '/contents/' + PATH + '?ref=' + BRANCH);
  if (r.code === 404) return { sha: null, data: { lessons: {}, requests: [], updated_at: null } };
  if (r.code !== 200) throw new Error('GitHub read failed: ' + r.code + ' ' + (r.json.message || ''));
  var text = Utilities.newBlob(Utilities.base64Decode(r.json.content.replace(/\n/g, ''))).getDataAsString('UTF-8');
  return { sha: r.json.sha, data: JSON.parse(text) };
}

/** Read, modify, write; retries when the file changed in between (409 / 422 conflicts). */
function updateProgress_(mutate, message) {
  for (var attempt = 0; attempt < 3; attempt++) {
    var cur = readProgress_();
    var next = mutate(cur.data);
    var content = Utilities.base64Encode(JSON.stringify(next, null, 1) + '\n', Utilities.Charset.UTF_8);
    var body = { message: message, content: content, branch: BRANCH };
    if (cur.sha) body.sha = cur.sha;
    var w = api_('put', '/contents/' + PATH, body);
    if (w.code === 200 || w.code === 201) return next;
    if (w.code !== 409 && w.code !== 422) throw new Error('GitHub write failed: ' + w.code + ' ' + (w.json.message || ''));
    Utilities.sleep(1500);
  }
  throw new Error('GitHub write conflict, try again');
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/** Run once from the editor to check the token: it should log the current progress. */
function testConnection() {
  Logger.log(JSON.stringify(readProgress_().data));
}
