// Readiness alerts for sponsors and leaders, shown in the app (no paid push service needed).
// Computed from each competitor's own records when the sponsor opens Home. Pure rules in check()
// are tested by tools/test_alerts.js.
(function (root) {
  var DAY = 86400000;

  function dayKey(ms) { var d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function weekDays(now) {
    var d = new Date(now), dow = (d.getDay() + 6) % 7, out = [];
    for (var i = 0; i < 7; i++) out.push(dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow + i).getTime()));
    return { days: out, elapsed: dow + 1 };
  }

  // m: { attempts, ledger, workouts, daily }; opts: { now, weeklyGoal, topicNames, daysToCompetition }
  // Returns [{ key, level: 'high'|'medium'|'info', text }], most urgent first.
  function check(m, opts) {
    var now = opts.now, out = [];
    var A = m.attempts || [], L = m.ledger || [], W = m.workouts || [], D = m.daily || {};
    var stamps = [].concat(A, L).map(function (x) { return x.at || 0; })
      .concat(W.map(function (w) { return new Date(w.date + 'T12:00:00').getTime(); }));
    var last = stamps.length ? Math.max.apply(null, stamps) : 0;
    var idle = last ? Math.floor((now - last) / DAY) : null;

    if (idle === null) out.push({ key: 'never', level: 'high', text: 'hasn\'t started training in the app' });
    else if (idle >= 7) out.push({ key: 'quiet', level: 'high', text: 'no activity in ' + idle + ' days' });
    else if (idle >= 4) out.push({ key: 'slowing', level: 'medium', text: 'no activity in ' + idle + ' days' });

    if (idle !== null) {
      var wk = weekDays(now);
      // From Thursday on, flag a week that is falling short.
      if (wk.elapsed >= 4) {
        var done = wk.days.filter(function (d) { return D[d] && D[d].done; }).length;
        var goal = opts.weeklyGoal || 4;
        if (done < Math.ceil(goal / 2)) out.push({ key: 'daily', level: 'medium', text: 'behind on Daily 10 this week (' + done + ' of ' + goal + ')' });
        var mins = W.filter(function (w) { return wk.days.indexOf(w.date) >= 0; }).length;
        if (!mins) out.push({ key: 'fitness', level: 'medium', text: 'no workouts logged this week' });
      }

      // A weak topic that is still weak in the last two weeks.
      var recent = now - 14 * DAY;
      var byTopic = {};
      A.forEach(function (a) {
        if (!a.topic) return;
        var t = byTopic[a.topic] || (byTopic[a.topic] = { n: 0, r: 0, rn: 0, rr: 0 });
        t.n++; if (a.correct) t.r++;
        if (a.at >= recent) { t.rn++; if (a.correct) t.rr++; }
      });
      Object.keys(byTopic).forEach(function (k) {
        var t = byTopic[k];
        if (t.n >= 8 && t.r / t.n < 0.6 && (t.rn === 0 || t.rr / t.rn < 0.6)) {
          out.push({ key: 'weak:' + k, level: 'medium', text: (opts.topicNames[k] || k) + ' stuck at ' + Math.round(t.r / t.n * 100) + '%' });
        }
      });

      // Boards matter more as the competition gets close.
      var boards = L.filter(function (e) { return e.kind === 'board-done'; });
      var lastBoard = boards.length ? Math.max.apply(null, boards.map(function (b) { return b.at; })) : 0;
      if (opts.daysToCompetition != null && opts.daysToCompetition <= 60 && (!lastBoard || now - lastBoard > 14 * DAY)) {
        out.push({ key: 'board', level: opts.daysToCompetition <= 21 ? 'high' : 'medium', text: lastBoard ? 'no board in ' + Math.floor((now - lastBoard) / DAY) + ' days' : 'hasn\'t sat a board yet' });
      }
    }

    var pending = W.filter(function (w) { return w.shot && !w.review; }).length;
    if (pending) out.push({ key: 'verify', level: 'info', text: pending + ' workout screenshot' + (pending === 1 ? '' : 's') + ' to verify' });

    var rank = { high: 0, medium: 1, info: 2 };
    return out.sort(function (a, b) { return rank[a.level] - rank[b.level]; });
  }

  var api = { check: check };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  // ---------- Home screen card ----------

  var SNOOZE_DAYS = 3;
  var cache = null; // { at, rows }

  function U() { return BWC.UI; }
  function snoozed() { try { return JSON.parse(window.localStorage.getItem('bwc.snooze') || '{}'); } catch (e) { return {}; } }
  function snooze(k) {
    var s = snoozed();
    s[k] = Date.now() + SNOOZE_DAYS * DAY;
    try { window.localStorage.setItem('bwc.snooze', JSON.stringify(s)); } catch (e) { /* ignore */ }
  }

  function load() {
    if (cache && Date.now() - cache.at < 5 * 60000) return Promise.resolve(cache.rows);
    var C = window.BWC_CONFIG;
    var next = BWC.Progress.nextCompetition();
    var days = next ? (next.days != null ? next.days : next.dated ? next.dated.days : null) : null;
    var names = {};
    C.topics.forEach(function (t) { names[t.id] = t.name; });
    return BWC.Store.competitors().then(function (people) {
      return Promise.all(people.map(function (p) {
        return BWC.Team.loadMember(p.uid).then(function (m) {
          return { p: p, alerts: check(m, { now: Date.now(), weeklyGoal: C.points.weeklyGoalDays, topicNames: names, daysToCompetition: days }) };
        }).catch(function () { return { p: p, alerts: [] }; });
      }));
    }).then(function (rows) { cache = { at: Date.now(), rows: rows }; return rows; });
  }

  // Fills #alerts-card on Home for sponsors and leaders.
  function renderCard() {
    var el = document.getElementById('alerts-card');
    if (!el) return;
    var u = U();
    load().then(function (rows) {
      el = document.getElementById('alerts-card');
      if (!el) return;
      var s = snoozed(), now = Date.now();
      var items = [];
      rows.forEach(function (r) {
        r.alerts.forEach(function (a) {
          var k = r.p.uid + ':' + a.key;
          if (s[k] && s[k] > now) return;
          items.push({ k: k, a: a, p: r.p });
        });
      });
      var rank = { high: 0, medium: 1, info: 2 };
      items.sort(function (x, y) { return rank[x.a.level] - rank[y.a.level]; });
      var shown = items.slice(0, 6);
      el.innerHTML = '<div class="row"><h2 class="grow">Readiness alerts</h2><a class="link-btn" href="#/team">Competitors</a></div>' +
        (shown.length ? '<div class="list">' + shown.map(function (it) {
          return '<div class="list-row alert-row"><span class="alert-dot ' + it.a.level + '" aria-hidden="true"></span>' +
            '<a class="grow" href="#/team/' + encodeURIComponent(it.p.uid) + '"><strong>' + u.esc(u.displayName(it.p)) + '</strong> <span class="small">' + u.esc(it.a.text) + '</span></a>' +
            '<button type="button" class="link-btn small" data-snooze="' + u.esc(it.k) + '" aria-label="Snooze this alert for ' + SNOOZE_DAYS + ' days">Snooze</button></div>';
        }).join('') + '</div>' + (items.length > shown.length ? '<p class="muted small">+' + (items.length - shown.length) + ' more on the competitor pages.</p>' : '')
          : '<p class="muted">All clear. Your competitors are on track.</p>');
      el.querySelectorAll('[data-snooze]').forEach(function (b) {
        b.addEventListener('click', function () { snooze(b.getAttribute('data-snooze')); renderCard(); });
      });
    }).catch(function () { el.innerHTML = '<h2>Readiness alerts</h2><p class="muted small">Could not load alerts.</p>'; });
  }

  root.BWC = root.BWC || {};
  root.BWC.Alerts = Object.assign({ renderCard: renderCard, load: load, clearCache: function () { cache = null; } }, api);
})(this);
