// Audio flashcards: questions read aloud with a pause to answer in your head, then the
// answer and its source. Built for runs and rucks: big controls, screen kept awake.
// Routes: #/audio (setup), #/audio/play.
(function () {
  var C = window.BWC_CONFIG;
  var P = BWC.Progress;
  var synth = window.speechSynthesis;
  var canSpeak = !!synth && 'SpeechSynthesisUtterance' in window;

  var A = null;        // the session in progress
  var timer = null;    // pause between question and answer
  var guard = null;    // fallback if the browser never reports the end of speech
  var wake = null;     // screen wake lock
  var runId = 0;       // bumps on every stop/skip so stale callbacks do nothing

  function U() { return BWC.UI; }
  function app() { return document.getElementById('app'); }

  function voice() {
    var vs = canSpeak ? synth.getVoices().filter(function (v) { return /^en(-|_)/i.test(v.lang); }) : [];
    return vs.filter(function (v) { return /en-US/i.test(v.lang); })[0] || vs[0] || null;
  }

  // Speak text as short sentences (some browsers cut off long utterances), then call done.
  function speak(text, done) {
    var id = runId;
    if (!canSpeak) { setTimeout(function () { if (id === runId) done(); }, 1500); return; }
    var parts = String(text).match(/[^.!?;]+[.!?;]?/g) || [text];
    var i = 0;
    function next() {
      if (id !== runId) return;
      if (i >= parts.length) { done(); return; }
      var u = new SpeechSynthesisUtterance(parts[i++].trim());
      var v = voice();
      if (v) u.voice = v;
      u.rate = A ? A.rate : 1;
      // If the browser never fires onend, move on after an estimated reading time.
      var words = u.text.split(/\s+/).length;
      clearTimeout(guard);
      guard = setTimeout(function () { if (id === runId) next(); }, (words / 2.5 / (u.rate || 1)) * 1000 + 1500);
      u.onend = function () { clearTimeout(guard); if (id === runId) next(); };
      u.onerror = u.onend;
      synth.speak(u);
    }
    next();
  }

  function keepAwake(on) {
    try {
      if (on && 'wakeLock' in navigator && !wake) {
        navigator.wakeLock.request('screen').then(function (w) { wake = w; w.addEventListener('release', function () { wake = null; }); }).catch(function () {});
      }
      if (!on && wake) { wake.release(); wake = null; }
    } catch (e) { /* not supported */ }
  }

  function halt() {
    runId++;
    clearTimeout(timer);
    clearTimeout(guard);
    if (canSpeak) synth.cancel();
  }

  // Called on every screen change: silence and release the screen, but keep the session so
  // returning to the player picks up where it was.
  function stop() {
    halt();
    keepAwake(false);
  }

  // The screen can be locked by the phone; re-take the wake lock when the page returns.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && A && A.playing) keepAwake(true);
  });

  // ---------- setup ----------

  function viewSetup() {
    var u = U();
    var groups = [{ id: 'all', name: 'All topics' }].concat(C.groups)
      .concat(C.topics.map(function (t) { return { id: 't:' + t.id, name: '  ' + t.name }; }));
    var missedCount = missedQuestions().length;
    app().innerHTML = u.header('Audio flashcards', '#/study') +
      '<div class="banner"><div class="grow"><div class="eyebrow">For runs and rucks</div><div class="big" style="font-size:30px">Listen. Answer. Hear it.</div>' +
      '<p class="small" style="font-weight:700">Each question is read, you answer in your head, then you hear the answer and where it comes from.</p></div>' + u.icon('mic', 56, 1.8) + '</div>' +
      (canSpeak ? '' : '<div class="card attention"><p>This browser can\'t read aloud. Try Chrome or Safari.</p></div>') +
      '<form class="card" id="au-form">' +
      '<label class="field">What to hear<select class="input" id="au-src">' +
      (missedCount ? '<option value="missed">Questions I missed (' + missedCount + ')</option>' : '') +
      groups.map(function (g) { return '<option value="' + g.id + '">' + u.esc(g.name) + '</option>'; }).join('') + '</select></label>' +
      '<div class="row wrap"><label class="field grow">How many<select class="input" id="au-n"><option>10</option><option selected>20</option><option>40</option><option value="0">Keep going</option></select></label>' +
      '<label class="field grow">Time to answer<select class="input" id="au-pause"><option value="3">3 seconds</option><option value="5" selected>5 seconds</option><option value="8">8 seconds</option><option value="12">12 seconds</option></select></label></div>' +
      '<div class="row wrap"><label class="field grow">Speed<select class="input" id="au-rate"><option value="0.85">Slower</option><option value="1" selected>Normal</option><option value="1.15">Faster</option></select></label>' +
      '<label class="row small grow"><input type="checkbox" id="au-cite" checked> Read the source after each answer</label></div>' +
      '<label class="row small"><input type="checkbox" id="au-learned"> Include questions I marked as learned</label>' +
      '<button class="btn" type="submit"' + (canSpeak ? '' : ' disabled') + '>' + u.icon('mic', 20) + 'Start listening</button>' +
      '<p class="muted small">Use headphones. The app keeps your screen on while playing; turn the brightness down. ' +
      'If you lock the phone, most browsers stop speaking until you come back.</p></form>';

    document.getElementById('au-form').addEventListener('submit', function (e) {
      e.preventDefault();
      if (canSpeak) synth.speak(new SpeechSynthesisUtterance(' ')); // unlock speech on iPhone (needs a tap)
      var src = document.getElementById('au-src').value;
      var withLearned = document.getElementById('au-learned').checked;
      var pool = (window.BWC_QUESTIONS || []).filter(function (q) {
        if (!withLearned && u.S.learned[q.id]) return false;
        if (src === 'all') return true;
        if (src === 'missed') return missedQuestions().indexOf(q) >= 0;
        if (src.indexOf('t:') === 0) return q.topic === src.slice(2);
        var t = u.topicById(q.topic);
        return t && t.group === src;
      });
      if (!pool.length) { u.toast('No questions match. Try another choice or include learned questions.'); return; }
      var n = parseInt(document.getElementById('au-n').value, 10);
      A = {
        pool: pool, list: P.shuffle(pool), idx: 0, heard: 0,
        limit: n || 0,
        pause: parseInt(document.getElementById('au-pause').value, 10),
        rate: parseFloat(document.getElementById('au-rate').value),
        cite: document.getElementById('au-cite').checked,
        playing: true, phase: 'question', awarded: false
      };
      location.hash = '#/audio/play';
    });
  }

  function missedQuestions() {
    var h = P.history(U().S.attempts);
    return (window.BWC_QUESTIONS || []).filter(function (q) { return h[q.id] && h[q.id].last === false; });
  }

  // ---------- player ----------

  function current() {
    if (A.idx >= A.list.length) { A.list = A.list.concat(P.shuffle(A.pool)); }
    return A.list[A.idx];
  }

  function viewPlay() {
    if (!A) { location.hash = '#/audio'; return; }
    render();
    if (A.playing) playCard();
  }

  function render() {
    var u = U();
    var q = current();
    var total = A.limit || '∞';
    var learned = !!u.S.learned[q.id];
    var showAnswer = A.phase === 'answer';
    app().innerHTML = '<div class="row"><a class="btn small ghost" href="#/audio" aria-label="Back">' + u.icon('back', 18) + '</a>' +
      '<h1 class="grow">Card ' + (A.idx + 1) + ' of ' + total + '</h1></div>' +
      '<div class="card audio-card"><div class="muted small">' + u.esc((u.topicById(q.topic) || {}).name || '') + '</div>' +
      '<div class="qtext">' + u.esc(q.q) + '</div>' +
      '<div class="audio-answer' + (showAnswer ? '' : ' masked') + '" aria-hidden="' + !showAnswer + '"><strong>' + u.esc(q.answer) + '</strong>' +
      '<div class="cite">' + u.esc(q.pub) + (q.para ? ', para ' + u.esc(q.para) : '') + '</div></div>' +
      '<div class="audio-phase" id="au-phase">' + (A.playing ? (A.phase === 'question' ? 'Listen…' : A.phase === 'pause' ? 'Answer in your head…' : 'Answer') : 'Paused') + '</div></div>' +
      '<div class="audio-controls">' +
      '<button type="button" class="btn ghost audio-btn" id="au-prev" aria-label="Previous card">' + u.icon('back', 28) + '</button>' +
      '<button type="button" class="btn audio-btn big" id="au-toggle" aria-label="' + (A.playing ? 'Pause' : 'Play') + '">' + (A.playing ? pauseIcon() : playIcon()) + '</button>' +
      '<button type="button" class="btn ghost audio-btn" id="au-next" aria-label="Next card">' + u.icon('arrow', 28) + '</button></div>' +
      '<div class="row wrap"><button type="button" class="btn ghost grow" id="au-learn">' + u.icon('check', 18) + (learned ? 'Learned' : 'Mark learned') + '</button>' +
      '<button type="button" class="btn ghost grow" id="au-stop">Stop</button></div>' +
      '<p class="muted small">' + A.heard + ' heard this session.</p>';

    document.getElementById('au-toggle').addEventListener('click', function () {
      if (A.playing) { halt(); keepAwake(false); A.playing = false; render(); }
      else { A.playing = true; A.phase = 'question'; render(); playCard(); }
    });
    document.getElementById('au-next').addEventListener('click', function () { move(1); });
    document.getElementById('au-prev').addEventListener('click', function () { move(-1); });
    document.getElementById('au-stop').addEventListener('click', function () { finish(); });
    document.getElementById('au-learn').addEventListener('click', function () {
      var on = !u.S.learned[q.id];
      BWC.Store.setLearned(q.id, on).then(function () {
        if (on) u.S.learned[q.id] = true; else delete u.S.learned[q.id];
        u.toast(on ? 'Marked as learned' : 'Back in rotation');
        var b = document.getElementById('au-learn');
        if (b) b.innerHTML = u.icon('check', 18) + (on ? 'Learned' : 'Mark learned');
      });
    });
  }

  function playIcon() { return '<svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4l13 8-13 8z"></path></svg>'; }
  function pauseIcon() { return '<svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4h4v16H6z M14 4h4v16h-4z"></path></svg>'; }

  function setPhase(p) {
    A.phase = p;
    var el = document.getElementById('au-phase');
    if (el) el.textContent = p === 'question' ? 'Listen…' : p === 'pause' ? 'Answer in your head…' : 'Answer';
    var ans = document.querySelector('.audio-answer');
    if (ans) { ans.classList.toggle('masked', p !== 'answer'); ans.setAttribute('aria-hidden', p !== 'answer'); }
  }

  function playCard() {
    halt();
    keepAwake(true);
    var q = current();
    var id = runId;
    setPhase('question');
    speak('Question ' + (A.idx + 1) + '. ' + q.q, function () {
      setPhase('pause');
      timer = setTimeout(function () {
        if (id !== runId) return;
        setPhase('answer');
        var text = 'Answer: ' + q.answer + '.' + (A.cite ? ' Source: ' + q.pub.replace(/-/g, ' ') + (q.para ? ', paragraph ' + q.para.replace(/-/g, ' dash ') : '') + '.' : '');
        speak(text, function () {
          A.heard++;
          timer = setTimeout(function () { if (id === runId) move(1, true); }, 1200);
        });
      }, A.pause * 1000);
    });
  }

  function move(step, auto) {
    halt();
    A.idx = Math.max(0, A.idx + step);
    if (A.limit && A.idx >= A.limit) { finish(); return; }
    A.phase = 'question';
    render();
    if (A.playing || !auto) { A.playing = true; render(); playCard(); }
  }

  function finish() {
    var u = U();
    stop();
    var heard = A ? A.heard : 0;
    var award = A && !A.awarded && heard >= 5 ? P.readPoints(u.S.ledger, 'audio') : [];
    A = null; // session over; opening the player again goes back to setup
    u.award(award).then(function () {
      app().innerHTML = u.header('Session done', '#/study') +
        '<div class="banner"><div class="grow"><div class="eyebrow">Audio flashcards</div><div class="big">' + heard + ' heard</div>' +
        '<div class="small" style="font-weight:700">' + (award.length ? '+' + award[0].pts + ' point' : 'Hear at least 5 for a study point') + '</div></div>' + u.icon('mic', 56, 1.8) + '</div>' +
        '<div class="row wrap"><a class="btn grow" href="#/audio">Another session</a><a class="btn ghost grow" href="#/quiz/daily">Daily 10</a></div>';
    });
  }

  function view(step) {
    if (step === 'play') return viewPlay();
    stop();
    return viewSetup();
  }

  BWC.Audio = { view: view, stop: stop };
})();
