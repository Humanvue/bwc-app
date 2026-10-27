// Mock board: sit in front of a CSM-led panel, hear each question read aloud, and answer
// by voice or typing against the clock. Graded by grading.js on address, restatement and
// content. Routes: #/board (setup), #/board/report, #/board/q, #/board/results.
(function () {
  var C = window.BWC_CONFIG;
  var BC = C.board;
  var G = BWC.Grading;
  var P = BWC.Progress;

  var B = null;          // the board in progress
  var tick = null;       // countdown interval
  var rec = null;        // speech recognition in progress
  var Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  var canSpeak = 'speechSynthesis' in window;

  function U() { return BWC.UI; }
  function app() { return document.getElementById('app'); }

  // ---------- voice ----------

  // Each seat gets its own voice so you hear who is asking.
  function voices() {
    if (!canSpeak) return [];
    return window.speechSynthesis.getVoices().filter(function (v) { return /^en(-|_)/i.test(v.lang); });
  }
  if (canSpeak) window.speechSynthesis.onvoiceschanged = function () {};

  function say(text, seatIndex, done) {
    if (!canSpeak || !B || !B.readAloud) { if (done) done(); return; }
    var synth = window.speechSynthesis;
    synth.cancel();
    var u = new SpeechSynthesisUtterance(text);
    var vs = voices();
    if (vs.length) u.voice = vs[(seatIndex * 3) % vs.length];
    u.rate = 0.95;
    u.pitch = [0.9, 1.0, 0.8, 1.1, 1.0][seatIndex] || 1;
    u.onend = function () { if (done) done(); };
    u.onerror = function () { if (done) done(); };
    synth.speak(u);
  }

  function startListening(textarea, button) {
    if (!Rec) return;
    stopListening();
    rec = new Rec();
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = true;
    var base = textarea.value ? textarea.value.trim() + ' ' : '';
    rec.onresult = function (e) {
      var text = '';
      for (var i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      textarea.value = base + text.trim();
    };
    rec.onend = function () { rec = null; if (button) setMicLabel(button, false); };
    rec.onerror = function (e) {
      if (e.error === 'not-allowed') U().toast('Microphone blocked. Allow it in your browser, or type your answer.');
    };
    try { rec.start(); setMicLabel(button, true); } catch (err) { rec = null; }
  }

  function stopListening() {
    if (rec) { try { rec.stop(); } catch (e) { /* already stopped */ } rec = null; }
  }

  function setMicLabel(button, on) {
    if (!button) return;
    button.innerHTML = U().icon(on ? 'x' : 'mic', 18) + (on ? 'Stop listening' : 'Speak your answer');
    button.classList.toggle('listening', on);
  }

  function stop() {
    if (tick) { clearInterval(tick); tick = null; }
    stopListening();
    if (canSpeak) window.speechSynthesis.cancel();
  }

  // ---------- pieces ----------

  function panel(active) {
    var u = U();
    return '<div class="panel" aria-label="Board panel">' +
      '<div class="seats">' + BC.seats.map(function (s, i) {
        return '<div class="seat' + (i === active ? ' active' : '') + (s.president ? ' president' : '') + '">' +
          '<div class="seat-badge">' + u.esc(s.title) + '</div>' +
          '<div class="seat-label">' + u.esc(s.president ? 'President' : s.label) + '</div></div>';
      }).join('') + '</div><div class="table-edge" aria-hidden="true"></div></div>';
  }

  function timerBar() {
    return '<div class="bar timer" role="timer" aria-label="Time remaining"><span id="bd-time" style="width:100%"></span></div>' +
      '<div class="row spread small muted"><span id="bd-secs"></span><span>No hints at a real board</span></div>';
  }

  function answerBox(placeholder) {
    var u = U();
    return '<label class="field" for="bd-answer">Your answer</label>' +
      '<textarea class="input" id="bd-answer" rows="4" placeholder="' + u.esc(placeholder) + '"></textarea>' +
      '<div class="row wrap">' + (Rec ? '<button type="button" class="btn ghost small" id="bd-mic">' + u.icon('mic', 18) + 'Speak your answer</button>' : '<span class="muted small">Voice answers need Chrome, Edge or Safari. Type instead.</span>') + '</div>';
  }

  // ---------- setup ----------

  function viewSetup() {
    var u = U();
    var groups = [{ id: 'all', name: 'All topics' }].concat(C.groups);
    var today = P.today();
    var sat = u.S.ledger.filter(function (e) { return e.kind === 'board-done' && toDay(e.at) === today; }).length;
    var left = Math.max(0, BC.boardsPerDayForPoints - sat);
    app().innerHTML = u.header('Mock Board', '#/') + panel(2) +
      '<div class="card"><p>Report to the board, then answer each question as the member who asked it expects:</p>' +
      '<div class="board-line">"<em>Sergeant Major,</em> the regulation that covers wear and appearance of Army uniforms <em>is</em> AR 670-1."</div>' +
      '<p class="muted small">Address the member who asked: <strong>CSM or SGM → "Sergeant Major"</strong>, <strong>1SG → "First Sergeant"</strong>. Restate the question, then give the answer.</p></div>' +
      '<form class="card" id="bd-setup"><h2>Board settings</h2>' +
      '<label class="field">Questions<select class="input" id="bd-n">' + BC.questionCounts.map(function (n) {
        return '<option' + (n === BC.defaultQuestions ? ' selected' : '') + '>' + n + '</option>';
      }).join('') + '</select></label>' +
      '<label class="field">Time per question<select class="input" id="bd-secs-opt">' + BC.secondsOptions.map(function (s) {
        return '<option value="' + s + '"' + (s === BC.defaultSeconds ? ' selected' : '') + '>' + s + ' seconds</option>';
      }).join('') + '</select></label>' +
      '<label class="field">Topics<select class="input" id="bd-topics">' + groups.map(function (g) {
        return '<option value="' + g.id + '">' + u.esc(g.name) + '</option>';
      }).join('') + '</select></label>' +
      (canSpeak ? '<label class="row small"><input type="checkbox" id="bd-aloud" checked> Read questions aloud (turn your volume up)</label>' : '') +
      '<button class="btn" type="submit">' + u.icon('mic', 20) + 'Knock and enter</button>' +
      '<p class="muted small">' + (left ? 'Earns points: ' + BC.points.right + ' per right answer, ' + BC.points.partial + ' if partly right, ' + BC.points.format +
        ' for correct format, +' + BC.points.pass + ' for passing (' + BC.passPct + '%). ' + left + ' scored board' + (left === 1 ? '' : 's') + ' left today.'
        : 'You have sat today\'s ' + BC.boardsPerDayForPoints + ' scored boards. This one is practice only.') + '</p></form>';

    document.getElementById('bd-setup').addEventListener('submit', function (e) {
      e.preventDefault();
      // iPhones only allow speech that starts from a tap; speaking once here unlocks it for the board.
      if (canSpeak) window.speechSynthesis.speak(new SpeechSynthesisUtterance(' '));
      var n = parseInt(document.getElementById('bd-n').value, 10);
      var group = document.getElementById('bd-topics').value;
      var pool = (window.BWC_QUESTIONS || []).filter(function (q) {
        if (group === 'all') return true;
        var t = u.topicById(q.topic);
        return t && t.group === group;
      });
      var list = P.shuffle(pool).slice(0, n);
      // Rotate askers so every member asks, president first.
      var order = [2, 1, 3, 0, 4];
      B = {
        list: list,
        seats: list.map(function (_, i) { return order[i % order.length]; }),
        answers: [], times: [], shown: [],
        idx: 0,
        seconds: parseInt(document.getElementById('bd-secs-opt').value, 10),
        readAloud: canSpeak && !!(document.getElementById('bd-aloud') || {}).checked,
        scored: left > 0,
        report: null,
        done: false
      };
      location.hash = '#/board/report';
    });
  }

  function toDay(ms) {
    var d = new Date(ms || Date.now());
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // ---------- reporting in ----------

  function viewReport() {
    var u = U();
    if (!B) { location.hash = '#/board'; return; }
    var me = u.S.user;
    var example = 'Sergeant Major, ' + rankWord(me.rank) + ' ' + lastName(me.name) + ' reports to the President of the Board.';
    app().innerHTML = u.header('Report to the board') + panel(2) +
      '<div class="card"><p><strong>Knock, enter, march to the center of the table, halt, salute if required, and report.</strong></p>' +
      '<p class="muted small">Example: "' + u.esc(example) + '" Use your unit\'s exact reporting statement if it differs.</p>' +
      answerBox('Sergeant Major, …') +
      '<button type="button" class="btn" id="bd-go">Report</button></div>';
    say('Enter and report to the President of the Board.', 2);
    wireMic();
    document.getElementById('bd-go').addEventListener('click', function () {
      stopListening();
      var text = document.getElementById('bd-answer').value;
      B.report = { text: text, g: G.gradeReport(text, rankWord(me.rank), lastName(me.name)) };
      var g = B.report.g;
      var notes = [];
      if (!g.address) notes.push('Start with "Sergeant Major," since the CSM presides.');
      if (!g.rank || !g.name) notes.push('State your rank and last name.');
      if (!g.reports) notes.push('Say that you "report" to the President of the Board.');
      app().querySelector('.card').innerHTML = '<h2>' + (notes.length ? 'Reported, with notes' : 'Good report') + '</h2>' +
        (notes.length ? '<ul>' + notes.map(function (n) { return '<li>' + u.esc(n) + '</li>'; }).join('') + '</ul>' : '<p>Clear and correct.</p>') +
        '<p class="muted small">The President directs you to take your seat.</p>' +
        '<button type="button" class="btn" id="bd-seat">Take your seat</button>';
      say(notes.length ? 'Take your seat.' : 'Good. Take your seat.', 2);
      document.getElementById('bd-seat').addEventListener('click', function () { location.hash = '#/board/q'; });
    });
  }

  function rankWord(abbr) {
    var map = { PVT: 'Private', PV2: 'Private', PFC: 'Private First Class', SPC: 'Specialist', CPL: 'Corporal', SGT: 'Sergeant',
      SSG: 'Staff Sergeant', SFC: 'Sergeant First Class', MSG: 'Master Sergeant', '1SG': 'First Sergeant', SGM: 'Sergeant Major', CSM: 'Command Sergeant Major' };
    return map[abbr] || abbr || 'Specialist';
  }

  function lastName(name) {
    var parts = String(name || 'Soldier').trim().split(/\s+/);
    return parts[parts.length - 1];
  }

  // ---------- questions ----------

  function viewQuestion() {
    var u = U();
    if (!B || !B.list.length) { location.hash = '#/board'; return; }
    if (B.done) { location.hash = '#/board/results'; return; }
    var q = B.list[B.idx];
    var seatIdx = B.seats[B.idx];
    var seat = BC.seats[seatIdx];
    var started = Date.now();
    B.shown[B.idx] = !B.readAloud;

    app().innerHTML = '<div class="row spread"><h1>Question ' + (B.idx + 1) + ' of ' + B.list.length + '</h1>' +
      '<button type="button" class="link-btn" id="bd-quit">Leave board</button></div>' +
      panel(seatIdx) +
      '<div class="card"><div class="row"><span class="chip">' + u.esc(seat.title) + ' asks</span>' +
      '<span class="muted small grow">Address as "' + (seat.title === '1SG' ? 'First Sergeant' : 'Sergeant Major') + '"</span></div>' +
      '<div class="qtext" id="bd-q"' + (B.shown[B.idx] ? '' : ' hidden') + '>' + u.esc(q.q) + '</div>' +
      (B.readAloud ? '<div class="row wrap"><button type="button" class="btn small ghost" id="bd-repeat">' + u.icon('mic', 18) + 'Ask to repeat</button>' +
        '<button type="button" class="btn small ghost" id="bd-show">Show question text</button></div>' : '') +
      timerBar() + answerBox(seat.title === '1SG' ? 'First Sergeant, …' : 'Sergeant Major, …') +
      '<button type="button" class="btn" id="bd-final">Final answer</button></div>';

    say(q.q, seatIdx);
    wireMic();
    var ta = document.getElementById('bd-answer');

    var rep = document.getElementById('bd-repeat');
    if (rep) rep.addEventListener('click', function () { say(q.q, seatIdx); });
    var show = document.getElementById('bd-show');
    if (show) show.addEventListener('click', function () {
      B.shown[B.idx] = true;
      document.getElementById('bd-q').hidden = false;
      show.remove();
    });
    document.getElementById('bd-quit').addEventListener('click', function () { stop(); B = null; location.hash = '#/'; });

    function submit() {
      if (!B || B.answers[B.idx] != null) return;
      stop();
      B.answers[B.idx] = ta.value;
      B.times[B.idx] = Math.round((Date.now() - started) / 1000);
      if (B.idx < B.list.length - 1) { B.idx++; viewQuestion(); } else finish();
    }
    document.getElementById('bd-final').addEventListener('click', submit);

    var limit = B.seconds * 1000;
    tick = setInterval(function () {
      var left = Math.max(0, limit - (Date.now() - started));
      var bar = document.getElementById('bd-time');
      var secs = document.getElementById('bd-secs');
      if (!bar) { stop(); return; }
      bar.style.width = (left / limit * 100) + '%';
      bar.classList.toggle('low', left < 10000);
      secs.textContent = Math.ceil(left / 1000) + ' seconds left';
      if (left <= 0) { u.toast('Time. Your answer was recorded.'); submit(); }
    }, 250);
  }

  function wireMic() {
    var mic = document.getElementById('bd-mic');
    var ta = document.getElementById('bd-answer');
    if (!mic) return;
    mic.addEventListener('click', function () {
      if (rec) stopListening(); else startListening(ta, mic);
    });
  }

  // ---------- results ----------

  function finish() {
    B.done = true;
    B.grades = B.list.map(function (q, i) { return G.grade(B.answers[i] || '', q, BC.seats[B.seats[i]].title); });
    // AI second opinion for answers the keyword check didn't mark right (worded differently).
    var todo = B.list.map(function (q, i) { return i; }).filter(function (i) { return !B.grades[i].content && !B.grades[i].blank; });
    if (!todo.length || !BWC.AI || !BWC.AI.available()) { score(); return; }
    app().innerHTML = '<div class="card"><h2>The board is reviewing your answers…</h2><p class="muted">Checking ' + todo.length +
      ' answer' + (todo.length === 1 ? '' : 's') + ' worded differently from the reference.</p></div>';
    var left = todo.length;
    var failed = 0;
    todo.forEach(function (i) {
      BWC.AI.grade(B.list[i], B.answers[i]).then(function (r) {
        var g = B.grades[i];
        g.ai = r;
        // The AI can raise a grade, never lower one.
        if (r.verdict === 'right') { g.content = true; g.partial = false; g.correct = true; }
        else if (r.verdict === 'partial' && !g.content) { g.partial = true; }
      }).catch(function () { failed++; }).then(function () {
        if (--left === 0) { B.aiFailed = failed; score(); }
      });
    });
  }

  function score() {
    var u = U();
    var right = B.grades.filter(function (g) { return g.content; }).length;
    var partial = B.grades.filter(function (g) { return g.partial; }).length;
    var formatted = B.grades.filter(function (g) { return g.address && g.restate; }).length;
    B.score = Math.round(((right + partial * 0.5) / B.list.length) * 100);
    B.passed = B.score >= BC.passPct;

    var entries = [];
    if (B.scored) {
      B.grades.forEach(function (g, i) {
        var pts = (g.content ? BC.points.right : g.partial ? BC.points.partial : 0) + (g.address && g.restate ? BC.points.format : 0);
        if (pts) entries.push({ kind: 'board', pts: pts, ref: B.list[i].id });
      });
      if (B.passed) entries.push({ kind: 'board-pass', pts: BC.points.pass, ref: 'board' });
    }
    // A zero-point record of every board sat, for the home tile and leaders.
    entries.push({ kind: 'board-done', pts: 0, ref: 'board', score: B.score, right: right, partial: partial, format: formatted, of: B.list.length });
    B.earned = entries.reduce(function (s, e) { return s + e.pts; }, 0);

    var attempts = B.list.map(function (q, i) { return { qid: q.id, topic: q.topic, correct: B.grades[i].content, mode: 'board' }; });
    BWC.Store.addAttempts(attempts);
    attempts.forEach(function (a) { u.S.attempts.push(Object.assign({ at: Date.now() }, a)); });
    u.award(entries).then(function () { location.hash = '#/board/results'; });
  }

  function check(ok, label) {
    return '<span class="chip ' + (ok ? 'good' : 'bad') + '">' + U().icon(ok ? 'check' : 'x', 14) + ' ' + label + '</span>';
  }

  function viewResults() {
    var u = U();
    if (!B || !B.done) { location.hash = '#/board'; return; }
    var right = B.grades.filter(function (g) { return g.content; }).length;
    var formatted = B.grades.filter(function (g) { return g.address && g.restate; }).length;
    app().innerHTML = u.header('Board results') +
      '<div class="banner"><div class="grow"><div class="eyebrow">' + (B.passed ? 'Passed' : 'Not yet') + '</div>' +
      '<div class="big">' + B.score + '%</div>' +
      '<div class="small" style="font-weight:700">' + right + ' of ' + B.list.length + ' right · format correct on ' + formatted + ' · +' + B.earned + ' points' +
      (B.scored ? '' : ' (practice board)') + '</div></div>' + u.icon('mic', 60, 1.8) + '</div>' +
      (B.report ? '<div class="card"><div class="row wrap">' + check(B.report.g.address, 'Address') + check(B.report.g.rank && B.report.g.name, 'Rank and name') +
        check(B.report.g.reports, 'Reported') + '</div><div class="small muted">Reporting in: "' + u.esc(B.report.text || '(nothing entered)') + '"</div></div>' : '') +
      B.list.map(function (q, i) {
        var g = B.grades[i];
        var seat = BC.seats[B.seats[i]];
        var title = seat.title === '1SG' ? 'First Sergeant' : 'Sergeant Major';
        var status = g.content ? 'Right' : g.partial ? 'Partly right' : 'Missed';
        return '<div class="card review ' + (g.content ? 'right' : 'wrong') + '">' +
          '<div class="row"><span class="chip ' + (g.content ? 'good' : g.partial ? '' : 'bad') + '">' + status + '</span>' +
          '<span class="muted small grow">' + u.esc(seat.title) + ' asked · ' + B.times[i] + 's' + (B.shown[i] && B.readAloud ? ' · read the text' : '') + '</span></div>' +
          '<div style="font-weight:700">' + u.esc(q.q) + '</div>' +
          '<div class="small">You said: "' + u.esc(B.answers[i] || '(no answer)') + '"</div>' +
          '<div class="row wrap">' + check(g.address, 'Addressed ' + title) + check(g.restate, 'Restated the question') +
          (g.fillers ? '<span class="chip">' + g.fillers + ' filler word' + (g.fillers === 1 ? '' : 's') + '</span>' : '') + '</div>' +
          (g.ai ? '<div class="small ai-note"><span class="chip">AI check: ' + u.esc(g.ai.verdict) + '</span> ' + u.esc(g.ai.reason) + '</div>' :
            (g.miss.length && !g.content ? '<div class="small">Missing: ' + u.esc(g.miss.join(', ')) + '</div>' : '')) +
          '<div><strong>Answer:</strong> ' + u.esc(q.answer) + '</div>' +
          '<div class="cite"><strong>' + u.esc(q.pub) + '</strong>' + (q.para ? ', para ' + u.esc(q.para) : '') + '</div>' +
          '<div class="row wrap">' + u.sourceLink(q.pub, q.page, 'Open at this page') +
          '<button type="button" class="btn small ghost" data-act="discuss" data-arg="' + u.esc(q.id) + '">' + u.icon('chat', 18) + 'Discuss</button>' +
          '<button type="button" class="btn small ghost" data-act="report" data-arg="' + u.esc(q.id) + '">' + u.icon('alert', 18) + 'Report an error</button></div></div>';
      }).join('') +
      (B.aiFailed ? '<p class="muted small">The AI check couldn\'t run for ' + B.aiFailed + ' answer' + (B.aiFailed === 1 ? '' : 's') + '; those were graded on key words only.</p>' : '') +
      '<p class="muted small">Answers are checked for key points, and answers in different words get an AI second opinion. If a correct answer was still marked wrong, use Report an error so a leader can fix it.</p>' +
      '<div class="row wrap"><a class="btn grow" href="#/board">Sit another board</a><a class="btn ghost grow" href="#/">Home</a></div>';
    if (!B.announced) {
      B.announced = true;
      say(B.passed ? 'That concludes your board. Well done.' : 'That concludes your board.', 2);
    }
  }

  function view(step) {
    if (step === 'report') return viewReport();
    if (step === 'q') return viewQuestion();
    if (step === 'results') return viewResults();
    return viewSetup();
  }

  BWC.Board = {
    view: view, stop: stop,
    // Shared with the creed trainer: dictate into a textarea with a toggle button.
    canListen: !!Rec, listen: startListening, stopListening: stopListening,
    isListening: function () { return !!rec; }
  };
})();
