// Sponsor and leader dashboard: each competitor's readiness, weak topics, boards and
// workouts, with Verify / Flag on workout screenshots.
// Routes: #/team (roster), #/team/<uid> (one competitor).
(function () {
  var C = window.BWC_CONFIG;
  var P = BWC.Progress;

  function U() { return BWC.UI; }
  function app() { return document.getElementById('app'); }

  var WEAPONS = ['rifle', 'pistol', 'machine-guns', 'qualification', 'range-safety'];
  var WTBD = ['warrior-tasks', 'first-aid', 'call-for-fire', 'cbrn'];
  var FITNESS_GOAL = 150; // minutes a week shown as "full"

  function loadMember(uid) {
    var S = BWC.Store;
    return Promise.all([S.attempts(uid), S.ledger(uid), S.workouts(uid), S.memberMeta(uid)]).then(function (r) {
      return { attempts: r[0], ledger: r[1], workouts: r[2], learned: r[3].learned, daily: r[3].daily };
    });
  }

  function accuracy(stats, ids) {
    var a = 0, r = 0;
    ids.forEach(function (id) { var s = stats[id]; if (s) { a += s.answered; r += s.right; } });
    return a ? Math.round((r / a) * 100) : null;
  }

  // One summary per competitor, built only from what they have logged.
  function summarize(m) {
    var Q = window.BWC_QUESTIONS || [];
    var stats = P.topicStats(Q, m.attempts, m.learned);
    var all = Object.keys(stats);
    var week = P.weekDates();
    var boards = m.ledger.filter(function (e) { return e.kind === 'board-done'; }).sort(function (a, b) { return a.at - b.at; });
    var bestBoard = boards.length ? Math.max.apply(null, boards.map(function (b) { return b.score || 0; })) : null;
    var minutes = m.workouts.filter(function (w) { return week.indexOf(w.date) >= 0; }).reduce(function (s, w) { return s + (w.minutes || 0); }, 0);
    var stamps = [].concat(m.attempts, m.ledger, m.workouts).map(function (x) { return x.at || 0; });
    var last = stamps.length ? Math.max.apply(null, stamps) : 0;
    // Weak = at least 3 answers and under 80% right, worst first.
    var weak = all.filter(function (id) { return stats[id].answered >= 3 && stats[id].accuracy != null && stats[id].accuracy < 80; })
      .sort(function (a, b) { return stats[a].accuracy - stats[b].accuracy; }).slice(0, 3);
    return {
      stats: stats,
      knowledge: accuracy(stats, all),
      weapons: accuracy(stats, WEAPONS),
      landNav: accuracy(stats, ['land-nav']),
      wtbd: accuracy(stats, WTBD),
      bestBoard: bestBoard,
      boards: boards,
      minutes: minutes,
      dailyDays: week.filter(function (d) { return m.daily[d] && m.daily[d].done; }).length,
      last: last,
      quiet: !last || Date.now() - last > 7 * 86400000,
      weak: weak,
      pendingShots: m.workouts.filter(function (w) { return w.shot && !w.review; }).length
    };
  }

  function ago(ms) {
    if (!ms) return 'never';
    var d = Math.floor((Date.now() - ms) / 86400000);
    return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago';
  }

  function meter(label, pct, note) {
    var v = pct == null ? 0 : Math.max(0, Math.min(100, pct));
    return '<div class="meter"><div class="row spread small"><strong>' + label + '</strong><span class="muted">' + (pct == null ? 'No data yet' : note || pct + '%') + '</span></div>' +
      '<div class="bar" role="progressbar" aria-label="' + label + '" aria-valuenow="' + v + '" aria-valuemin="0" aria-valuemax="100"><span class="' + (pct != null && pct < 60 ? 'warn' : '') + '" style="width:' + v + '%"></span></div></div>';
  }

  // ---------- roster ----------

  function viewRoster() {
    var u = U();
    var role = u.S.user.role;
    app().innerHTML = u.header(role === 'sponsor' ? 'My competitor' : 'Competitors', '#/me') + '<div class="card"><p class="muted">Loading…</p></div>';
    BWC.Store.competitors().then(function (people) {
      if (!people.length) {
        app().innerHTML = u.header('Competitors', '#/me') + '<div class="card"><p>No competitors are assigned to you yet.</p>' +
          '<p class="muted small">An admin assigns sponsors under Me → Admin → People.</p></div>';
        return;
      }
      return Promise.all(people.map(function (p) {
        return loadMember(p.uid).then(function (m) {
          var names = {};
          C.topics.forEach(function (t) { names[t.id] = t.name; });
          var next = P.nextCompetition();
          var alerts = BWC.Alerts.check(m, { now: Date.now(), weeklyGoal: C.points.weeklyGoalDays, topicNames: names,
            daysToCompetition: next ? (next.days != null ? next.days : next.dated ? next.dated.days : null) : null });
          return { p: p, s: summarize(m), alerts: alerts.filter(function (a) { return a.level !== 'info'; }) };
        })
          .catch(function () { return { p: p, s: null }; });
      })).then(function (rows) {
        rows.sort(function (a, b) { return (b.p.points || 0) - (a.p.points || 0); });
        var quiet = rows.filter(function (r) { return r.s && r.s.quiet; }).length;
        app().innerHTML = u.header(role === 'sponsor' ? 'My competitor' + (rows.length > 1 ? 's' : '') : 'Competitors', '#/me') +
          (quiet ? '<div class="card attention"><strong>' + quiet + ' competitor' + (quiet === 1 ? ' has' : 's have') + ' had no activity in 7 days.</strong></div>' : '') +
          rows.map(function (r) {
            var p = r.p, s = r.s;
            if (!s) return '<div class="card"><strong>' + u.esc(u.displayName(p)) + '</strong><p class="muted small">Could not load this competitor\'s data.</p></div>';
            return '<a class="card roster-card" href="#/team/' + encodeURIComponent(p.uid) + '">' +
              '<div class="row"><div class="rank-badge">' + u.esc(P.rankFor(p.points || 0).rank.id) + '</div><div class="grow">' +
              '<div class="display" style="font-size:19px">' + u.esc(u.displayName(p)) + '</div>' +
              '<div class="muted small">' + u.esc(p.unit || '') + ' · app rank ' + u.esc(P.rankFor(p.points || 0).rank.id) + ' · ' + (p.points || 0).toLocaleString() + ' pts · active ' + ago(s.last) + '</div></div>' +
              (s.quiet ? '<span class="chip bad">Quiet</span>' : '') + (s.pendingShots ? '<span class="chip">' + s.pendingShots + ' to verify</span>' : '') + '</div>' +
              (r.alerts && r.alerts.length ? '<div class="small alert-line">' + r.alerts.map(function (a) { return u.esc(a.text); }).join(' · ') + '</div>' : '') +
              '<div class="row wrap small">' +
              '<span class="chip">Knowledge ' + (s.knowledge == null ? '–' : s.knowledge + '%') + '</span>' +
              '<span class="chip">Best board ' + (s.bestBoard == null ? '–' : s.bestBoard + '%') + '</span>' +
              '<span class="chip">' + s.minutes + ' min this week</span>' +
              '<span class="chip">Daily 10: ' + s.dailyDays + '/' + C.points.weeklyGoalDays + '</span></div>' +
              (s.weak.length ? '<div class="small">Weakest: ' + s.weak.map(function (id) {
                return u.esc((u.topicById(id) || {}).name || id) + ' (' + s.stats[id].accuracy + '%)';
              }).join(', ') + '</div>' : '') + '</a>';
          }).join('');
      });
    }).catch(function () {
      app().innerHTML = u.header('Competitors', '#/me') + '<div class="card"><p>Could not load competitors. Check your connection.</p></div>';
    });
  }

  // ---------- one competitor ----------

  function viewMember(uid) {
    var u = U();
    app().innerHTML = u.header('Competitor', '#/team') + '<div class="card"><p class="muted">Loading…</p></div>';
    Promise.all([BWC.Store.competitors(), loadMember(uid)]).then(function (r) {
      var p = r[0].filter(function (x) { return x.uid === uid; })[0];
      if (!p) { app().innerHTML = u.header('Competitor', '#/team') + '<div class="card"><p>This competitor is not in your list.</p></div>'; return; }
      var m = r[1];
      var s = summarize(m);
      var rk = P.rankFor(p.points || 0);
      var topics = Object.keys(s.stats).filter(function (id) { return s.stats[id].answered; })
        .sort(function (a, b) { return s.stats[a].accuracy - s.stats[b].accuracy; });
      var workouts = m.workouts.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 20);
      var Q = window.BWC_QUESTIONS || [];
      var hist = P.history(m.attempts);
      var missed = Q.filter(function (q) { return hist[q.id] && hist[q.id].last === false; })
        .sort(function (a, b) { return hist[b.id].lastAt - hist[a.id].lastAt; }).slice(0, 8);

      app().innerHTML = u.header(u.displayName(p), '#/team') +
        '<div class="card"><div class="row"><div class="rank-badge">' + u.esc(rk.rank.id) + '</div><div class="grow">' +
        '<div class="muted small">' + u.esc(p.unit || '') + ' · app rank ' + u.esc(rk.rank.name) + '</div><div><strong>' + (p.points || 0).toLocaleString() + '</strong> points · active ' + ago(s.last) + '</div></div></div></div>' +
        '<a class="btn" href="#/drafts/' + encodeURIComponent(uid) + '">' + u.icon('clipboard', 18) + 'Award and NCOER drafts</a>' +
        '<div class="card"><h2>Readiness</h2>' +
        meter('Board', s.bestBoard, s.bestBoard == null ? null : 'Best ' + s.bestBoard + '% · ' + s.boards.length + ' sat') +
        meter('Overall knowledge', s.knowledge) +
        meter('Weapons', s.weapons) +
        meter('Land navigation', s.landNav) +
        meter('WTBDs and first aid', s.wtbd) +
        meter('Fitness this week', Math.round(s.minutes / FITNESS_GOAL * 100), s.minutes + ' of ' + FITNESS_GOAL + ' min') +
        '<p class="muted small">Knowledge bars are the share of answers right in quizzes, Daily 10 and boards. Bars under 60% are marked.</p></div>' +
        '<div class="card"><h2>Topics, weakest first</h2>' + (topics.length ? '<div class="list">' + topics.map(function (id) {
          var t = s.stats[id];
          return '<div class="list-row"><span class="grow">' + u.esc((u.topicById(id) || {}).name || id) + '</span><span class="muted small">' + t.answered + ' answered</span>' +
            '<span class="chip' + (t.accuracy < 60 ? ' bad' : t.accuracy >= 85 ? ' good' : '') + '">' + t.accuracy + '%</span></div>';
        }).join('') + '</div>' : '<p class="muted">No answers yet.</p>') + '</div>' +
        (missed.length ? '<div class="card"><h2>Recently missed</h2><p class="muted small">Good material for your next sponsor session.</p><div class="list">' + missed.map(function (q) {
          return '<div class="list-row" style="flex-wrap:wrap"><div class="grow"><div>' + u.esc(q.q) + '</div><div class="muted small">' + u.esc(q.answer) + ' · ' + u.esc(q.pub) + (q.para ? ', para ' + u.esc(q.para) : '') + '</div></div></div>';
        }).join('') + '</div></div>' : '') +
        '<div class="card"><h2>Boards</h2>' + (s.boards.length ? '<div class="list">' + s.boards.slice().reverse().slice(0, 10).map(function (b) {
          return '<div class="list-row"><span class="grow">' + new Date(b.at).toLocaleDateString() + '</span><span class="muted small">' + (b.right || 0) + '/' + (b.of || 0) +
            ' right · format ' + (b.format || 0) + '</span><span class="chip' + ((b.score || 0) >= C.board.passPct ? ' good' : '') + '">' + (b.score || 0) + '%</span></div>';
        }).join('') + '</div>' : '<p class="muted">No boards yet.</p>') + '</div>' +
        '<div class="card"><h2>Workouts</h2>' + (workouts.length ? workouts.map(function (w) {
          var t = (C.fitness.types.filter(function (x) { return x.id === w.type; })[0] || {}).name || w.type;
          return '<div class="workout-row"><div class="row wrap"><strong class="grow">' + u.esc(t) + ' · ' + w.minutes + ' min' + (w.miles ? ' · ' + w.miles + ' mi' : '') + '</strong>' +
            '<span class="muted small">' + u.esc(w.date) + '</span>' +
            (w.review ? '<span class="chip ' + (w.review === 'verified' ? 'good' : 'bad') + '">' + (w.review === 'verified' ? 'Verified' : 'Flagged') + '</span>' : '') + '</div>' +
            (w.notes ? '<div class="muted small">' + u.esc(w.notes) + '</div>' : '') +
            (w.shot ? '<img class="shot" src="' + u.esc(w.shot) + '" alt="Workout screenshot from ' + u.esc(w.date) + '">' +
              '<div class="row wrap"><button type="button" class="btn small" data-review="verified" data-w="' + u.esc(w.id) + '">' + u.icon('check', 16) + 'Verify</button>' +
              '<button type="button" class="btn small ghost" data-review="flagged" data-w="' + u.esc(w.id) + '">' + u.icon('alert', 16) + 'Flag</button></div>' : '') + '</div>';
        }).join('') : '<p class="muted">No workouts logged.</p>') +
        '<p class="muted small">Flag a screenshot that shows a map or route, or that doesn\'t match the entry. Talk to the Soldier about anything you flag.</p></div>';

      app().querySelectorAll('[data-review]').forEach(function (b) {
        b.addEventListener('click', function () {
          BWC.Store.reviewWorkout(uid, b.getAttribute('data-w'), b.getAttribute('data-review')).then(function () {
            u.toast(b.getAttribute('data-review') === 'verified' ? 'Verified' : 'Flagged');
            viewMember(uid);
          }).catch(function () { u.toast('Only this Soldier\'s sponsor or a leader can review it.'); });
        });
      });
    }).catch(function () {
      app().innerHTML = u.header('Competitor', '#/team') + '<div class="card"><p>Could not load this competitor. Check your connection.</p></div>';
    });
  }

  function view(uid) { return uid ? viewMember(decodeURIComponent(uid)) : viewRoster(); }

  BWC.Team = { view: view, summarize: summarize, loadMember: loadMember };
})();
