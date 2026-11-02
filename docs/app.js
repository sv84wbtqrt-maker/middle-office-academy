/* Middle Office Academy: static site. Lessons come from lessons/NNN.json, progress from the Apps Script
   web app (live) or data/progress.json (fallback). Buttons POST to the Apps Script web app. */
(function () {
  'use strict';
  var S = { config: {}, index: { lessons: [], latest: 0 }, progress: { lessons: {}, requests: [] }, cache: {} };
  var app = document.getElementById('app');

  // ---------- storage (per device, never required) ----------
  function getLocal(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function setLocal(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  function delLocal(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function inline(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }
  /** Minimal Markdown: paragraphs, - and 1. lists, | tables |, **bold**, *italic*, links. */
  function md(text) {
    var lines = String(text || '').split('\n'), out = [], i = 0;
    while (i < lines.length) {
      var l = lines[i];
      if (!l.trim()) { i++; continue; }
      if (/^\s*\|/.test(l)) {
        var rows = [];
        while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(lines[i]); i++; }
        var body = rows.map(function (r) { return r.trim().replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim(); }); })
          .filter(function (c) { return !c.every(function (x) { return /^:?-+:?$/.test(x); }); });
        var h = '<table><thead><tr>' + body[0].map(function (c) { return '<th>' + inline(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
        body.slice(1).forEach(function (r) { h += '<tr>' + r.map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>'; });
        out.push(h + '</tbody></table>');
        continue;
      }
      var m = /^\s*(-|\*|\d+\.)\s+/.exec(l);
      if (m) {
        var ordered = /\d/.test(m[1]), items = [];
        while (i < lines.length && /^\s*(-|\*|\d+\.)\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*(-|\*|\d+\.)\s+/, '')); i++; }
        var tag = ordered ? 'ol' : 'ul';
        out.push('<' + tag + '>' + items.map(function (x) { return '<li>' + inline(x) + '</li>'; }).join('') + '</' + tag + '>');
        continue;
      }
      var para = [];
      while (i < lines.length && lines[i].trim() && !/^\s*(\||-\s|\*\s|\d+\.\s)/.test(lines[i])) { para.push(lines[i]); i++; }
      out.push('<p>' + inline(para.join(' ')) + '</p>');
    }
    return out.join('');
  }
  function fmtDate(iso) {
    try { return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
    catch (e) { return iso; }
  }
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 3200);
  }
  function getJSON(url) {
    return fetch(url + (url.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(url + ': ' + r.status); return r.json(); });
  }
  function lessonStatus(n) {
    var e = S.progress.lessons && S.progress.lessons[String(n)];
    return (e && e.status) || 'not_written';
  }
  function lessonEntry(n) { return (S.progress.lessons && S.progress.lessons[String(n)]) || {}; }

  // ---------- backend ----------
  function backendReady() { return !!S.config.appsScriptUrl; }
  function loadProgress() {
    var fallback = function () { return getJSON('data/progress.json').catch(function () { return { lessons: {}, requests: [] }; }); };
    if (!backendReady()) return fallback();
    return getJSON(S.config.appsScriptUrl + '?action=progress')
      .then(function (j) { if (!j.ok) throw new Error(j.error); return j.progress; })
      .catch(fallback);
  }
  function askPin() {
    var pin = getLocal('moa_pin');
    if (pin) return pin;
    pin = window.prompt('Enter your PIN (the one saved in the Apps Script properties). It is remembered on this device.');
    if (pin) setLocal('moa_pin', pin.trim());
    return pin ? pin.trim() : null;
  }
  function post(payload) {
    if (!backendReady()) { toast('Buttons not connected yet: add the Apps Script URL in docs/config.json.'); return Promise.reject(new Error('no backend')); }
    var pin = askPin();
    if (!pin) return Promise.reject(new Error('no pin'));
    payload.pin = pin;
    return fetch(S.config.appsScriptUrl, { method: 'POST', body: JSON.stringify(payload) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.ok) {
          if (j.error === 'bad_pin') { delLocal('moa_pin'); throw new Error('Wrong PIN, try again.'); }
          throw new Error(j.error || 'error');
        }
        if (j.progress) S.progress = j.progress;
        return j;
      })
      .catch(function (e) { toast(e.message === 'Failed to fetch' ? 'Network error, try again.' : e.message); throw e; });
  }

  // ---------- views ----------
  function setNav(name) {
    document.querySelectorAll('nav a').forEach(function (a) { a.classList.toggle('active', a.getAttribute('data-nav') === name); });
  }
  function updateProgressBar() {
    var total = S.index.lessons.length, done = S.index.lessons.filter(function (l) { return lessonStatus(l.number) === 'written'; }).length;
    var bar = document.getElementById('progressbar');
    if (!total) { bar.hidden = true; return; }
    bar.hidden = false;
    var roadmap = 161;
    document.getElementById('progressfill').style.width = Math.min(100, done / roadmap * 100) + '%';
    document.getElementById('progresstext').textContent = done + ' lesson' + (done === 1 ? '' : 's') + ' written · core roadmap: ' + roadmap;
  }

  function loadLesson(n) {
    if (S.cache[n]) return Promise.resolve(S.cache[n]);
    var meta = S.index.lessons.filter(function (l) { return l.number === n; })[0];
    if (!meta) return Promise.reject(new Error('Lesson ' + n + ' not found'));
    return getJSON(meta.file).then(function (l) { S.cache[n] = l; return l; });
  }

  function renderLesson(n) {
    setNav(n === S.index.latest ? 'today' : 'archive');
    return loadLesson(n).then(function (l) {
      var latest = n === S.index.latest;
      var h = '';
      h += '<div class="meta"><span>Lesson ' + l.number + '</span><span>' + esc(fmtDate(l.date)) + '</span><span>' + esc(l.module) + '</span><span>≈ ' + l.minutes + ' min of writing</span></div>';
      h += '<h1>' + esc(l.title) + (l.review ? ' <span class="badge todo">review</span>' : '') + '</h1>';
      h += '<div class="label">Read, don\'t copy</div><div class="story">' + md(l.story) + '</div>';
      h += '<div class="paper"><div class="label write">✍️ Copy into your workbook</div>';
      h += '<p><strong>Lesson ' + l.number + ' · ' + esc(l.date) + ' · ' + esc(l.title) + '</strong></p>';
      h += '<p class="objective">' + inline(l.objective) + '</p>';
      l.write.forEach(function (s) { h += '<h3>' + inline(s.heading) + '</h3>' + md(s.body); });
      h += '<h3>Check yourself (copy the questions, answer from memory)</h3>';
      l.check.forEach(function (c, i) {
        h += '<div class="q" id="q' + i + '"><div>' + (i + 1) + '. ' + inline(c.q) + '</div><button class="chip no-print" data-reveal="' + i + '">Show answer</button><div class="a">' + md(c.a) + '</div></div>';
      });
      h += '</div>';
      if (l.read_more) h += '<div class="card"><div class="label">Going further (read only)</div>' + md(l.read_more) + '</div>';
      h += '<p class="muted"><strong>Next:</strong> ' + inline(l.next) + '</p>';
      h += actions(l, latest);
      h += '<div class="pager">' + (n > 1 ? '<a href="#/lesson/' + (n - 1) + '">← Lesson ' + (n - 1) + '</a>' : '<span></span>') +
        (n < S.index.latest ? '<a href="#/lesson/' + (n + 1) + '">Lesson ' + (n + 1) + ' →</a>' : '<span></span>') + '</div>';
      app.innerHTML = h;
      bindLesson(l);
      window.scrollTo(0, 0);
    });
  }

  function actions(l, latest) {
    var st = lessonStatus(l.number), fb = lessonEntry(l.number).feedback || {};
    var h = '<section class="card actions"><div class="label">Your progress</div>';
    if (st === 'written') {
      h += '<div class="status ok">✓ Written. ' + (latest ? 'Your next lesson arrives tomorrow morning.' : '') + '</div>';
      h += '<div class="row"><button data-status="not_written">Undo: I haven\'t written it</button></div>';
    } else {
      h += '<div class="status warn">' + (latest ? 'Not written yet. The next lesson is published only after you mark this one as written: take your time.' : 'Not marked as written.') + '</div>';
      h += '<div class="row"><button class="primary" data-status="written">✓ I have written this lesson</button></div>';
    }
    h += '<div class="row"><span class="muted">Difficulty:</span>' +
      chip('difficulty', 'too_easy', 'Too easy', fb) + chip('difficulty', 'right', 'Just right', fb) + chip('difficulty', 'too_hard', 'Too hard', fb) + '</div>';
    h += '<div class="row"><span class="muted">Length:</span>' +
      chip('length', 'too_short', 'Too short', fb) + chip('length', 'right', 'Just right', fb) + chip('length', 'too_long', 'Too long', fb) + '</div>';
    h += '<div class="row" style="margin-top:14px"><a class="btn" href="#/ask?lesson=' + l.number + '">Ask the teacher about this lesson</a></div>';
    return h + '</section>';
  }
  function chip(kind, value, label, fb) {
    return '<button class="chip' + (fb[kind] === value ? ' on' : '') + '" data-fb="' + kind + '" data-val="' + value + '">' + label + '</button>';
  }

  function bindLesson(l) {
    app.querySelectorAll('[data-reveal]').forEach(function (b) {
      b.addEventListener('click', function () {
        var q = document.getElementById('q' + b.getAttribute('data-reveal'));
        q.classList.toggle('open'); b.textContent = q.classList.contains('open') ? 'Hide answer' : 'Show answer';
      });
    });
    app.querySelectorAll('[data-status]').forEach(function (b) {
      b.addEventListener('click', function () {
        var status = b.getAttribute('data-status');
        b.disabled = true;
        post({ action: 'status', lesson: l.number, status: status }).then(function () {
          toast(status === 'written' ? 'Well done! Saved.' : 'Saved.');
          updateProgressBar(); renderLesson(l.number);
        }).catch(function () { b.disabled = false; });
      });
    });
    app.querySelectorAll('[data-fb]').forEach(function (b) {
      b.addEventListener('click', function () {
        var p = { action: 'feedback', lesson: l.number };
        p[b.getAttribute('data-fb')] = b.getAttribute('data-val');
        b.disabled = true;
        post(p).then(function () { toast('Thanks, the teacher will adapt.'); renderLesson(l.number); })
          .catch(function () { b.disabled = false; });
      });
    });
  }

  function renderArchive() {
    setNav('archive');
    var h = '<h1>All lessons</h1>', module = null;
    var list = S.index.lessons.slice().sort(function (a, b) { return a.number - b.number; });
    if (!list.length) h += '<p class="muted">No lesson yet.</p>';
    list.forEach(function (l) {
      if (l.module !== module) { if (module !== null) h += '</ul>'; module = l.module; h += '<div class="module-title">' + esc(module) + '</div><ul class="list">'; }
      var st = lessonStatus(l.number);
      h += '<li><span class="num">' + l.number + '</span><a href="#/lesson/' + l.number + '">' + esc(l.title) + '<br><span class="muted" style="font-size:13px">' + esc(l.date) + ' · ≈ ' + l.minutes + ' min</span></a>' +
        '<span class="badge ' + (st === 'written' ? 'ok">written' : 'todo">to write') + '</span></li>';
    });
    if (list.length) h += '</ul>';
    var c = {};
    list.forEach(function (l) { l.concepts.forEach(function (x) { c[x] = l.number; }); });
    var keys = Object.keys(c).sort();
    if (keys.length) h += '<h2>Concepts learned (' + keys.length + ')</h2><p class="muted">' + keys.map(function (k) { return '<a href="#/lesson/' + c[k] + '">' + esc(k) + '</a>'; }).join(' · ') + '</p>';
    app.innerHTML = h;
  }

  function renderAsk(query) {
    setNav('ask');
    var lesson = (/lesson=(\d+)/.exec(query || '') || [])[1];
    var reqs = (S.progress.requests || []).slice().reverse();
    var answered = {};
    S.index.lessons.forEach(function (l) { (l.request_ids || []).forEach(function (id) { answered[id] = l.number; }); });
    var h = '<h1>Ask the teacher</h1><p>Something unclear, or a topic you want to learn? Write it here. The teacher reads it and makes it the subject of an upcoming lesson (usually the next one, at most 3 lessons later).</p>';
    h += '<div class="card"><textarea id="askText" maxlength="600" placeholder="e.g. I don\'t understand the difference between a swap and a future. Or: can we see how LNG cargoes are priced?"></textarea>';
    h += '<div class="row"><button class="primary" id="askSend">Send to the teacher</button>' + (lesson ? '<span class="muted">about lesson ' + esc(lesson) + '</span>' : '') + '</div></div>';
    h += '<h2>Your questions</h2>';
    if (!reqs.length) h += '<p class="muted">No question yet.</p>';
    else h += '<ul class="list">' + reqs.map(function (r) {
      return '<li><span class="num">' + esc((r.at || '').slice(5, 10)) + '</span><span style="flex:1">' + esc(r.text) + '</span>' + (answered[r.id] ? '<a class="badge ok" href="#/lesson/' + answered[r.id] + '">lesson ' + answered[r.id] + '</a>' : '<span class="badge todo">sent</span>') + '</li>';
    }).join('') + '</ul>';
    app.innerHTML = h;
    document.getElementById('askSend').addEventListener('click', function () {
      var t = document.getElementById('askText').value.trim();
      if (t.length < 3) { toast('Write your question first.'); return; }
      this.disabled = true;
      var btn = this;
      post({ action: 'ask', text: t, lesson: lesson ? parseInt(lesson, 10) : null })
        .then(function () { toast('Sent! It will shape an upcoming lesson.'); renderAsk(query); })
        .catch(function () { btn.disabled = false; });
    });
  }

  function renderSettings() {
    setNav('settings');
    var pin = getLocal('moa_pin');
    var h = '<h1>Settings</h1><div class="card">';
    h += '<p><strong>Buttons backend:</strong> ' + (backendReady() ? '<span class="badge ok">connected</span>' : '<span class="badge todo">not configured</span> (add the Apps Script URL in <code>docs/config.json</code>)') + '</p>';
    h += '<p><strong>PIN on this device:</strong> ' + (pin ? 'saved' : 'not saved') + '</p>';
    h += '<div class="row"><button id="pinSet">' + (pin ? 'Change PIN' : 'Enter PIN') + '</button>' + (pin ? '<button id="pinDel">Forget PIN</button>' : '') + '<button id="pinTest">Test connection</button></div>';
    h += '</div><div class="card"><p><strong>Theme</strong></p><div class="row">' +
      ['auto', 'light', 'dark'].map(function (t) { return '<button class="chip' + ((getLocal('moa_theme') || 'auto') === t ? ' on' : '') + '" data-theme-set="' + t + '">' + t + '</button>'; }).join('') + '</div></div>';
    h += '<p class="muted">Tip: print a lesson (browser menu → Print) to get a clean page without buttons or answers.</p>';
    app.innerHTML = h;
    document.getElementById('pinSet').addEventListener('click', function () { delLocal('moa_pin'); askPin(); renderSettings(); });
    var del = document.getElementById('pinDel');
    if (del) del.addEventListener('click', function () { delLocal('moa_pin'); renderSettings(); });
    document.getElementById('pinTest').addEventListener('click', function () {
      post({ action: 'check_pin' }).then(function () { toast('Connected, PIN is correct.'); renderSettings(); }).catch(function () { renderSettings(); });
    });
    app.querySelectorAll('[data-theme-set]').forEach(function (b) {
      b.addEventListener('click', function () { setLocal('moa_theme', b.getAttribute('data-theme-set')); applyTheme(); renderSettings(); });
    });
  }

  function applyTheme() {
    var t = getLocal('moa_theme');
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
  }

  function route() {
    var hash = location.hash.replace(/^#/, '') || '/';
    var parts = hash.split('?'), path = parts[0], query = parts[1] || '';
    var m = /^\/lesson\/(\d+)$/.exec(path);
    var p;
    if (m) p = renderLesson(parseInt(m[1], 10));
    else if (path === '/archive') p = Promise.resolve(renderArchive());
    else if (path === '/ask') p = Promise.resolve(renderAsk(query));
    else if (path === '/settings') p = Promise.resolve(renderSettings());
    else if (S.index.latest) p = renderLesson(S.index.latest);
    else { app.innerHTML = '<p>The first lesson is on its way.</p>'; p = Promise.resolve(); }
    p.catch(function (e) { app.innerHTML = '<p>Could not load: ' + esc(e.message) + '</p>'; });
  }

  applyTheme();
  Promise.all([
    getJSON('config.json').catch(function () { return {}; }),
    getJSON('data/lessons.json')
  ]).then(function (r) {
    S.config = r[0] || {}; S.index = r[1];
    return loadProgress();
  }).then(function (p) {
    S.progress = p || { lessons: {}, requests: [] };
    updateProgressBar();
    window.addEventListener('hashchange', route);
    route();
  }).catch(function (e) { app.innerHTML = '<p>Could not load the course: ' + esc(e.message) + '</p>'; });
})();
