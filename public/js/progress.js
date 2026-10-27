// Points, ranks and question selection. Pure functions over the saved attempts
// and ledger, so the same rules work on this device and online.
(function () {
  var C = window.BWC_CONFIG;

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // Monday-start week key, used for the weekly Daily 10 goal.
  function weekDates() {
    var d = new Date();
    var day = (d.getDay() + 6) % 7;
    var out = [];
    for (var i = 0; i < 7; i++) {
      var x = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day + i);
      out.push(x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'));
    }
    return out;
  }

  function rankFor(points) {
    var r = C.ranks[0];
    for (var i = 0; i < C.ranks.length; i++) if (points >= C.ranks[i].need) r = C.ranks[i];
    var idx = C.ranks.indexOf(r);
    var next = C.ranks[idx + 1] || null;
    var pct = next ? Math.min(100, Math.round(((points - r.need) / (next.need - r.need)) * 100)) : 100;
    return { rank: r, next: next, toNext: next ? next.need - points : 0, pct: pct };
  }

  // Per-question history: last result, times seen, ever correct.
  function history(attempts) {
    var h = {};
    attempts.forEach(function (a) {
      var x = h[a.qid] || (h[a.qid] = { seen: 0, right: 0, last: null, lastAt: 0 });
      x.seen++;
      if (a.correct) x.right++;
      if ((a.at || 0) >= x.lastAt) { x.last = a.correct; x.lastAt = a.at || 0; }
    });
    return h;
  }

  function topicStats(questions, attempts, learned) {
    var h = history(attempts);
    var out = {};
    questions.forEach(function (q) {
      var t = out[q.topic] || (out[q.topic] = { total: 0, learned: 0, seen: 0, answered: 0, right: 0 });
      t.total++;
      if (learned[q.id]) t.learned++;
      var x = h[q.id];
      if (x) { t.seen++; t.answered += x.seen; t.right += x.right; }
    });
    Object.keys(out).forEach(function (k) {
      var t = out[k];
      t.accuracy = t.answered ? Math.round((t.right / t.answered) * 100) : null;
    });
    return out;
  }

  // Points for a finished quiz: one per question answered right for the first time ever.
  function quizPoints(results, attempts) {
    var everRight = {};
    attempts.forEach(function (a) { if (a.correct) everRight[a.qid] = true; });
    var entries = [];
    results.forEach(function (r) {
      if (r.correct && !everRight[r.qid]) {
        everRight[r.qid] = true;
        entries.push({ kind: 'quiz', pts: C.points.quizCorrect, ref: r.qid });
      }
    });
    return entries;
  }

  // Reading points are capped per day.
  function readPoints(ledger, ref) {
    var t = today();
    var used = ledger.filter(function (e) {
      return e.kind === 'read' && toDay(e.at) === t;
    }).reduce(function (s, e) { return s + e.pts; }, 0);
    if (used >= C.points.readDailyCap) return [];
    return [{ kind: 'read', pts: C.points.readSource, ref: ref }];
  }

  function toDay(ms) {
    var d = new Date(ms || Date.now());
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // Daily 10: missed questions first, then never-seen ones from the weakest topics,
  // then the longest-unseen. Learned questions are skipped except for one refresher.
  function pickDaily(questions, attempts, learned, n) {
    n = n || 10;
    var h = history(attempts);
    var stats = topicStats(questions, attempts, learned);
    function weakness(q) {
      var s = stats[q.topic];
      return s && s.accuracy != null ? s.accuracy : 50;
    }
    var pool = questions.filter(function (q) { return !learned[q.id]; });
    var missed = shuffle(pool.filter(function (q) { return h[q.id] && h[q.id].last === false; }));
    var unseen = shuffle(pool.filter(function (q) { return !h[q.id]; }))
      .sort(function (a, b) { return weakness(a) - weakness(b); });
    var stale = pool.filter(function (q) { return h[q.id] && h[q.id].last === true; })
      .sort(function (a, b) { return h[a.id].lastAt - h[b.id].lastAt; });
    var picked = missed.slice(0, 4);
    unseen.concat(stale, missed.slice(4)).forEach(function (q) {
      if (picked.length < n - 1 && picked.indexOf(q) < 0) picked.push(q);
    });
    var refresher = shuffle(questions.filter(function (q) { return learned[q.id]; }))[0];
    if (refresher) picked.push(refresher);
    pool.forEach(function (q) { if (picked.length < n && picked.indexOf(q) < 0) picked.push(q); });
    return shuffle(picked.slice(0, n));
  }

  // The next competition in season order (it may not have a date yet), plus the next
  // one that does have a date, so the home screen can always show a countdown.
  function nextCompetition() {
    var now = Date.now();
    function daysTo(c) { return Math.max(0, Math.ceil((new Date(c.date + 'T00:00:00').getTime() - now) / 86400000)); }
    var upcoming = C.competitions.filter(function (c) {
      return !c.date || new Date(c.date + 'T00:00:00').getTime() >= now - 86400000;
    });
    if (!upcoming.length) return null;
    var first = upcoming[0];
    var dated = upcoming.filter(function (c) { return c.date; })[0] || null;
    return {
      comp: first,
      days: first.date ? daysTo(first) : null,
      dated: dated && dated !== first ? { comp: dated, days: daysTo(dated) } : null
    };
  }

  window.BWC = window.BWC || {};
  BWC.Progress = {
    today: today,
    weekDates: weekDates,
    rankFor: rankFor,
    history: history,
    topicStats: topicStats,
    quizPoints: quizPoints,
    readPoints: readPoints,
    pickDaily: pickDaily,
    shuffle: shuffle,
    nextCompetition: nextCompetition
  };
})();
