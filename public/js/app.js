// Best Warrior app: screens, routing and actions.
// Screens are plain template strings; every piece of text from data goes through esc().
// Clicks are handled by one delegated listener that looks up data-act on the clicked element.
(function () {
  var C = window.BWC_CONFIG;
  var Q = window.BWC_QUESTIONS || [];
  var SRC = window.BWC_SOURCES || {};
  var Store = BWC.Store;
  var P = BWC.Progress;

  var app = document.getElementById('app');
  var nav = document.getElementById('nav');

  // Loaded data for the signed-in person.
  var S = { user: null, attempts: [], ledger: [], learned: {}, daily: {}, quiz: null, flash: null };
  var actions = {};

  // ---------- helpers ----------

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var ICON = {
    home: 'M3 11l9-8 9 8 M5 9.5V21h14V9.5',
    book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z M4 21V5 M8 7h7',
    mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z M19 11a7 7 0 0 1-14 0 M12 18v3 M8 21h8',
    fitness: 'M3 12h4l3-8 4 16 3-8h4',
    compass: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M15.5 8.5l-2 5-5 2 2-5z',
    target: 'M12 5a7 7 0 1 0 0 14a7 7 0 1 0 0-14z M12 2v6 M12 16v6 M2 12h6 M16 12h6',
    medic: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
    trophy: 'M8 4h8v5a4 4 0 0 1-8 0z M8 6H4a3 3 0 0 0 4 4 M16 6h4a3 3 0 0 1-4 4 M12 13v4 M8 21h8 M9 17h6v4H9z',
    user: 'M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8z M4 21a8 8 0 0 1 16 0',
    star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.5 2.9 1-6.1L3.1 9.5l6.2-.9z',
    flame: 'M12 3c2 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-7 1 2 2 3 3 3 0-3-1-5 0-7z',
    flag: 'M5 21V4 M5 4h11l-2 4 2 4H5',
    chat: 'M4 5h16v11H9l-5 4z',
    shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
    chain: 'M10 14a4 4 0 0 1 0-5.6l2-2a4 4 0 0 1 5.6 5.6l-1 1 M14 10a4 4 0 0 1 0 5.6l-2 2a4 4 0 0 1-5.6-5.6l1-1',
    shirt: 'M8 3l-5 4 3 4 2-1v11h8V10l2 1 3-4-5-4c-1 2-2.5 3-4 3S9 5 8 3z',
    medal: 'M8 3l4 7 4-7 M12 10a5 5 0 1 0 0 10a5 5 0 1 0 0-10z',
    clipboard: 'M9 3h6v3H9z M7 5H5v16h14V5h-2 M8 11h8 M8 15h6',
    radio: 'M4 9h16v12H4z M8 9l8-6 M8 15a2 2 0 1 0 0.01 0 M13 13h4 M13 17h4',
    alert: 'M12 3l10 18H2z M12 10v5 M12 18v0.5',
    shield2: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
    settings: 'M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z M12 2v3 M12 19v3 M2 12h3 M19 12h3 M4.9 4.9l2.1 2.1 M17 17l2.1 2.1 M4.9 19.1L7 17 M17 7l2.1-2.1',
    doc: 'M6 3h9l4 4v14H6z M14 3v5h5 M9 13h7 M9 17h5',
    check: 'M4 12l5 5L20 6',
    x: 'M6 6l12 12 M18 6L6 18',
    arrow: 'M5 12h14 M13 6l6 6-6 6',
    back: 'M19 12H5 M11 6l-6 6 6 6'
  };

  function icon(name, size, sw) {
    return '<svg width="' + (size || 22) + '" height="' + (size || 22) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' +
      (sw || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + (ICON[name] || ICON.star) + '"></path></svg>';
  }

  function act(name, fn) { actions[name] = fn; return name; }

  function topicById(id) { return C.topics.filter(function (t) { return t.id === id; })[0]; }
  function questionsFor(topic) { return Q.filter(function (q) { return q.topic === topic; }); }
  function initials(name) {
    var parts = String(name || '?').trim().split(/\s+/);
    return ((parts[0] || '?')[0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }
  function displayName(u) { return ((u.rank ? u.rank + ' ' : '') + (u.name || 'Soldier')).trim(); }
  function isLeader() { return S.user && (S.user.role === 'leader' || S.user.role === 'admin'); }
  function isAdmin() { return S.user && S.user.role === 'admin'; }
  function points() { return (S.user && S.user.points) || 0; }

  function toast(msg) {
    document.querySelectorAll('.toast').forEach(function (old) { old.remove(); });
    var t = document.createElement('div');
    t.className = 'toast';
    t.setAttribute('role', 'status');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }

  function applyTheme() {
    var theme = (S.user && S.user.theme) || 'black-gold';
    document.documentElement.setAttribute('data-theme', theme);
  }

  // Source link for a question or publication: opens the official PDF at the cited page.
  function sourceLink(pub, page, label) {
    var s = SRC[pub];
    if (!s || !s.url) {
      return '<span class="cite">' + esc(pub) + (page ? ', page ' + page : '') + ': unit copy, ask your sponsor or the BWC NCOIC</span>';
    }
    var href = s.url + (page ? '#page=' + page : '');
    return '<a class="btn small ghost" href="' + esc(href) + '" target="_blank" rel="noopener" data-act="read" data-arg="' + esc(pub) + '">' +
      icon('doc', 18) + esc(label || 'Open ' + pub) + '</a>' + (s.cac ? ' <span class="chip">CAC may be required</span>' : '');
  }

  // ---------- points ----------

  function award(entries) {
    if (!entries.length) return Promise.resolve();
    // Points per save are capped by the security rules, so large awards go in chunks.
    var sum = entries.reduce(function (s, e) { return s + e.pts; }, 0);
    if (Store.cloud && sum > 100) {
      var half = Math.ceil(entries.length / 2);
      return award(entries.slice(0, half)).then(function () { return award(entries.slice(half)); });
    }
    var before = P.rankFor(points()).rank;
    return Store.addPoints(entries).then(function (total) {
      S.user.points = total;
      entries.forEach(function (e) { S.ledger.push(Object.assign({ at: Date.now() }, e)); });
      var after = P.rankFor(total).rank;
      if (after.need > before.need) celebrate(after);
    });
  }

  function celebrate(rank) {
    var wrap = document.createElement('div');
    wrap.className = 'celebrate';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', 'Promotion');
    wrap.innerHTML = '<div class="box"><div class="eyebrow">Promoted</div><div class="rank-badge">' + esc(rank.id) + '</div>' +
      '<h2>' + esc(rank.name) + '</h2><p>Keep studying to earn your next stripe.</p>' +
      '<button class="btn" type="button">Hooah</button></div>';
    wrap.querySelector('button').addEventListener('click', function () { wrap.remove(); });
    document.body.appendChild(wrap);
    wrap.querySelector('button').focus();
  }

  // ---------- navigation ----------

  function renderNav(route) {
    var items = [
      { href: '#/', label: 'Home', icon: 'home', on: route === 'home' },
      { href: '#/study', label: 'Study', icon: 'book', on: ['study', 'topic', 'flash', 'creeds', 'creed', 'audio'].indexOf(route) >= 0 },
      { href: '#/quiz/daily', label: 'Daily 10', icon: 'flame', on: route === 'quiz' },
      { href: '#/squad', label: 'Squad', icon: 'chat', on: route === 'squad' || route === 'thread' || route === 'leaderboard' },
      { href: '#/me', label: 'Me', icon: 'user', on: route === 'me' || route === 'admin' || route === 'team' }
    ];
    nav.innerHTML = '<div class="inner">' + items.map(function (n) {
      return '<a href="' + n.href + '" class="' + (n.on ? 'active' : '') + '"' + (n.on ? ' aria-current="page"' : '') + '>' + icon(n.icon) + esc(n.label) + '</a>';
    }).join('') + '</div>';
    nav.hidden = false;
  }

  function header(title, backHref) {
    return '<div class="row">' + (backHref ? '<a class="btn small ghost" href="' + backHref + '" aria-label="Back">' + icon('back', 18) + '</a>' : '') +
      '<h1 class="grow">' + esc(title) + '</h1></div>';
  }

  // ---------- gate screens ----------

  function viewSignIn() {
    nav.hidden = true;
    app.innerHTML =
      '<div class="stack" style="margin-top:8vh">' +
      '<div class="banner"><div class="grow"><div class="eyebrow">' + esc(C.season) + ' Best Warrior</div>' +
      '<div class="big">Train to win.</div><p>Study the doctrine, sit the board, earn your stripes.</p></div>' + icon('star', 64, 1.8) + '</div>' +
      '<button class="btn block" type="button" data-act="' + act('signin', function () {
        Store.signIn().catch(function (e) { toast('Sign-in failed: ' + (e && e.message ? e.message : 'try again')); });
      }) + '">Sign in with Google</button>' +
      '<p class="muted small">Access is limited to Soldiers approved by your unit admins. After you sign in, an admin approves your account.</p>' +
      '</div>';
  }

  function viewPending() {
    nav.hidden = true;
    app.innerHTML =
      '<div class="stack" style="margin-top:8vh">' + header('Waiting for approval') +
      '<div class="card"><p>Your account is waiting for a unit admin to approve it. You signed in as <strong>' + esc(S.user.name || 'a new user') +
      '</strong>.</p><p class="muted">Let your sponsor or the BWC NCOIC know you signed up. This page updates when you check again.</p>' +
      '<button class="btn" type="button" data-act="' + act('recheck', function () { location.reload(); }) + '">Check again</button>' +
      '<button class="link-btn" type="button" data-act="' + act('selfadmin', function () {
        Store.updateUser(S.user.uid, { status: 'approved', role: 'admin' }).then(function () { location.reload(); })
          .catch(function () { toast('Only the admin email set in firestore.rules can do this.'); });
      }) + '">I am the app admin</button>' +
      '<button class="link-btn" type="button" data-act="' + act('signout', function () { Store.signOut().then(function () { location.reload(); }); }) + '">Sign out</button></div></div>';
  }

  function viewOnboard() {
    nav.hidden = true;
    app.innerHTML =
      '<div class="stack">' + header('Set up your profile') +
      '<form class="card" id="onboard">' +
      '<label class="field">Name (as you want it on the leaderboard)<input class="input" id="ob-name" maxlength="40" required value="' + esc(S.user.name || '') + '"></label>' +
      '<label class="field">Military rank<select class="input" id="ob-rank">' + C.militaryRanks.map(function (r) {
        return '<option' + (r === (S.user.rank || 'SPC') ? ' selected' : '') + '>' + r + '</option>';
      }).join('') + '</select></label>' +
      '<label class="field">Unit and section<input class="input" id="ob-unit" maxlength="60" placeholder="e.g. HHBn, S2 section" value="' + esc(S.user.unit || '') + '"></label>' +
      '<button class="btn" type="submit">Save and start</button>' +
      '<p class="muted small">Name, rank and unit only. Never enter your DoD ID, SSN or medical information in this app.</p></form></div>';
    document.getElementById('onboard').addEventListener('submit', function (e) {
      e.preventDefault();
      Store.saveProfile({
        name: document.getElementById('ob-name').value.trim(),
        rank: document.getElementById('ob-rank').value,
        unit: document.getElementById('ob-unit').value.trim()
      }).then(function (p) { S.user = p; location.hash = '#/'; route(); });
    });
  }

  // ---------- home ----------

  function weekProgress() {
    var week = P.weekDates();
    return week.filter(function (d) { return S.daily[d] && S.daily[d].done; }).length;
  }

  function viewHome() {
    var r = P.rankFor(points());
    var next = P.nextCompetition();
    var stats = P.topicStats(Q, S.attempts, S.learned);
    var todayDone = S.daily[P.today()] && S.daily[P.today()].done;
    var weekDays = weekProgress();
    var learnedCount = Object.keys(S.learned).length;

    function topicStat(id) {
      var s = stats[id];
      if (!s) return { text: 'No questions yet', pct: 0 };
      return { text: s.accuracy == null ? s.total + ' questions' : s.accuracy + '% right', pct: s.total ? Math.round((s.seen / s.total) * 100) : 0 };
    }
    function group(ids) {
      var tot = { total: 0, seen: 0, answered: 0, right: 0 };
      ids.forEach(function (id) { var s = stats[id]; if (s) { tot.total += s.total; tot.seen += s.seen; tot.answered += s.answered; tot.right += s.right; } });
      return { text: tot.answered ? Math.round((tot.right / tot.answered) * 100) + '% right' : tot.total + ' questions', pct: tot.total ? Math.round((tot.seen / tot.total) * 100) : 0 };
    }
    function boardStat() {
      var boards = S.ledger.filter(function (e) { return e.kind === 'board-done'; });
      if (!boards.length) return { text: 'Sit your first board', pct: 0 };
      var best = Math.max.apply(null, boards.map(function (e) { return e.score || 0; }));
      return { text: 'Best ' + best + '% · ' + boards.length + ' sat', pct: best };
    }
    var weapons = group(['rifle', 'pistol', 'machine-guns', 'qualification', 'range-safety']);
    var land = topicStat('land-nav');
    var wtbd = group(['warrior-tasks', 'first-aid', 'call-for-fire', 'cbrn']);

    var tiles = [
      { href: '#/board', name: 'Mock Board', icon: 'mic', stat: boardStat() },
      { href: '#/fitness', name: 'Fitness', icon: 'fitness', stat: BWC.Fitness.homeStat(S.workouts) },
      { href: '#/landnav', name: 'Land Nav', icon: 'compass', stat: land },
      { href: '#/drills#weapons', name: 'Weapons', icon: 'target', stat: weapons },
      { href: '#/drills#wtbd', name: 'WTBDs', icon: 'medic', stat: wtbd },
      { href: '#/study', name: 'Study', icon: 'book', stat: { text: learnedCount + ' learned', pct: Q.length ? Math.round((learnedCount / Q.length) * 100) : 0 } }
    ];

    var countdown = '';
    if (next) {
      countdown = '<div class="banner"><div class="grow"><div class="eyebrow">' + esc(next.comp.name) + '</div>' +
        '<div class="big">' + (next.days == null ? 'Date TBD' : next.days + (next.days === 1 ? ' DAY' : ' DAYS')) + '</div>' +
        (next.dated ? '<div class="small" style="font-weight:700">' + esc(next.dated.comp.name) + ': ' + next.dated.days + ' days</div>' : '') +
        (next.comp.place ? '<div class="small" style="font-weight:700">' + esc(next.comp.place) + '</div>' : '') +
        '</div>' + icon('star', 60, 1.8) + '</div>';
    }

    app.innerHTML =
      '<div class="row"><div class="avatar">' + esc(initials(S.user.name)) + '</div>' +
      '<div class="grow"><div class="display" style="font-size:20px">' + esc(displayName(S.user)) + '</div>' +
      '<div class="muted small">' + esc(S.user.unit || 'Set your unit under Me') + '</div></div>' +
      '<span class="pill">' + icon('star', 16, 2.4) + points().toLocaleString() + '</span></div>' +
      countdown +
      '<div class="card"><div class="row"><div class="rank-badge">' + esc(r.rank.id) + '</div>' +
      '<div class="grow"><div class="muted small">App rank</div><div class="display" style="font-size:22px">' + esc(r.rank.name) + '</div></div>' +
      '<div class="muted small" style="text-align:right">' + (r.next ? r.toNext.toLocaleString() + ' pts<br>to ' + esc(r.next.id) : 'Top rank') + '</div></div>' +
      '<div class="bar" role="progressbar" aria-valuenow="' + r.pct + '" aria-valuemin="0" aria-valuemax="100" aria-label="Progress to next rank"><span style="width:' + r.pct + '%"></span></div></div>' +
      '<div class="card"><div class="row"><h2 class="grow">Daily 10</h2><span class="row small" style="gap:4px;font-weight:700">' + icon('flame', 16) +
      weekDays + ' of ' + C.points.weeklyGoalDays + ' days this week</span></div>' +
      '<p class="muted">' + (todayDone ? 'Done for today. Come back tomorrow, or run a topic quiz.' : 'Ten questions picked for you: missed ones first, then your weakest topics.') + '</p>' +
      '<a class="btn" href="#/quiz/daily">' + (todayDone ? 'Run it again (no points)' : 'Start Daily 10') + '</a></div>' +
      '<div class="tiles">' + tiles.map(function (t) {
        return '<a class="tile" href="' + t.href + '">' + icon(t.icon, 28, 2.2) + '<span class="name">' + esc(t.name) + '</span>' +
          (t.soon ? '<span class="soon">' + esc(t.soon) + '</span>' :
            '<span class="stat">' + esc(t.stat.text) + '</span><span class="tbar"><span style="width:' + t.stat.pct + '%"></span></span>') + '</a>';
      }).join('') + '</div>' +
      '<div class="card" id="lb-card"><div class="row"><h2 class="grow">Leaderboard</h2><a class="link-btn" href="#/leaderboard">See all</a></div><p class="muted small">Loading…</p></div>';

    Store.leaderboard().then(function (rows) {
      var el = document.getElementById('lb-card');
      if (!el) return;
      el.innerHTML = '<div class="row"><h2 class="grow">Leaderboard</h2><a class="link-btn" href="#/leaderboard">See all</a></div>' + lbRows(rows.slice(0, 3)) +
        (!Store.cloud ? '<p class="muted small">Demo mode: the leaderboard shows everyone once the app is connected to Firebase.</p>' : '');
    });
  }

  function lbRows(rows) {
    return rows.map(function (r, i) {
      var me = S.user && r.uid === S.user.uid;
      return '<div class="lb-row' + (me ? ' me' : '') + '"><span class="lb-pos">' + (i + 1) + '</span><span class="grow" style="font-weight:700">' +
        esc(displayName(r)) + (me ? ' (you)' : '') + '</span><span class="muted small" style="' + (me ? 'color:inherit' : '') + '">' + esc(P.rankFor(r.points || 0).rank.id) +
        '</span><span style="font-weight:700">' + (r.points || 0).toLocaleString() + '</span></div>';
    }).join('');
  }

  // ---------- study library ----------

  function viewStudy() {
    var stats = P.topicStats(Q, S.attempts, S.learned);
    app.innerHTML = header('Study') +
      '<p class="muted">Pick a topic to read the source, flip flashcards or take an untimed quiz. Every answer shows where to find it.</p>' +
      '<div class="row wrap"><a class="btn grow" href="#/creeds">' + icon('flag', 18) + 'Creeds and Army Values</a>' +
      '<a class="btn grow" href="#/audio">' + icon('mic', 18) + 'Audio flashcards</a>' +
      '<a class="btn ghost grow" href="#/quiz/mixed">' + icon('star', 18) + 'Mixed quiz: 20 from every topic</a></div>' +
      C.groups.map(function (g) {
        var topics = C.topics.filter(function (t) { return t.group === g.id; });
        return '<section class="stack" id="' + esc(g.id) + '"><h2>' + esc(g.name) + '</h2><div class="tiles">' + topics.map(function (t) {
          var s = stats[t.id];
          var pct = s && s.total ? Math.round((s.seen / s.total) * 100) : 0;
          return '<a class="tile" href="#/topic/' + t.id + '">' + icon(t.icon, 26, 2.2) + '<span class="name">' + esc(t.name) + '</span>' +
            '<span class="stat">' + (s ? s.total + ' questions' + (s.accuracy != null ? ' · ' + s.accuracy + '%' : '') : 'Questions coming') + '</span>' +
            '<span class="tbar"><span style="width:' + pct + '%"></span></span></a>';
        }).join('') + '</div></section>';
      }).join('');
    if (location.hash.indexOf('#skills') > 0) {
      var el = document.getElementById('skills');
      if (el) el.scrollIntoView();
    }
  }

  function viewTopic(id) {
    var t = topicById(id);
    if (!t) return viewNotFound();
    var qs = questionsFor(id);
    var stats = P.topicStats(Q, S.attempts, S.learned)[id];
    var pubs = {};
    qs.forEach(function (q) { pubs[q.pub] = true; });
    app.innerHTML = header(t.name, '#/study') +
      '<div class="card"><div class="row wrap">' +
      '<span class="chip">' + qs.length + ' questions</span>' +
      (stats ? '<span class="chip">' + stats.learned + ' learned</span>' + (stats.accuracy != null ? '<span class="chip">' + stats.accuracy + '% right</span>' : '') : '') +
      '</div>' +
      (qs.length ? '<div class="row wrap"><a class="btn" href="#/quiz/' + id + '/10">Quiz: 10 questions</a>' +
        '<a class="btn ghost" href="#/quiz/' + id + '/all">All ' + qs.length + '</a>' +
        '<a class="btn ghost" href="#/flash/' + id + '">Flashcards</a></div>' : '<p class="muted">Questions for this topic are being written.</p>') +
      '</div>' +
      '<div class="card"><h2>Source documents</h2>' + (Object.keys(pubs).length ? Object.keys(pubs).sort().map(function (pub) {
        var s = SRC[pub] || {};
        return '<div class="stack" style="gap:6px"><div><strong>' + esc(pub) + '</strong> <span class="muted">' + esc(s.title || '') + '</span></div>' +
          '<div class="row wrap">' + sourceLink(pub, null, 'Open ' + pub) + '</div></div>';
      }).join('') : '<p class="muted">Sources appear here as questions are added.</p>') +
      '<p class="muted small">Opening a source earns ' + C.points.readSource + ' point (up to ' + C.points.readDailyCap + ' a day).</p></div>';
  }

  // ---------- flashcards ----------

  function viewFlash(id) {
    var t = topicById(id);
    var qs = questionsFor(id);
    if (!t || !qs.length) return viewNotFound();
    if (!S.flash || S.flash.topic !== id) S.flash = { topic: id, list: P.shuffle(qs), idx: 0, back: false };
    var f = S.flash;
    var q = f.list[f.idx];
    var learned = !!S.learned[q.id];
    app.innerHTML = header(t.name + ' flashcards', '#/topic/' + id) +
      '<p class="muted small">Card ' + (f.idx + 1) + ' of ' + f.list.length + '. Tap the card to flip it.</p>' +
      '<button type="button" class="flash' + (f.back ? ' back' : '') + '" data-act="' + act('flip', function () { f.back = !f.back; viewFlash(id); }) + '">' +
      (f.back ? '<div class="display" style="font-size:24px">' + esc(q.answer) + '</div><p>' + esc(q.why || '') + '</p><p class="small">' + esc(q.pub) + (q.para ? ', para ' + esc(q.para) : '') + '</p>'
        : '<div class="qtext">' + esc(q.q) + '</div>') + '</button>' +
      '<div class="row wrap">' +
      '<button type="button" class="btn ghost" data-act="' + act('fprev', function () { if (f.idx > 0) { f.idx--; f.back = false; viewFlash(id); } }) + '"' + (f.idx === 0 ? ' disabled' : '') + '>Previous</button>' +
      '<button type="button" class="btn grow" data-act="' + act('fnext', function () {
        if (f.idx < f.list.length - 1) { f.idx++; f.back = false; viewFlash(id); return; }
        award(P.readPoints(S.ledger, 'flash:' + id)).then(function () { toast('Set finished'); S.flash = null; location.hash = '#/topic/' + id; });
      }) + '">' + (f.idx < f.list.length - 1 ? 'Next' : 'Finish set') + '</button></div>' +
      '<div class="row wrap"><button type="button" class="btn small ghost" data-act="' + act('flearn', function () {
        Store.setLearned(q.id, !learned).then(function () { if (learned) delete S.learned[q.id]; else S.learned[q.id] = true; viewFlash(id); });
      }) + '">' + icon('check', 18) + (learned ? 'Learned' : 'Mark as learned') + '</button>' + sourceLink(q.pub, q.page, 'Open source') + '</div>';
  }

  // ---------- quizzes ----------

  function startQuiz(mode, n) {
    var list;
    if (mode === 'daily') list = P.pickDaily(Q, S.attempts, S.learned, 10);
    else if (mode === 'mixed') list = P.shuffle(Q).slice(0, 20);
    else {
      var qs = P.shuffle(questionsFor(mode));
      list = n === 'all' ? qs : qs.slice(0, parseInt(n, 10) || 10);
    }
    S.quiz = {
      mode: mode, list: list, idx: 0, answers: [], done: false,
      choices: list.map(function (q) { return P.shuffle([q.answer].concat(q.wrong || [])); })
    };
  }

  function viewQuiz(mode, n) {
    if (!Q.length) {
      app.innerHTML = header('Quiz', '#/') + '<div class="card"><p>The question bank is still being built. Check back soon.</p></div>';
      return;
    }
    if (!S.quiz || S.quiz.mode !== mode || S.quiz.done) startQuiz(mode, n);
    var z = S.quiz;
    var q = z.list[z.idx];
    var title = mode === 'daily' ? 'Daily 10' : mode === 'mixed' ? 'Mixed quiz' : (topicById(mode) || {}).name + ' quiz';
    var picked = z.answers[z.idx];
    app.innerHTML = header(title, mode === 'daily' || mode === 'mixed' ? '#/' : '#/topic/' + mode) +
      '<div class="progress-dots" aria-hidden="true">' + z.list.map(function (_, i) { return '<span class="' + (i < z.idx ? 'done' : '') + '"></span>'; }).join('') + '</div>' +
      '<p class="muted small">Question ' + (z.idx + 1) + ' of ' + z.list.length + ' · ' + esc((topicById(q.topic) || {}).name || '') + ' · no timer</p>' +
      '<div class="qtext">' + esc(q.q) + '</div>' +
      '<div class="stack">' + z.choices[z.idx].map(function (c, i) {
        return '<button type="button" class="choice' + (picked === c ? ' picked' : '') + '" data-act="pick" data-arg="' + i + '">' + esc(c) + '</button>';
      }).join('') + '</div>' +
      '<div class="row"><button type="button" class="btn ghost" data-act="' + act('qprev', function () { if (z.idx > 0) { z.idx--; viewQuiz(mode, n); } }) + '"' + (z.idx === 0 ? ' disabled' : '') + '>Back</button>' +
      '<button type="button" class="btn grow" data-act="' + act('qnext', function () {
        if (z.answers[z.idx] == null) { toast('Pick an answer first'); return; }
        if (z.idx < z.list.length - 1) { z.idx++; viewQuiz(mode, n); } else finishQuiz();
      }) + '">' + (z.idx < z.list.length - 1 ? 'Next' : 'Finish and review') + '</button></div>';
    actions.pick = function (el) {
      z.answers[z.idx] = z.choices[z.idx][parseInt(el.getAttribute('data-arg'), 10)];
      viewQuiz(mode, n);
    };
  }

  function finishQuiz() {
    var z = S.quiz;
    z.done = true;
    var results = z.list.map(function (q, i) { return { qid: q.id, topic: q.topic, correct: z.answers[i] === q.answer, mode: z.mode }; });
    var entries;
    if (z.mode === 'daily') {
      var day = P.today();
      var already = S.daily[day] && S.daily[day].done;
      var right = results.filter(function (r) { return r.correct; }).length;
      entries = already ? [] : results.filter(function (r) { return r.correct; }).map(function (r) {
        return { kind: 'daily', pts: C.points.dailyCorrect, ref: r.qid };
      }).concat([{ kind: 'daily-finish', pts: C.points.dailyFinish, ref: day }]);
      if (!already) {
        S.daily[day] = { done: true, correct: right, of: results.length };
        Store.saveDaily(day, S.daily[day]);
      }
    } else {
      entries = P.quizPoints(results, S.attempts);
    }
    z.earned = entries.reduce(function (s, e) { return s + e.pts; }, 0);
    Store.addAttempts(results);
    results.forEach(function (r) { S.attempts.push(Object.assign({ at: Date.now() }, r)); });
    award(entries).then(function () { location.hash = '#/review'; });
  }

  function viewReview() {
    var z = S.quiz;
    if (!z || !z.done) { location.hash = '#/'; return; }
    var right = z.list.filter(function (q, i) { return z.answers[i] === q.answer; }).length;
    app.innerHTML = header('Quiz review') +
      '<div class="banner"><div class="grow"><div class="eyebrow">Score</div><div class="big">' + right + ' / ' + z.list.length + '</div>' +
      '<div class="small" style="font-weight:700">+' + z.earned + ' points' + (z.earned === 0 && right > 0 ? ' (points count the first time you get a question right)' : '') + '</div></div>' + icon('trophy', 60, 1.8) + '</div>' +
      z.list.map(function (q, i) {
        var ok = z.answers[i] === q.answer;
        var learned = !!S.learned[q.id];
        return '<div class="card review ' + (ok ? 'right' : 'wrong') + '">' +
          '<div class="row"><span class="chip ' + (ok ? 'good' : 'bad') + '">' + (ok ? 'Right' : 'Missed') + '</span><span class="muted small grow">' + esc((topicById(q.topic) || {}).name || '') + '</span></div>' +
          '<div style="font-weight:700">' + esc(q.q) + '</div>' +
          (ok ? '' : '<div class="small">Your answer: ' + esc(z.answers[i]) + '</div>') +
          '<div><strong>Answer:</strong> ' + esc(q.answer) + '</div>' +
          (q.why ? '<div class="muted">' + esc(q.why) + '</div>' : '') +
          (q.quote ? '<div class="quote">"' + esc(q.quote) + '"</div>' : '') +
          '<div class="cite"><strong>' + esc(q.pub) + '</strong>' + (q.para ? ', para ' + esc(q.para) : '') + (q.page ? ', PDF page ' + q.page : '') + '</div>' +
          '<div class="row wrap">' + sourceLink(q.pub, q.page, 'Open at this page') +
          '<button type="button" class="btn small ghost" data-act="learn" data-arg="' + esc(q.id) + '">' + icon('check', 18) + (learned ? 'Learned' : 'Mark as learned') + '</button>' +
          '<button type="button" class="btn small ghost" data-act="discuss" data-arg="' + esc(q.id) + '">' + icon('chat', 18) + 'Discuss</button>' +
          '<button type="button" class="btn small ghost" data-act="report" data-arg="' + esc(q.id) + '">' + icon('alert', 18) + 'Report an error</button></div></div>';
      }).join('') +
      '<div class="row wrap"><a class="btn grow" href="#/">Home</a>' + (z.mode !== 'daily' && z.mode !== 'mixed' ? '<a class="btn ghost grow" href="#/topic/' + z.mode + '">Back to topic</a>' : '') + '</div>';
  }

  function toggleLearned(qid) {
    var on = !S.learned[qid];
    Store.setLearned(qid, on).then(function () {
      if (on) S.learned[qid] = true; else delete S.learned[qid];
      toast(on ? 'Marked as learned' : 'Back in rotation');
      // Update the button in place so a long review doesn't jump back to the top.
      document.querySelectorAll('[data-act="learn"][data-arg="' + qid + '"]').forEach(function (b) {
        b.innerHTML = icon('check', 18) + (on ? 'Learned' : 'Mark as learned');
      });
    });
  }

  function openReport(qid) {
    var q = Q.filter(function (x) { return x.id === qid; })[0];
    if (!q) return;
    var wrap = document.createElement('div');
    wrap.className = 'sheet-wrap';
    wrap.innerHTML = '<form class="sheet" role="dialog" aria-label="Report a question error">' +
      '<h2>Report an error</h2><p class="muted small">' + esc(q.q) + '</p>' +
      '<label class="field">What is wrong?<select class="input" id="rp-reason">' +
      ['The answer is wrong', 'The citation or page is wrong', 'The question is unclear', 'A newer version of the publication changed this', 'Something else']
        .map(function (r) { return '<option>' + r + '</option>'; }).join('') + '</select></label>' +
      '<label class="field">Details (optional)<textarea class="input" id="rp-comment" maxlength="1000" placeholder="What should it say, and where did you find it?"></textarea></label>' +
      '<div class="row"><button type="button" class="btn ghost" id="rp-cancel">Cancel</button><button type="submit" class="btn grow">Send report</button></div>' +
      '<p class="muted small">Reports go to the app admin and the leaders who review questions.</p></form>';
    document.body.appendChild(wrap);
    var close = function () { wrap.remove(); };
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    wrap.querySelector('#rp-cancel').addEventListener('click', close);
    wrap.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      Store.addReport({
        qid: q.id, question: q.q, pub: q.pub,
        reason: wrap.querySelector('#rp-reason').value,
        comment: wrap.querySelector('#rp-comment').value.trim()
      }).then(function () { close(); toast('Report sent. Thank you.'); })
        .catch(function () { toast('Could not send the report. Try again.'); });
    });
    wrap.querySelector('#rp-reason').focus();
  }

  // ---------- leaderboard ----------

  function viewLeaderboard() {
    app.innerHTML = header('Leaderboard') + '<div class="card" id="lb"><p class="muted">Loading…</p></div>';
    Store.leaderboard().then(function (rows) {
      var el = document.getElementById('lb');
      if (!el) return;
      el.innerHTML = rows.length ? lbRows(rows) : '<p class="muted">No one on the board yet.</p>';
      if (!Store.cloud) el.innerHTML += '<p class="muted small">Demo mode: connect Firebase to see the whole unit.</p>';
    });
  }

  // ---------- profile and settings ----------

  function viewMe() {
    var r = P.rankFor(points());
    app.innerHTML = header('Me') +
      '<div class="card"><div class="row"><div class="avatar">' + esc(initials(S.user.name)) + '</div><div class="grow"><div class="display" style="font-size:20px">' +
      esc(displayName(S.user)) + '</div><div class="muted small">' + esc(S.user.unit || '') + ' · ' + esc(S.user.role || 'soldier') + '</div></div>' +
      '<div class="rank-badge">' + esc(r.rank.id) + '</div></div></div>' +
      (isLeader() || S.user.role === 'sponsor' ? '<a class="btn" href="#/team">' + icon('user', 18) + (S.user.role === 'sponsor' ? 'My competitor' : 'Competitors') + '</a>' : '') +
      (isLeader() ? '<a class="btn ghost" href="#/admin">' + icon('settings', 18) + (isAdmin() ? 'Admin' : 'Leader tools') + '</a>' : '') +
      '<form class="card" id="me-form"><h2>Profile</h2>' +
      '<label class="field">Name<input class="input" id="me-name" maxlength="40" value="' + esc(S.user.name || '') + '"></label>' +
      '<label class="field">Military rank<select class="input" id="me-rank">' + C.militaryRanks.map(function (x) {
        return '<option' + (x === S.user.rank ? ' selected' : '') + '>' + x + '</option>';
      }).join('') + '</select></label>' +
      '<label class="field">Unit and section<input class="input" id="me-unit" maxlength="60" value="' + esc(S.user.unit || '') + '"></label>' +
      '<button class="btn" type="submit">Save</button></form>' +
      '<div class="card"><h2>Theme</h2><div class="theme-swatches">' + C.themes.map(function (t) {
        return '<button type="button" class="swatch' + ((S.user.theme || 'black-gold') === t.id ? ' on' : '') + '" data-sw="' + t.id + '" data-act="theme" data-arg="' + t.id + '">' + esc(t.name) + '</button>';
      }).join('') + '</div></div>' +
      '<div class="card"><h2>Rank ladder</h2><div class="list">' + C.ranks.map(function (x) {
        var on = x.id === r.rank.id;
        return '<div class="list-row"><span class="chip' + (on ? ' good' : '') + '">' + esc(x.id) + '</span><span class="grow">' + esc(x.name) + '</span><span class="mono small">' + x.need.toLocaleString() + '</span></div>';
      }).join('') + '</div></div>' +
      (Store.cloud ? '<button type="button" class="btn ghost" data-act="' + act('so', function () { Store.signOut().then(function () { location.reload(); }); }) + '">Sign out</button>'
        : '<p class="muted small">Demo mode: progress is saved on this device only.</p>');
    document.getElementById('me-form').addEventListener('submit', function (e) {
      e.preventDefault();
      Store.saveProfile({
        name: document.getElementById('me-name').value.trim(),
        rank: document.getElementById('me-rank').value,
        unit: document.getElementById('me-unit').value.trim()
      }).then(function (p) { S.user = p; toast('Saved'); viewMe(); });
    });
  }

  // ---------- admin and leader tools ----------

  function viewAdmin() {
    if (!isLeader()) return viewNotFound();
    app.innerHTML = header(isAdmin() ? 'Admin' : 'Leader tools', '#/me') +
      (isAdmin() ? '<div class="card"><h2>AI grading</h2><p class="muted small">Sends one sample board answer, worded differently from the reference, to the AI check.</p>' +
        '<button type="button" class="btn ghost" data-act="' + act('aitest', function (el) {
          var out = document.getElementById('ai-test-out');
          if (!BWC.AI.available()) { out.textContent = 'AI grading is off here (demo mode or not configured).'; return; }
          el.disabled = true;
          out.textContent = 'Asking the AI…';
          var q = Q.filter(function (x) { return x.id === 'a-009'; })[0] || Q[0];
          var t0 = Date.now();
          BWC.AI.grade(q, 'Sergeant Major, leadership is influencing people through purpose, direction and motivation so the mission gets done and the organization gets better.')
            .then(function (r) { out.textContent = 'Working. Verdict: ' + r.verdict + ' (' + ((Date.now() - t0) / 1000).toFixed(1) + 's). "' + r.reason + '"'; })
            .catch(function (e) { out.textContent = 'Not working yet: ' + (e && e.message ? e.message : e); })
            .then(function () { el.disabled = false; });
        }) + '">Test AI grading</button><p class="small" id="ai-test-out"></p></div>' : '') +
      (Store.cloud ? '<div class="card"><h2>People</h2><div id="people" class="scroll-x"><p class="muted">Loading…</p></div></div>' : '') +
      '<div class="card"><h2>Question error reports</h2><div id="reports"><p class="muted">Loading…</p></div></div>' +
      '<div class="card"><h2>Question bank</h2><div class="list">' + C.topics.map(function (t) {
        return '<div class="list-row"><span class="grow">' + esc(t.name) + '</span><span class="mono small">' + questionsFor(t.id).length + '</span></div>';
      }).join('') + '</div><p class="muted small">' + Q.length + ' questions total.</p></div>';

    Store.reports().then(function (rows) {
      var el = document.getElementById('reports');
      if (!el) return;
      var open = rows.filter(function (r) { return r.status === 'open'; });
      el.innerHTML = rows.length ? rows.map(function (r) {
        return '<div class="list-row" style="flex-wrap:wrap"><div class="grow"><div><span class="chip' + (r.status === 'open' ? ' bad' : '') + '">' + esc(r.status) + '</span> <strong>' + esc(r.reason) + '</strong></div>' +
          '<div class="small">' + (r.threadId ? '<a href="#/thread/' + encodeURIComponent(r.threadId) + '">' + esc(r.question) + '</a>' : esc(r.question || r.qid)) + '</div><div class="muted small">' + esc(r.pub || '') + ' · ' + esc(r.by || '') + ' · ' + new Date(r.at).toLocaleDateString() + '</div>' +
          (r.comment ? '<div class="quote">' + esc(r.comment) + '</div>' : '') + '</div>' +
          (r.status === 'open' ? '<div class="row"><button type="button" class="btn small" data-act="rfix" data-arg="' + esc(r.id) + '">Fixed</button>' +
            '<button type="button" class="btn small ghost" data-act="rdismiss" data-arg="' + esc(r.id) + '">Dismiss</button></div>' : '') + '</div>';
      }).join('') : '<p class="muted">No reports.</p>';
      if (open.length) el.insertAdjacentHTML('afterbegin', '<p class="small"><strong>' + open.length + ' open</strong></p>');
    });
    actions.rfix = function (el) { Store.resolveReport(el.getAttribute('data-arg'), 'fixed').then(viewAdmin); };
    actions.rdismiss = function (el) { Store.resolveReport(el.getAttribute('data-arg'), 'dismissed').then(viewAdmin); };

    if (!Store.cloud) return;
    Store.users().then(function (people) {
      var el = document.getElementById('people');
      if (!el) return;
      people.sort(function (a, b) { return (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) || (b.points || 0) - (a.points || 0); });
      var sponsors = people.filter(function (p) { return p.role === 'sponsor' || p.role === 'leader' || p.role === 'admin'; });
      el.innerHTML = '<table class="admin"><thead><tr><th>Person</th><th>Status</th><th>Role</th><th>Sponsor</th><th>Points</th></tr></thead><tbody>' +
        people.map(function (p) {
          var roleSel = isAdmin() ? '<select class="input" data-change="role" data-uid="' + esc(p.uid) + '">' + ['soldier', 'sponsor', 'leader', 'admin'].map(function (r) {
            return '<option' + (r === p.role ? ' selected' : '') + '>' + r + '</option>';
          }).join('') + '</select>' : esc(p.role);
          var spSel = isAdmin() ? '<select class="input" data-change="sponsor" data-uid="' + esc(p.uid) + '"><option value="">None</option>' + sponsors.map(function (s) {
            return '<option value="' + esc(s.uid) + '"' + (s.uid === p.sponsorUid ? ' selected' : '') + '>' + esc(displayName(s)) + '</option>';
          }).join('') + '</select>' : esc((sponsors.filter(function (s) { return s.uid === p.sponsorUid; })[0] || {}).name || '');
          return '<tr><td><strong>' + esc(displayName(p)) + '</strong><div class="muted small">' + esc(p.email || '') + '</div><div class="muted small">' + esc(p.unit || '') + '</div></td>' +
            '<td>' + (p.status === 'pending' && isAdmin() ? '<button type="button" class="btn small" data-act="approve" data-arg="' + esc(p.uid) + '">Approve</button>'
              : '<span class="chip' + (p.status === 'approved' ? ' good' : '') + '">' + esc(p.status) + '</span>') + '</td>' +
            '<td>' + roleSel + '</td><td>' + spSel + '</td><td class="mono">' + (p.points || 0) + '</td></tr>';
        }).join('') + '</tbody></table>';
      el.querySelectorAll('select[data-change]').forEach(function (sel) {
        sel.addEventListener('change', function () {
          var field = sel.getAttribute('data-change') === 'role' ? { role: sel.value } : { sponsorUid: sel.value || null };
          Store.updateUser(sel.getAttribute('data-uid'), field).then(function () { toast('Saved'); }).catch(function () { toast('Not saved: admins only'); });
        });
      });
    });
    actions.approve = function (el) {
      Store.updateUser(el.getAttribute('data-arg'), { status: 'approved' }).then(function () { toast('Approved'); viewAdmin(); });
    };
  }

  // ---------- other ----------

  function viewComing(feature) {
    var names = { board: 'Mock Board', fitness: 'Fitness log' };
    var text = {
      board: 'Sit in front of a CSM-led panel: questions read aloud, a timer running, and answers graded for "Sergeant Major, … is …" format and content.',
      fitness: 'Log workouts with or without a wearable, earn points, and unlock vehicles with ruck miles.'
    };
    app.innerHTML = header(names[feature] || 'Coming soon', '#/') + '<div class="card"><p>' + esc(text[feature] || 'This part of the app is on the way.') + '</p>' +
      '<p class="muted">Scheduled for Phase 2. Until then, build your knowledge with the Daily 10 and topic quizzes.</p><a class="btn" href="#/quiz/daily">Start Daily 10</a></div>';
  }

  function viewNotFound() {
    app.innerHTML = header('Not found', '#/') + '<div class="card"><p>That page does not exist.</p><a class="btn" href="#/">Home</a></div>';
  }

  // Helpers shared with screens that live in their own files (board.js).
  BWC.UI = {
    S: S, esc: esc, icon: icon, act: act, header: header, toast: toast, award: award,
    sourceLink: sourceLink, topicById: topicById, displayName: displayName
  };

  // ---------- router ----------

  function route() {
    if (BWC.Board) BWC.Board.stop();
    if (BWC.Audio) BWC.Audio.stop();
    if (BWC.LandNav) BWC.LandNav.stop();
    actions = {};
    applyTheme();
    if (Store.cloud && !S.user) return viewSignIn();
    if (S.user.status !== 'approved') return viewPending();
    if (!S.user.name || !S.user.rank) return viewOnboard();

    var hash = location.hash.replace(/^#\/?/, '').split('#')[0];
    var parts = hash.split('/');
    var name = parts[0] || 'home';
    renderNav(name);
    window.scrollTo(0, 0);
    switch (name) {
      case 'home': return viewHome();
      case 'study': return viewStudy();
      case 'topic': return viewTopic(parts[1]);
      case 'flash': return viewFlash(parts[1]);
      case 'quiz': return viewQuiz(parts[1] || 'daily', parts[2] || '10');
      case 'review': return viewReview();
      case 'leaderboard': return viewLeaderboard();
      case 'me': return viewMe();
      case 'admin': return viewAdmin();
      case 'board': return BWC.Board.view(parts[1]);
      case 'fitness': return BWC.Fitness.view(parts[1]);
      case 'team': return BWC.Team.view(parts[1]);
      case 'audio': return BWC.Audio.view(parts[1]);
      case 'landnav': return BWC.LandNav.view(parts[1]);
      case 'drills': return BWC.Drills.view(parts[1], parts[2]);
      case 'creeds': return BWC.Creeds.view();
      case 'creed': return BWC.Creeds.view(parts[1], parts[2]);
      case 'squad': return parts[1] === 'new' ? BWC.Discussion.newPost(parts[2]) : BWC.Discussion.list(parts[1]);
      case 'thread': return BWC.Discussion.thread(decodeURIComponent(parts[1] || ''));
      case 'coming': return viewComing(parts[1]);
      default: return viewNotFound();
    }
  }

  // One listener for every data-act button, in the page and in sheets.
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var name = el.getAttribute('data-act');
    if (name === 'read') {
      // A source link: let it open, and award reading points.
      award(P.readPoints(S.ledger, 'src:' + el.getAttribute('data-arg')));
      return;
    }
    if (name === 'learn') { toggleLearned(el.getAttribute('data-arg')); return; }
    if (name === 'report') { openReport(el.getAttribute('data-arg')); return; }
    if (name === 'discuss') { BWC.Discussion.discuss(el.getAttribute('data-arg')); return; }
    if (name === 'theme') {
      Store.saveProfile({ theme: el.getAttribute('data-arg') }).then(function (p) { S.user = p; applyTheme(); viewMe(); });
      return;
    }
    if (actions[name]) actions[name](el, e);
  });

  window.addEventListener('hashchange', route);

  function loadData() {
    return Promise.all([Store.attempts(), Store.ledger(), Store.learned(), Store.daily(), Store.workouts()]).then(function (r) {
      S.attempts = r[0]; S.ledger = r[1]; S.learned = r[2]; S.daily = r[3]; S.workouts = r[4];
    }).catch(function (e) { console.warn('Load failed', e); });
  }

  Store.onAuth(function (u) {
    S.user = u;
    if (u && u.status === 'approved') loadData().then(route); else route();
  });

  Store.ready.then(function () {
    S.user = Store.user();
    if (!Store.cloud || (S.user && S.user.status === 'approved')) return loadData().then(route);
    route();
  });
})();
