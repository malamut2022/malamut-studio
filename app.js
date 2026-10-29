/* Сайт студии MALAMUT.
   Работы лежат в works.json и папке media/. Автор входит по ключу GitHub и сохраняет изменения
   прямо в хранилище сайта. Реакции зрителей хранятся в Firebase. */
(function () {
  'use strict';
  var CFG = window.MALAMUT || {};
  var GH = CFG.github || {};
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }

  var KIND_LABEL = { video: 'Видео', image: 'Фото', audio: 'Трек', pdf: 'PDF', text: 'Текст' };
  var MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
  function fmtDate(iso) { var d = new Date(iso); return isNaN(d) ? '' : MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
  function fmtDur(sec) { sec = Math.round(sec); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
  function fmtSize(b) { return Math.max(1, Math.round(b / 1048576)) + ' МБ'; }

  var works = [];
  var localUrl = {};        // только что загруженные файлы, пока сайт ещё не обновился
  function url(path) { return localUrl[path] || path; }

  // ---------- Заставка на первом экране
  var hero = $('heroVideo'), soundBtn = $('soundBtn');
  function pauseHero() { hero.pause(); soundBtn.hidden = false; }
  soundBtn.addEventListener('click', function () {
    hero.muted = false; hero.currentTime = 0; soundBtn.hidden = true;
    hero.play().catch(function () { soundBtn.hidden = false; });
  });
  hero.addEventListener('ended', function () { soundBtn.hidden = false; });

  // ---------- Заставка при входе: сначала «Войти», чтобы браузер разрешил звук
  (function splash() {
    var box = el('div', 'splash');
    var v = el('video');
    v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto'; v.src = 'assets/intro.mp4';
    var gate = el('button', 'splash-gate'); gate.type = 'button';
    gate.style.backgroundImage = 'url("assets/intro-poster.jpg")';
    var enter = el('span', 'splash-enter');
    enter.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4l14 8-14 8z" fill="currentColor"/></svg>';
    enter.appendChild(document.createTextNode('Войти'));
    gate.appendChild(enter);
    gate.appendChild(el('span', 'splash-hint', 'Студия «MALAMUT» · со звуком'));
    box.appendChild(v); box.appendChild(gate);
    document.body.appendChild(box);
    document.documentElement.classList.add('splashing');
    setTimeout(function () { try { gate.focus(); } catch (e) {} }, 50);
    var done = false;
    function finish() {
      if (done) return; done = true;
      v.pause();
      document.documentElement.classList.remove('splashing');
      box.classList.add('gone');
      setTimeout(function () { box.remove(); }, 900);
    }
    v.addEventListener('ended', finish);
    v.addEventListener('error', finish);
    gate.addEventListener('click', function () {
      gate.remove();
      v.muted = false; v.currentTime = 0;
      v.play().catch(finish);
      setTimeout(finish, 20000);
    });
  })();

  // ---------- Просмотр работы; метка в адресе, чтобы «назад» закрывал работу, а не сайт
  var viewer = $('viewer'), stage = $('stage');
  var viewKey = null, viewPushed = false;
  function openView(build, key) {
    pauseHero();
    stage.textContent = '';
    build(stage);
    var bottom = el('button', 'pill back back-bottom', '← Назад к работам'); bottom.type = 'button';
    bottom.addEventListener('click', requestClose);
    stage.appendChild(bottom);
    viewer.hidden = false;
    viewer.scrollTop = 0;
    $('closeView').focus();
    viewKey = 'view-' + String(key || 'work').replace(/[^A-Za-z0-9-]/g, '');
    viewPushed = false;
    try {
      if (location.hash !== '#' + viewKey) { location.hash = viewKey; viewPushed = location.hash === '#' + viewKey; }
    } catch (e) {}
  }
  function closeView() {
    stage.querySelectorAll('video, audio').forEach(function (m) { m.pause(); });
    stage.textContent = ''; viewer.hidden = true; viewKey = null;
  }
  function requestClose() {
    if (viewPushed && location.hash === '#' + viewKey) {
      viewPushed = false;
      history.back();
      setTimeout(function () { if (!viewer.hidden) closeView(); }, 400);
    } else closeView();
  }
  window.addEventListener('hashchange', function () {
    if (!viewer.hidden && viewKey && location.hash !== '#' + viewKey) closeView();
  });
  $('closeView').addEventListener('click', requestClose);

  function viewWork(w) {
    openView(function (s) {
      var au = null;
      if (w.kind === 'video') {
        var v = el('video'); v.controls = true; v.playsInline = true;
        if (w.poster) v.poster = url(w.poster);
        v.src = url(w.file); s.appendChild(v);
        v.play().catch(function () {});
      } else if (w.kind === 'image') {
        var im = el('img'); im.src = url(w.file); im.alt = w.title; s.appendChild(im);
      } else if (w.kind === 'audio') {
        if (w.poster) {
          var cv = el('img', 'cover' + (w.lyrics && w.lyrics.length ? ' small' : ''));
          cv.src = url(w.poster); cv.alt = 'Обложка трека «' + w.title + '»'; s.appendChild(cv);
        }
        au = el('audio'); au.controls = true; au.preload = 'auto'; au.src = url(w.file); s.appendChild(au);
        au.play().catch(function () {});
      }
      s.appendChild(el('h3', null, w.title));
      s.appendChild(rxBar(w));
      if (au) addKaraoke(s, au, w);
      if (w.kind === 'text') s.appendChild(el('p', 'poem', w.body || ''));
      if (w.kind === 'pdf') { var a = el('a', null, 'Открыть PDF'); a.href = url(w.file); a.target = '_blank'; a.rel = 'noopener'; s.appendChild(a); }
      if (w.desc) s.appendChild(el('p', null, w.desc));
    }, w.id);
  }

  // ---------- Караоке
  function addKaraoke(s, au, w) {
    var lines = w.lyrics || [];
    if (lines.length) {
      var box = el('div', 'lyrics');
      var ps = lines.map(function (l) {
        var p = el('p', null, l.x);
        p.addEventListener('click', function () { au.currentTime = l.t; au.play().catch(function () {}); });
        box.appendChild(p); return p;
      });
      s.appendChild(box);
      var cur = -2, raf = null;
      var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      function step() {
        var t = au.currentTime + 0.15, i = -1;
        for (var k = 0; k < lines.length; k++) { if (lines[k].t <= t) i = k; else break; }
        if (i !== cur) {
          cur = i;
          ps.forEach(function (p, k) { p.className = k < i ? 'past' : k === i ? 'now' : ''; });
          var target = ps[Math.max(i, 0)];
          box.scrollTo({ top: target.offsetTop - box.clientHeight / 2 + target.offsetHeight / 2, behavior: reduce ? 'auto' : 'smooth' });
        }
        if (!au.paused && !viewer.hidden) raf = requestAnimationFrame(step);
      }
      au.addEventListener('play', function () { cancelAnimationFrame(raf); raf = requestAnimationFrame(step); });
      au.addEventListener('seeked', step);
      au.addEventListener('timeupdate', function () { if (au.paused) step(); });
      setTimeout(step, 50);
    }
    if (isEditing()) {
      var kb = el('button', 'pill', lines.length ? 'Переделать караоке' : 'Сделать караоке'); kb.type = 'button';
      kb.addEventListener('click', function () { kb.remove(); karaokeEditor(s, au, w); });
      s.appendChild(kb);
    }
  }
  function karaokeEditor(s, au, w) {
    var old = s.querySelector('.lyrics'); if (old) old.hidden = true;
    var panel = el('div', 'kedit');
    var help = el('p', 'hint', 'Вставьте слова песни: каждая строка с новой строки. Потом нажмите «Начать», песня заиграет с начала. Жмите «Строка» (или пробел) в тот момент, когда начинается каждая строка.');
    panel.appendChild(help);
    var ta = el('textarea'); ta.setAttribute('aria-label', 'Слова песни');
    ta.value = (w.lyrics || []).map(function (l) { return l.x; }).join('\n');
    panel.appendChild(ta);
    var nowEl = el('p', 'k-now'), nextEl = el('p', 'k-next'), status = el('p', 'status');
    var row = el('div', 'row');
    var start = el('button', 'pill solid', 'Начать'); start.type = 'button';
    var cancel = el('button', 'pill', 'Отмена'); cancel.type = 'button';
    row.appendChild(start); row.appendChild(cancel);
    panel.appendChild(row); panel.appendChild(status);
    s.appendChild(panel);
    ta.focus();
    var lines = [], times = [], tap = null;
    function onKey(e) { if (e.code === 'Space' && tap && !tap.disabled) { e.preventDefault(); e.stopPropagation(); mark(); } }
    function stopKeys() { document.removeEventListener('keydown', onKey, true); }
    cancel.addEventListener('click', function () { stopKeys(); panel.remove(); if (old) old.hidden = false; });
    function show() {
      nowEl.textContent = times.length ? lines[times.length - 1] : '…';
      nextEl.textContent = times.length < lines.length ? 'Дальше: ' + lines[times.length] : 'Это была последняя строка';
    }
    function mark() { times.push(au.currentTime); show(); if (times.length === lines.length) finish(); }
    function finish() {
      tap.disabled = true; stopKeys();
      var saveBtn = el('button', 'pill solid', 'Сохранить караоке'); saveBtn.type = 'button';
      var again = el('button', 'pill', 'Заново'); again.type = 'button';
      row.textContent = ''; row.appendChild(saveBtn); row.appendChild(again); row.appendChild(cancel);
      status.textContent = 'Все строки отмечены. Сохраните или пройдите заново.';
      again.addEventListener('click', function () { panel.remove(); if (old) old.hidden = false; karaokeEditor(s, au, w); });
      saveBtn.addEventListener('click', function () {
        saveBtn.disabled = true; status.classList.remove('err'); status.textContent = 'Сохраняю…';
        var lyr = lines.map(function (x, i) { return { t: Math.round(times[i] * 10) / 10, x: x }; });
        saveWorks('Караоке: ' + w.title, function (list) {
          return list.map(function (x) { return x.id === w.id ? Object.assign({}, x, { lyrics: lyr }) : x; });
        }, []).then(function () {
          status.textContent = 'Сохранено. Гости увидят караоке через 1–2 минуты.';
        }).catch(function (e) { saveBtn.disabled = false; status.textContent = errText(e); status.classList.add('err'); });
      });
    }
    start.addEventListener('click', function () {
      lines = ta.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
      if (!lines.length) { status.textContent = 'Сначала вставьте слова песни.'; status.classList.add('err'); return; }
      status.classList.remove('err'); status.textContent = '';
      ta.hidden = true; help.hidden = true;
      panel.insertBefore(nextEl, row); panel.insertBefore(nowEl, nextEl);
      tap = el('button', 'pill solid tap', 'Строка ▶'); tap.type = 'button';
      tap.addEventListener('click', mark);
      row.textContent = ''; row.appendChild(tap); row.appendChild(cancel);
      document.addEventListener('keydown', onKey, true);
      au.currentTime = 0; au.play().catch(function () {});
      show(); tap.focus();
    });
  }

  // ---------- Галерея
  var WAVE = '<svg viewBox="0 0 120 60" fill="#9fd4ff" aria-hidden="true"><rect x="2" y="24" width="6" height="12" rx="3"/><rect x="14" y="16" width="6" height="28" rx="3"/><rect x="26" y="6" width="6" height="48" rx="3"/><rect x="38" y="18" width="6" height="24" rx="3"/><rect x="50" y="10" width="6" height="40" rx="3"/><rect x="62" y="2" width="6" height="56" rx="3"/><rect x="74" y="14" width="6" height="32" rx="3"/><rect x="86" y="8" width="6" height="44" rx="3"/><rect x="98" y="20" width="6" height="20" rx="3"/><rect x="110" y="26" width="6" height="8" rx="3"/></svg>';
  var PLAY = '<span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4l14 8-14 8z" fill="currentColor"/></svg></span>';
  var EXPAND = '<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></span>';
  var SECTIONS = ['video', 'projects', 'music', 'photo', 'obrazy'];
  var EMPTY = { video: 'Скоро здесь появятся новые видео.', projects: 'Скоро здесь появятся тексты и проекты.', music: 'Скоро здесь появятся песни.', photo: 'Скоро здесь появятся фото и картинки.', obrazy: 'Скоро здесь появятся новые образы.' };
  function sectionOf(w) { if (SECTIONS.indexOf(w.section) >= 0) return w.section; return w.kind === 'video' ? 'video' : w.kind === 'audio' ? 'music' : w.kind === 'image' ? 'photo' : 'projects'; }

  function render() {
    var edit = isEditing();
    document.querySelectorAll('.work, .empty').forEach(function (n) { n.remove(); });
    works.slice().sort(function (a, b) { return a.added < b.added ? 1 : -1; }).forEach(function (w) {
      var card = el('article', 'work');
      var t = el('div', 'thumb');
      if (w.poster || w.kind === 'image') { var im = el('img'); im.src = url(w.poster || w.file); im.alt = w.title; im.loading = 'lazy'; t.appendChild(im); }
      else if (w.kind === 'video') { var vd = el('video'); vd.muted = true; vd.playsInline = true; vd.preload = 'metadata'; vd.src = url(w.file) + '#t=0.5'; t.appendChild(vd); }
      else if (w.kind === 'audio') { var ac = el('div', 'audiocover'); ac.innerHTML = WAVE; t.appendChild(ac); }
      else if (w.kind === 'text') { t.appendChild(el('div', 'textcover', w.body || '')); }
      else { t.appendChild(el('div', 'doccover', 'PDF')); }
      var playable = w.kind === 'video' || w.kind === 'audio';
      var b = el('button', 'open' + (playable ? ' is-video' : '')); b.type = 'button';
      b.setAttribute('aria-label', 'Открыть: ' + w.title);
      b.innerHTML = playable ? PLAY : EXPAND;
      b.addEventListener('click', function () { viewWork(w); });
      t.appendChild(b);
      card.appendChild(t);
      var m = el('div', 'meta'); m.appendChild(el('span', null, (w.kind === 'image' && w.section === 'projects') ? 'Плакат' : (KIND_LABEL[w.kind] || 'Работа'))); m.appendChild(el('span', null, w.duration || fmtDate(w.added))); card.appendChild(m);
      card.appendChild(el('h3', null, w.title));
      if (w.desc) card.appendChild(el('p', null, w.desc));
      card.appendChild(rxBar(w));
      if (edit) card.appendChild(removeButton(w));
      $('grid-' + sectionOf(w)).appendChild(card);
    });
    SECTIONS.forEach(function (k) {
      var g = $('grid-' + k), n = g.querySelectorAll('.work').length;
      $('count-' + k).textContent = n ? String(n) : '';
      if (!n) g.appendChild(el('p', 'empty', EMPTY[k]));
    });
  }

  function loadWorks() {
    return fetch('works.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('works'); return r.json(); })
      .then(function (list) { works = Array.isArray(list) ? list : []; render(); })
      .catch(function () { works = []; render(); });
  }

  // ---------- Реакции ❤️ 🔥 💩 (Firebase)
  var RX = [{ k: 'heart', e: '❤️', n: 'Нравится' }, { k: 'fire', e: '🔥', n: 'Супер' }, { k: 'poop', e: '💩', n: 'Кекс' }];
  var rxCounts = {}, rxMine = {}, rxReady = false, rxDb = null, rxUid = null;
  function rxBar(w) {
    var bar = el('div', 'rx'); bar.setAttribute('data-w', w.id);
    if (!CFG.firebase) { bar.hidden = true; return bar; }
    RX.forEach(function (r) {
      var btn = el('button'); btn.type = 'button'; btn.setAttribute('data-k', r.k); btn.title = r.n;
      btn.appendChild(el('span', 'e', r.e)); btn.appendChild(el('span', 'n', '0'));
      btn.addEventListener('click', function () { react(w.id, r.k); });
      bar.appendChild(btn);
    });
    paintBar(bar);
    return bar;
  }
  function paintBar(bar) {
    var id = bar.getAttribute('data-w'), c = rxCounts[id] || {};
    bar.querySelectorAll('button').forEach(function (btn) {
      var k = btn.getAttribute('data-k'), n = c[k] || 0, r = RX.filter(function (x) { return x.k === k; })[0];
      btn.querySelector('.n').textContent = String(n);
      btn.classList.toggle('mine', rxMine[id] === k);
      btn.disabled = !rxReady;
      btn.setAttribute('aria-label', r.n + ': ' + n);
      btn.setAttribute('aria-pressed', String(rxMine[id] === k));
    });
  }
  function paintAll() { document.querySelectorAll('.rx').forEach(paintBar); }
  function react(id, k) {
    if (!rxReady) return;
    var ref = rxDb.collection('votes').doc(id + '_' + rxUid);
    var prev = rxMine[id];
    if (prev === k) { delete rxMine[id]; ref.delete().catch(function () {}); }
    else { rxMine[id] = k; ref.set({ w: id, u: rxUid, r: k, at: firebase.firestore.FieldValue.serverTimestamp() }).catch(function () {}); }
    paintAll();
  }
  function loadScript(src) {
    return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  }
  function initReactions() {
    if (!CFG.firebase) return;
    var base = 'https://www.gstatic.com/firebasejs/10.12.2/';
    loadScript(base + 'firebase-app-compat.js')
      .then(function () { return Promise.all([loadScript(base + 'firebase-auth-compat.js'), loadScript(base + 'firebase-firestore-compat.js')]); })
      .then(function () {
        firebase.initializeApp(CFG.firebase);
        rxDb = firebase.firestore();
        var votes = [];
        function tally() {
          rxCounts = {}; var mine = {};
          votes.forEach(function (v) {
            var c = rxCounts[v.w] = rxCounts[v.w] || {};
            c[v.r] = (c[v.r] || 0) + 1;
            if (rxUid && v.u === rxUid) mine[v.w] = v.r;
          });
          rxMine = mine; paintAll();
        }
        rxDb.collection('votes').onSnapshot(function (snap) {
          votes = [];
          snap.forEach(function (d) { var v = d.data(); if (v && v.w && v.r) votes.push(v); });
          tally();
        }, function () {});
        firebase.auth().onAuthStateChanged(function (u) {
          if (!u) return;
          rxUid = u.uid; rxReady = true; tally();
        });
        return firebase.auth().signInAnonymously();
      })
      .catch(function () { /* без реакций сайт работает как обычно */ });
  }

  // ---------- Вход автора и сохранение в GitHub
  var token = store('malamut_token') || null, guestView = false;
  function isEditing() { return !!token && !guestView; }
  function api(path, opts) {
    opts = opts || {};
    return fetch('https://api.github.com/repos/' + GH.owner + '/' + GH.repo + path, {
      method: opts.method || 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      if (r.status === 401) throw { code: 'bad_token' };
      if (r.status === 403 || r.status === 404) throw { code: 'no_access' };
      if (r.status === 409 || r.status === 422) throw { code: 'conflict' };
      if (!r.ok) throw { code: 'network' };
      return r.status === 204 ? null : r.json();
    }, function () { throw { code: 'network' }; });
  }
  function b64Text(str) { return btoa(unescape(encodeURIComponent(str))); }
  function textB64(b) { return decodeURIComponent(escape(atob(b.replace(/\s/g, '')))); }
  function b64File(blob) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(String(fr.result).split(',')[1] || ''); };
      fr.onerror = function () { rej({ code: 'read' }); };
      fr.readAsDataURL(blob);
    });
  }
  function freshWorks() {
    return api('/contents/works.json?ref=' + GH.branch).then(function (r) { return JSON.parse(textB64(r.content)); });
  }
  // Одним коммитом: файлы (blob — загрузить, null — удалить) и новый works.json
  function saveWorks(message, change, files, onStep) {
    var head, baseTree, list;
    return api('/git/ref/heads/' + GH.branch)
      .then(function (r) { head = r.object.sha; return api('/git/commits/' + head); })
      .then(function (c) { baseTree = c.tree.sha; return freshWorks(); })
      .then(function (current) {
        list = change(current);
        var entries = [], i = 0;
        function next() {
          if (i >= files.length) return entries;
          var f = files[i++];
          if (f.blob === null) { entries.push({ path: f.path, mode: '100644', type: 'blob', sha: null }); return next(); }
          onStep && onStep('Загружаю ' + (f.label || f.path) + '…');
          return b64File(f.blob).then(function (b64) { return api('/git/blobs', { method: 'POST', body: { content: b64, encoding: 'base64' } }); })
            .then(function (r) { entries.push({ path: f.path, mode: '100644', type: 'blob', sha: r.sha }); return next(); });
        }
        return next();
      })
      .then(function (entries) {
        onStep && onStep('Сохраняю…');
        entries.push({ path: 'works.json', mode: '100644', type: 'blob', content: JSON.stringify(list, null, 1) + '\n' });
        return api('/git/trees', { method: 'POST', body: { base_tree: baseTree, tree: entries } });
      })
      .then(function (tree) { return api('/git/commits', { method: 'POST', body: { message: message, tree: tree.sha, parents: [head] } }); })
      .then(function (c) { return api('/git/refs/heads/' + GH.branch, { method: 'PATCH', body: { sha: c.sha } }); })
      .then(function () { works = list; render(); return list; });
  }
  function errText(e) {
    var c = e && e.code;
    if (c === 'bad_token') return 'Ключ доступа не подходит или устарел. Выйдите и войдите с новым ключом.';
    if (c === 'no_access') return 'У этого ключа нет доступа к хранилищу сайта. Проверьте его настройки.';
    if (c === 'conflict') return 'Сайт только что изменился в другом окне. Обновите страницу и повторите.';
    if (c === 'too_big') return 'Файл больше 95 МБ. Сожмите его или пришлите Claude.';
    if (c === 'read') return 'Не получилось прочитать файл. Попробуйте ещё раз.';
    return 'Не получилось сохранить: проверьте интернет и попробуйте ещё раз.';
  }

  function removeButton(w) {
    var rm = el('button', 'remove', 'Убрать с сайта'); rm.type = 'button';
    rm.addEventListener('click', function () {
      if (!rm.classList.contains('armed')) {
        rm.classList.add('armed'); rm.textContent = 'Нажмите ещё раз, чтобы убрать';
        setTimeout(function () { rm.classList.remove('armed'); rm.textContent = 'Убрать с сайта'; }, 4000);
        return;
      }
      rm.disabled = true; rm.textContent = 'Убираю…';
      var files = [w.file, w.poster].filter(function (p) { return p && /^media\//.test(p); }).map(function (p) { return { path: p, blob: null }; });
      saveWorks('Убрана работа: ' + w.title, function (list) { return list.filter(function (x) { return x.id !== w.id; }); }, files)
        .catch(function (e) { rm.disabled = false; rm.textContent = errText(e); });
    });
    return rm;
  }

  // Вход
  var login = $('login');
  function setOwnerUi() {
    $('ownerBar').hidden = !token || guestView;
    $('loginLink').textContent = token ? 'Выйти из режима автора' : 'Вход для автора';
    render();
  }
  $('loginLink').addEventListener('click', function () {
    if (token) { token = null; store('malamut_token', null); guestView = false; setOwnerUi(); return; }
    $('loginStatus').textContent = ''; $('fToken').value = ''; login.hidden = false; $('fToken').focus();
  });
  $('cancelLogin').addEventListener('click', function () { login.hidden = true; });
  $('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var t = $('fToken').value.trim(), st = $('loginStatus');
    if (!t) { st.textContent = 'Вставьте ключ доступа.'; st.classList.add('err'); return; }
    st.classList.remove('err'); st.textContent = 'Проверяю…';
    token = t;
    api('').then(function (repo) {
      if (!repo.permissions || !repo.permissions.push) throw { code: 'no_access' };
      store('malamut_token', t); login.hidden = true; setOwnerUi();
      return freshWorks().then(function (list) { works = list; render(); });
    }).catch(function (err) { token = null; st.textContent = errText(err); st.classList.add('err'); });
  });

  // Как видят гости
  var guestNote = null;
  $('guestBtn').addEventListener('click', function () {
    guestView = true; setOwnerUi();
    guestNote = el('button', 'pill solid guest-note', 'Так сайт видят гости · Вернуться'); guestNote.type = 'button';
    guestNote.addEventListener('click', function () { guestView = false; guestNote.remove(); setOwnerUi(); });
    document.body.appendChild(guestNote);
  });

  // ---------- Добавление работы
  var adder = $('adder'), form = $('addForm'), fKind = $('fKind'), fFile = $('fFile'), statusEl = $('status'), warnEl = $('fileWarn');
  var MAX = 95 * 1024 * 1024;
  function setStatus(t, err) { statusEl.textContent = t; statusEl.classList.toggle('err', !!err); }
  function syncKind() { var t = fKind.value === 'text'; $('fileField').hidden = t; $('textField').hidden = !t; if (t) $('coverField').hidden = true; }
  function openAdder() {
    form.reset(); $('fileName').textContent = 'Выберите файл или перетащите сюда'; $('coverField').hidden = true; warnEl.hidden = true;
    syncKind(); setStatus(''); $('saveBtn').disabled = false; adder.hidden = false; fKind.focus();
  }
  $('addBtn').addEventListener('click', openAdder);
  $('cancelAdd').addEventListener('click', function () { adder.hidden = true; });
  fKind.addEventListener('change', syncKind);

  function kindOf(f) {
    var t = (f.type || '').toLowerCase(), n = f.name.toLowerCase();
    if (t.indexOf('audio/') === 0 || /\.(mp3|m4a|wav|aac|ogg|oga|opus|flac)$/.test(n)) return 'audio';
    if (t.indexOf('video/') === 0 || /\.(mp4|m4v|mov|webm)$/.test(n)) return 'video';
    if (t.indexOf('image/') === 0 || /\.(jpe?g|png|gif|webp)$/.test(n)) return 'image';
    if (t === 'application/pdf' || /\.pdf$/.test(n)) return 'pdf';
    return null;
  }
  function extOf(f) { var m = f.name.toLowerCase().match(/\.([a-z0-9]{2,5})$/); return m ? m[1] : 'bin'; }
  // Длина, обложка из кадра и проверка, что видео вообще показывается в этом браузере
  function probe(file, kind) {
    return new Promise(function (resolve) {
      var u = URL.createObjectURL(file), out = { duration: null, poster: null, playable: true }, finished = false;
      var timer = setTimeout(function () { end(); }, 15000);
      function end() { if (finished) return; finished = true; clearTimeout(timer); URL.revokeObjectURL(u); resolve(out); }
      if (kind === 'audio') {
        var a = document.createElement('audio'); a.preload = 'metadata';
        a.onloadedmetadata = function () { if (isFinite(a.duration)) out.duration = a.duration; end(); };
        a.onerror = function () { out.playable = false; end(); };
        a.src = u; return;
      }
      var v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto';
      v.onerror = function () { out.playable = false; end(); };
      v.onloadedmetadata = function () {
        if (isFinite(v.duration)) out.duration = v.duration;
        if (!v.videoWidth) { out.playable = false; end(); return; }
        v.currentTime = Math.min(2, v.duration / 3 || 1);
      };
      v.onseeked = function () {
        try {
          var s = Math.min(1, 1280 / v.videoWidth), c = document.createElement('canvas');
          c.width = Math.round(v.videoWidth * s); c.height = Math.round(v.videoHeight * s);
          c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
          c.toBlob(function (b) { out.poster = b; end(); }, 'image/jpeg', 0.85);
        } catch (e) { end(); }
      };
      v.src = u;
    });
  }
  var probed = null;
  fFile.addEventListener('change', function () {
    var f = fFile.files[0]; probed = null; warnEl.hidden = true;
    $('fileName').textContent = f ? f.name + ' · ' + fmtSize(f.size) : 'Выберите файл или перетащите сюда';
    if (!f) return;
    var k = kindOf(f);
    $('coverField').hidden = k !== 'audio';
    if (!$('fTitle').value) $('fTitle').value = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
    if (f.size > MAX) { warnEl.textContent = 'Файл весит ' + fmtSize(f.size) + ', а можно до 95 МБ. Сожмите его или пришлите Claude.'; warnEl.hidden = false; return; }
    if (k === 'video' || k === 'audio') {
      probed = probe(f, k).then(function (p) {
        if (!p.playable && k === 'video') {
          warnEl.textContent = 'Этот браузер не может показать видео: скорее всего, оно снято в формате HEVC, как снимает iPhone. У многих зрителей оно не заиграет. Лучше пришлите его Claude, а на будущее включите на iPhone: Настройки → Камера → Форматы → «Наиболее совместимые».';
          warnEl.hidden = false;
        }
        return p;
      });
    }
  });
  var drop = $('drop');
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) {
    if (e.dataTransfer && e.dataTransfer.files.length) { try { fFile.files = e.dataTransfer.files; } catch (x) {} fFile.dispatchEvent(new Event('change')); }
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var title = $('fTitle').value.trim(), desc = $('fDesc').value.trim(), isText = fKind.value === 'text';
    if (!title) { setStatus('Напишите название работы.', true); $('fTitle').focus(); return; }
    var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    var item = { id: id, title: title, desc: desc, added: new Date().toISOString() };
    var files = [];
    var f = fFile.files[0], kind = null;
    if (isText) {
      var body = $('fBody').value;
      if (!body.trim()) { setStatus('Добавьте сам текст.', true); $('fBody').focus(); return; }
      item.kind = 'text'; item.body = body;
    } else {
      if (!f) { setStatus('Выберите файл.', true); return; }
      kind = kindOf(f);
      if (!kind) { setStatus('Такой формат не подходит. Подойдут видео, музыка, фото или PDF.', true); return; }
      if (f.size > MAX) { setStatus(errText({ code: 'too_big' }), true); return; }
      item.kind = kind; item.file = 'media/' + id + '.' + extOf(f);
      files.push({ path: item.file, blob: f, label: 'файл (' + fmtSize(f.size) + ')' });
    }
    var btn = $('saveBtn'); btn.disabled = true; setStatus('Готовлю…');
    var prep = (kind === 'video' || kind === 'audio') ? (probed || probe(f, kind)) : Promise.resolve(null);
    prep.then(function (p) {
      if (p && p.duration) item.duration = fmtDur(p.duration);
      if (p && p.poster) { item.poster = 'media/' + id + '.jpg'; files.push({ path: item.poster, blob: p.poster, label: 'обложку' }); }
      var cover = kind === 'audio' && $('fCover').files[0];
      if (cover) { item.poster = 'media/' + id + '-cover.' + extOf(cover); files.push({ path: item.poster, blob: cover, label: 'обложку' }); }
      return saveWorks('Новая работа: ' + title, function (list) { return list.concat([item]); }, files, setStatus);
    }).then(function () {
      files.forEach(function (x) { if (x.blob) localUrl[x.path] = URL.createObjectURL(x.blob); });
      render();
      setStatus('Опубликовано! У гостей работа появится через 1–2 минуты.');
      setTimeout(function () { adder.hidden = true; }, 1600);
    }).catch(function (err) { setStatus(errText(err), true); btn.disabled = false; });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!viewer.hidden) requestClose(); else if (!adder.hidden) adder.hidden = true; else if (!login.hidden) login.hidden = true;
  });

  // ---------- Старт
  setOwnerUi();
  loadWorks().then(function () {
    if (token) freshWorks().then(function (list) { works = list; render(); }).catch(function () {});
  });
  initReactions();
})();
