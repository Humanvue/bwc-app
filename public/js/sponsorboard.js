// Linked sponsor board: the sponsor runs a board from their phone (answer key, timer, GO/NO-GO)
// while the Soldier sits it on their own device, which shows the panel and reads each question
// aloud. The two screens stay in sync through one shared live record (Store.*Live).
// Routes: #/sponsorboard (setup), #/sponsorboard/<code> (sponsor), #/linked[/<code>] (Soldier).
(function () {
  var C = window.BWC_CONFIG;
  var BC = C.board;
  var P = BWC.Progress;
  var POINTS = { go: 5, complete: 20 };

  var unwatch = null, tick = null, spokenKey = null;

  function U() { return BWC.UI; }
  function app() { return document.getElementById('app'); }
  function qById(id) { return (window.BWC_QUESTIONS || []).filter(function (q) { return q.id === id; })[0]; }
  function titleFor(seat) { return BC.seats[seat].title === '1SG' ? 'First Sergeant' : 'Sergeant Major'; }

  function stop() {
    if (unwatch) { unwatch(); unwatch = null; }
    if (tick) { clearInterval(tick); tick = null; }
    spokenKey = null;
  }

  function watch(code, render) {
    stop();
    unwatch = BWC.Store.watchLive(code, function (b) { render(b); });
  }

  // Countdown shared by both screens: computed from the sponsor's start time.
  function startTimer(b) {
    if (tick) clearInterval(tick);
    tick = setInterval(function () {
      var bar = document.getElementById('lb-time'), secs = document.getElementById('lb-secs');
      if (!bar || b.phase !== 'question') { clearInterval(tick); tick = null; return; }
      var left = Math.max(0, b.seconds * 1000 - (Date.now() - b.startedAt));
      bar.style.width = (left / (b.seconds * 1000) * 100) + '%';
      bar.classList.toggle('low', left < 10000);
      secs.textContent = left > 0 ? Math.ceil(left / 1000) + ' seconds left' : 'Time';
    }, 250);
  }
  function timerHtml() {
    return '<div class="bar timer" role="timer" aria-label="Time remaining"><span id="lb-time" style="width:100%"></span></div><div class="small muted" id="lb-secs"></div>';
  }

  // ---------- sponsor: set up ----------

  function viewSetup() {
    var u = U();
    stop();
    app().innerHTML = u.header('Sponsor board', '#/me') + '<div class="card"><p class="muted">Loading your competitors…</p></div>';
    BWC.Store.competitors().then(function (people) {
      if (!people.length) {
        app().innerHTML = u.header('Sponsor board', '#/me') + '<div class="card"><p>No competitors are assigned to you yet. An admin assigns sponsors under Me → Admin → People.</p></div>';
        return;
      }
      var groups = [{ id: 'all', name: 'All topics' }].concat(C.groups);
      app().innerHTML = u.header('Sponsor board', '#/me') +
        '<p class="muted">You run the board from this phone: you see each answer and its source, the timer, and you score GO or NO-GO. Your competitor sits it on their own device, which shows the panel and reads the questions aloud.</p>' +
        '<form class="card" id="sb-form">' +
        '<label class="field">Competitor<select class="input" id="sb-who">' + people.map(function (p) {
          return '<option value="' + u.esc(p.uid) + '">' + u.esc(u.displayName(p)) + '</option>';
        }).join('') + '</select></label>' +
        '<div class="row wrap"><label class="field grow">Questions<select class="input" id="sb-n">' + BC.questionCounts.map(function (n) {
          return '<option' + (n === BC.defaultQuestions ? ' selected' : '') + '>' + n + '</option>';
        }).join('') + '</select></label>' +
        '<label class="field grow">Time each<select class="input" id="sb-secs">' + BC.secondsOptions.map(function (s) {
          return '<option value="' + s + '"' + (s === BC.defaultSeconds ? ' selected' : '') + '>' + s + ' s</option>';
        }).join('') + '</select></label></div>' +
        '<label class="field">Topics<select class="input" id="sb-topics">' + groups.map(function (g) {
          return '<option value="' + g.id + '">' + u.esc(g.name) + '</option>';
        }).join('') + '</select></label>' +
        '<button class="btn" type="submit">Create board</button></form>';
      document.getElementById('sb-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var who = people.filter(function (p) { return p.uid === document.getElementById('sb-who').value; })[0];
        var group = document.getElementById('sb-topics').value;
        var pool = (window.BWC_QUESTIONS || []).filter(function (q) {
          if (group === 'all') return true;
          var t = u.topicById(q.topic);
          return t && t.group === group;
        });
        var qids = P.shuffle(pool).slice(0, parseInt(document.getElementById('sb-n').value, 10)).map(function (q) { return q.id; });
        var order = [2, 1, 3, 0, 4];
        var btn = this.querySelector('button[type=submit]');
        btn.disabled = true;
        BWC.Store.createLive({
          soldierUid: who.uid, soldierName: u.displayName(who), sponsorName: u.displayName(u.S.user),
          qids: qids, seats: qids.map(function (_, i) { return order[i % order.length]; }),
          seconds: parseInt(document.getElementById('sb-secs').value, 10),
          phase: 'lobby', idx: 0, startedAt: 0, joined: false,
          results: qids.map(function () { return null; }), report: null
        }).then(function (code) { location.hash = '#/sponsorboard/' + code; })
          .catch(function () { btn.disabled = false; u.toast('Could not create the board. Only a competitor\'s sponsor or a leader can.'); });
      });
    });
  }

  // ---------- sponsor: run the board ----------

  function viewSponsor(code) {
    var u = U();
    watch(code, function (b) {
      if (!b) { app().innerHTML = u.header('Sponsor board', '#/sponsorboard') + '<div class="card"><p>Board ' + u.esc(code) + ' was not found.</p></div>'; return; }
      var upd = function (f) { return BWC.Store.updateLive(code, f).catch(function () { u.toast('Not saved. Check your connection.'); }); };

      if (b.phase === 'lobby') {
        app().innerHTML = u.header('Sponsor board', '#/sponsorboard') +
          '<div class="banner"><div class="grow"><div class="eyebrow">Board code</div><div class="big code-big">' + u.esc(code) + '</div>' +
          '<div class="small" style="font-weight:700">' + u.esc(b.soldierName) + ' opens Mock Board → Join a sponsor board, and enters this code.</div></div></div>' +
          '<div class="card"><div class="row"><span class="chip ' + (b.joined ? 'good' : '') + '">' + (b.joined ? 'Joined' : 'Waiting to join…') + '</span>' +
          '<span class="muted small grow">' + b.qids.length + ' questions · ' + b.seconds + ' s each</span></div>' +
          '<button type="button" class="btn" id="sb-start"' + (b.joined ? '' : ' disabled') + '>Start: have them report in</button></div>';
        document.getElementById('sb-start').addEventListener('click', function () { upd({ phase: 'report' }); });
        return;
      }

      if (b.phase === 'report') {
        app().innerHTML = '<h1>Reporting in</h1>' +
          '<div class="card"><p>Your competitor knocks, enters and reports to the President. Score what you heard:</p>' +
          ['Addressed "Sergeant Major"', 'Gave rank and last name', 'Said they report to the President of the Board', 'Military bearing (halt, salute if required, eyes)'].map(function (t, i) {
            return '<label class="row"><input type="checkbox" id="sb-r' + i + '"> ' + u.esc(t) + '</label>';
          }).join('') + '<button type="button" class="btn" id="sb-seat">Take your seat: start question 1</button></div>';
        document.getElementById('sb-seat').addEventListener('click', function () {
          var r = [0, 1, 2, 3].map(function (i) { return document.getElementById('sb-r' + i).checked; });
          upd({ report: r, phase: 'question', idx: 0, startedAt: Date.now() });
        });
        return;
      }

      if (b.phase === 'question') {
        var q = qById(b.qids[b.idx]);
        var seat = BC.seats[b.seats[b.idx]];
        app().innerHTML = '<div class="row spread"><h1>Question ' + (b.idx + 1) + ' of ' + b.qids.length + '</h1><span class="chip">' + u.esc(seat.title) + ' asks</span></div>' +
          timerHtml() +
          '<div class="card"><div class="qtext">' + u.esc(q ? q.q : '(question missing)') + '</div>' +
          '<div class="answer-key"><div class="eyebrow">Answer key</div><strong>' + u.esc(q ? q.answer : '') + '</strong>' +
          (q && q.keywords && q.keywords.length ? '<div class="small">Listen for: ' + q.keywords.map(u.esc).join(', ') + '</div>' : '') +
          (q ? '<div class="cite">' + u.esc(q.pub) + (q.para ? ', para ' + u.esc(q.para) : '') + '</div>' : '') + '</div>' +
          '<p class="small muted">Expected: "' + titleFor(b.seats[b.idx]) + ', [restates the question] is [answer]."</p>' +
          '<label class="row"><input type="checkbox" id="sb-addr"> Addressed "' + titleFor(b.seats[b.idx]) + '"</label>' +
          '<label class="row"><input type="checkbox" id="sb-rest"> Restated the question</label>' +
          '<div class="row"><button type="button" class="btn grow go-btn" id="sb-go">' + u.icon('check', 20) + 'GO</button>' +
          '<button type="button" class="btn grow nogo-btn" id="sb-nogo">' + u.icon('x', 20) + 'NO-GO</button></div></div>';
        startTimer(b);
        var score = function (go) {
          var results = b.results.slice();
          results[b.idx] = { go: go, address: document.getElementById('sb-addr').checked, restate: document.getElementById('sb-rest').checked };
          var last = b.idx >= b.qids.length - 1;
          upd(last ? { results: results, phase: 'scoring' } : { results: results, idx: b.idx + 1, startedAt: Date.now() });
        };
        document.getElementById('sb-go').addEventListener('click', function () { score(true); });
        document.getElementById('sb-nogo').addEventListener('click', function () { score(false); });
        return;
      }

      if (b.phase === 'scoring') {
        var opts = [1, 2, 3, 4, 5].map(function (n) { return '<option' + (n === 3 ? ' selected' : '') + '>' + n + '</option>'; }).join('');
        app().innerHTML = '<h1>Board scoring</h1><form class="card" id="sb-final">' +
          '<div class="row wrap"><label class="field grow">Military bearing (1–5)<select class="input" id="sb-bear">' + opts + '</select></label>' +
          '<label class="field grow">Confidence (1–5)<select class="input" id="sb-conf">' + opts + '</select></label></div>' +
          '<label class="field">Notes for your competitor (optional)<textarea class="input" id="sb-notes" maxlength="1000" placeholder="Strengths, what to fix before the next board"></textarea></label>' +
          '<button class="btn" type="submit">Finish the board</button></form>';
        document.getElementById('sb-final').addEventListener('submit', function (e) {
          e.preventDefault();
          upd({ phase: 'done', bearing: +document.getElementById('sb-bear').value, confidence: +document.getElementById('sb-conf').value,
            notes: document.getElementById('sb-notes').value.trim(), finishedAt: Date.now() });
        });
        return;
      }

      // done
      app().innerHTML = u.header('Board complete', '#/me') + summary(b) +
        '<div class="row wrap"><a class="btn grow" href="#/sponsorboard">Run another board</a><a class="btn ghost grow" href="#/team/' + encodeURIComponent(b.soldierUid) + '">Competitor page</a></div>';
    });
  }

  function summary(b) {
    var u = U();
    var gos = b.results.filter(function (r) { return r && r.go; }).length;
    var fmt = b.results.filter(function (r) { return r && r.address && r.restate; }).length;
    var pct = Math.round(gos / b.qids.length * 100);
    return '<div class="banner"><div class="grow"><div class="eyebrow">Sponsor board · ' + u.esc(b.soldierName) + '</div><div class="big">' + pct + '%</div>' +
      '<div class="small" style="font-weight:700">' + gos + ' of ' + b.qids.length + ' GO · format correct on ' + fmt + ' · bearing ' + (b.bearing || '–') + '/5 · confidence ' + (b.confidence || '–') + '/5</div></div>' + u.icon('mic', 56, 1.8) + '</div>' +
      (b.notes ? '<div class="card"><h3>Sponsor notes</h3><p>' + u.esc(b.notes) + '</p></div>' : '') +
      '<div class="card"><div class="list">' + b.qids.map(function (id, i) {
        var q = qById(id), r = b.results[i] || {};
        return '<div class="list-row" style="flex-wrap:wrap"><span class="chip ' + (r.go ? 'good' : 'bad') + '">' + (r.go ? 'GO' : 'NO-GO') + '</span>' +
          '<span class="grow small">' + u.esc(q ? q.q : id) + '<br><span class="muted">' + u.esc(q ? q.answer : '') + '</span></span></div>';
      }).join('') + '</div></div>';
  }

  // ---------- Soldier: join and sit the board ----------

  function viewJoin(code) {
    var u = U();
    stop();
    if (code) return sit(code.toUpperCase());
    app().innerHTML = u.header('Join a sponsor board', '#/board') +
      '<form class="card" id="jn-form"><p>Your sponsor gives you a 4-letter code.</p>' +
      '<label class="field" for="jn-code">Board code</label><input class="input mono code-input" id="jn-code" maxlength="4" autocomplete="off" autocapitalize="characters" required>' +
      '<p class="muted small">' + u.esc(BWC.Speech.TIP) + '</p><button class="btn" type="submit">Join</button></form>';
    document.getElementById('jn-form').addEventListener('submit', function (e) {
      e.preventDefault();
      BWC.Speech.unlock(); // the panel will speak; iPhone needs this tap first
      location.hash = '#/linked/' + document.getElementById('jn-code').value.trim().toUpperCase();
    });
  }

  function sit(code) {
    var u = U();
    BWC.Store.getLive(code).then(function (b0) {
      if (!b0 || b0.soldierUid !== u.S.user.uid) {
        app().innerHTML = u.header('Join a sponsor board', '#/linked') + '<div class="card"><p>No board with code <strong>' + u.esc(code) + '</strong> is set up for you. Check the code with your sponsor.</p></div>';
        return;
      }
      if (!b0.joined) BWC.Store.updateLive(code, { joined: true });
      watch(code, function (b) {
        if (!b) return;
        if (b.phase === 'lobby') {
          app().innerHTML = '<h1>Sponsor board</h1>' + BWC.Board.panel(2) + '<div class="card"><p>Joined. Waiting for <strong>' + u.esc(b.sponsorName || 'your sponsor') + '</strong> to start.</p>' +
            '<div class="row wrap">' + BWC.Speech.testButton('jn-test') + '</div></div>';
          BWC.Speech.wireTest('jn-test');
          return;
        }
        if (b.phase === 'report') {
          app().innerHTML = '<h1>Report to the board</h1>' + BWC.Board.panel(2) +
            '<div class="card"><p><strong>Knock, enter, and report to the President of the Board out loud.</strong> Your sponsor is listening.</p></div>';
          sayOnce('report', 'Enter and report to the President of the Board.', 2);
          return;
        }
        if (b.phase === 'question') {
          var q = qById(b.qids[b.idx]);
          var seatIdx = b.seats[b.idx];
          app().innerHTML = '<h1>Question ' + (b.idx + 1) + ' of ' + b.qids.length + '</h1>' + BWC.Board.panel(seatIdx) +
            '<div class="card"><div class="row"><span class="chip">' + u.esc(BC.seats[seatIdx].title) + ' asks</span><span class="muted small grow">Answer out loud: "' + titleFor(seatIdx) + ', …"</span></div>' +
            '<div class="qtext" id="lq" hidden>' + u.esc(q ? q.q : '') + '</div>' + timerHtml() +
            '<div class="row wrap"><button type="button" class="btn small ghost" id="lq-rep">' + u.icon('mic', 16) + 'Ask to repeat</button>' +
            '<button type="button" class="btn small ghost" id="lq-show">Show question text</button></div></div>';
          startTimer(b);
          sayOnce('q' + b.idx, q ? q.q : '', seatIdx);
          document.getElementById('lq-rep').addEventListener('click', function () { speak(q ? q.q : '', seatIdx); });
          document.getElementById('lq-show').addEventListener('click', function () { document.getElementById('lq').hidden = false; this.remove(); });
          return;
        }
        if (b.phase === 'scoring') {
          app().innerHTML = '<h1>The board is deliberating</h1>' + BWC.Board.panel(2) + '<div class="card"><p>Stay seated. Your sponsor is finishing your scores.</p></div>';
          sayOnce('end', 'That concludes your board.', 2);
          return;
        }
        // done: show results and award points once
        app().innerHTML = u.header('Board results', '#/') + summary(b) + '<div class="row wrap"><a class="btn grow" href="#/">Home</a></div>';
        awardOnce(code, b);
      });
    });
  }

  function speak(text, seat) {
    BWC.Speech.speak(text, { voiceIndex: seat * 3, rate: 0.95, pitch: [0.9, 1.0, 0.8, 1.1, 1.0][seat] || 1 });
  }
  function sayOnce(key, text, seat) {
    if (spokenKey === key) return;
    spokenKey = key;
    speak(text, seat);
  }

  function awardOnce(code, b) {
    var u = U();
    var ref = 'live:' + code;
    if (u.S.ledger.some(function (e) { return e.ref === ref; })) return;
    var gos = b.results.filter(function (r) { return r && r.go; }).length;
    var pct = Math.round(gos / b.qids.length * 100);
    var fmt = b.results.filter(function (r) { return r && r.address && r.restate; }).length;
    var entries = [];
    if (gos) entries.push({ kind: 'sponsor-board', pts: Math.min(50, gos * POINTS.go), ref: ref });
    entries.push({ kind: 'sponsor-board-complete', pts: POINTS.complete, ref: ref + ':done' });
    entries.push({ kind: 'board-done', pts: 0, ref: ref, score: pct, right: gos, partial: 0, format: fmt, of: b.qids.length, sponsored: true });
    var attempts = b.qids.map(function (id, i) { var q = qById(id); return { qid: id, topic: q ? q.topic : '', correct: !!(b.results[i] && b.results[i].go), mode: 'sponsor-board' }; });
    BWC.Store.addAttempts(attempts);
    attempts.forEach(function (a) { u.S.attempts.push(Object.assign({ at: Date.now() }, a)); });
    u.award(entries).then(function () { u.toast('+' + entries.reduce(function (s, e) { return s + e.pts; }, 0) + ' points'); });
  }

  BWC.SponsorBoard = { setup: viewSetup, sponsor: viewSponsor, join: viewJoin, stop: stop };
})();
