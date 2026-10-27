// Hands-on training: a log of time spent with real weapons and radios (verified by the sponsor),
// and step-by-step walkthroughs (function checks, SINCGARS operation) to follow with the real
// equipment in hand. Walkthrough steps come from walkthroughs-data.js, built and quote-checked by
// tools/build_questions.py.
// Routes: #/handson, #/handson/new[/<uid>], #/handson/guide/<id>.
(function () {
  var C = window.BWC_CONFIG;
  var H = C.handson;

  function U() { return BWC.UI; }
  function app() { return document.getElementById('app'); }
  function guides() { return (window.BWC_WALKTHROUGHS || {}).walkthroughs || []; }
  function equipName(id) { return (H.equipment.filter(function (e) { return e.id === id; })[0] || { name: id }).name; }
  function equipKind(id) { return (H.equipment.filter(function (e) { return e.id === id; })[0] || { kind: 'weapon' }).kind; }
  function today() { return BWC.Progress.today(); }
  function pts(minutes) { return Math.min(H.maxPerSession, Math.floor((minutes || 0) / H.perMinutes)); }
  function hours(min) { return Math.round(min / 6) / 10; }

  function statusChip(h) {
    return h.review === 'verified' ? '<span class="chip good">Verified</span>' : h.review === 'flagged' ? '<span class="chip bad">Flagged</span>' : '<span class="chip">Waiting for sponsor</span>';
  }

  // Points for verified sessions not yet credited. Runs on Home and the hands-on page.
  function awardVerified() {
    var u = U();
    if (!u || !u.S.user || !u.S.handson) return;
    var entries = u.S.handson.filter(function (h) {
      return h.review === 'verified' && pts(h.minutes) > 0 && !u.S.ledger.some(function (e) { return e.ref === 'handson:' + h.id; });
    }).map(function (h) { return { kind: 'handson', pts: pts(h.minutes), ref: 'handson:' + h.id }; });
    if (!entries.length) return;
    u.award(entries).then(function () {
      u.toast('Your sponsor verified ' + entries.length + ' hands-on session' + (entries.length === 1 ? '' : 's') + ': +' + entries.reduce(function (s, e) { return s + e.pts; }, 0) + ' points');
    });
  }

  // ---------- hub ----------

  function viewHub() {
    var u = U();
    var list = (u.S.handson || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var verifiedMin = list.filter(function (h) { return h.review === 'verified'; }).reduce(function (s, h) { return s + h.minutes; }, 0);
    var waiting = list.filter(function (h) { return !h.review; }).length;
    var G = guides();
    app().innerHTML = u.header('Hands-on training', '#/activities') +
      '<div class="banner"><div class="grow"><div class="eyebrow">Verified hands-on time</div><div class="big">' + hours(verifiedMin) + ' HRS</div>' +
      '<div class="small" style="font-weight:700">' + list.length + ' session' + (list.length === 1 ? '' : 's') + ' logged' + (waiting ? ' · ' + waiting + ' waiting for your sponsor' : '') + '</div></div>' + u.icon('target', 56, 1.8) + '</div>' +
      '<a class="btn" href="#/handson/new">' + u.icon('clipboard', 18) + 'Log a session</a>' +
      '<div class="card"><h2>Step-by-step walkthroughs</h2><p class="muted small">Follow along with the real weapon or radio. Clear the weapon first.</p>' +
      (G.length ? '<div class="list">' + G.map(function (g) {
        return '<a class="list-row" href="#/handson/guide/' + g.id + '"><span class="chip">' + u.esc(g.equipment) + '</span><span class="grow"><strong>' + u.esc(g.title) + '</strong><br><span class="muted small">' + g.steps.length + ' steps · ' + u.esc(g.pub) + '</span></span>' + u.icon('arrow', 18) + '</a>';
      }).join('') + '</div>' : '<p class="muted">Walkthroughs are being added.</p>') +
      '<p class="muted small">M17 and M249 function checks and full SINCGARS programming will be added when their technical manuals are in the source package.</p></div>' +
      '<div class="card"><h2>Your sessions</h2>' + (list.length ? '<div class="list">' + list.slice(0, 20).map(function (h) {
        return '<div class="list-row" style="flex-wrap:wrap"><div class="grow"><strong>' + u.esc(equipName(h.equipment)) + '</strong> · ' + h.minutes + ' min<div class="muted small">' + u.esc(h.date) +
          (h.tasks && h.tasks.length ? ' · ' + u.esc(h.tasks.join(', ')) : '') + (h.supervisor ? ' · with ' + u.esc(h.supervisor) : '') + '</div></div>' + statusChip(h) + '</div>';
      }).join('') + '</div>' : '<p class="muted">No sessions yet. Log time spent with real weapons or radios; your sponsor verifies it.</p>') +
      '<p class="muted small">1 point per ' + H.perMinutes + ' verified minutes, up to ' + H.maxPerSession + ' per session.</p></div>';
    awardVerified();
  }

  // ---------- log a session (yourself, or a sponsor for their competitor) ----------

  function viewNew(forUid) {
    var u = U();
    var params = {};
    (location.hash.split('?')[1] || '').split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) params[p[0]] = decodeURIComponent(p[1] || ''); });
    var forOther = forUid && forUid !== u.S.user.uid;
    var who = Promise.resolve(null);
    if (forOther) who = BWC.Store.competitors().then(function (people) { return people.filter(function (p) { return p.uid === forUid; })[0] || null; });
    who.then(function (person) {
      if (forOther && !person) { app().innerHTML = u.header('Log hands-on training', '#/team') + '<div class="card"><p>This Soldier is not in your list.</p></div>'; return; }
      var eq = params.equip || H.equipment[0].id;
      app().innerHTML = u.header(forOther ? 'Log training for ' + u.displayName(person) : 'Log a hands-on session', forOther ? '#/team/' + encodeURIComponent(forUid) : '#/handson') +
        (forOther ? '<div class="card"><p class="small">You are logging this as the supervisor, so it is recorded as <strong>verified</strong>.</p></div>' : '') +
        '<form class="card" id="ho-form">' +
        '<label class="field">Equipment<select class="input" id="ho-eq">' + H.equipment.map(function (e) {
          return '<option value="' + e.id + '"' + (e.id === eq ? ' selected' : '') + '>' + u.esc(e.name) + '</option>';
        }).join('') + '</select></label>' +
        '<fieldset class="field" id="ho-tasks"><legend>What was practiced</legend></fieldset>' +
        '<div class="row wrap"><label class="field grow">Date<input class="input" type="date" id="ho-date" value="' + today() + '" max="' + today() + '"></label>' +
        '<label class="field grow">Minutes<input class="input" type="number" id="ho-min" min="1" max="600" inputmode="numeric" required value="' + u.esc(params.min || '') + '"></label></div>' +
        '<label class="field">Supervised by<input class="input" id="ho-sup" maxlength="60" placeholder="e.g. SSG Lee (sponsor)" value="' + u.esc(forOther ? u.displayName(u.S.user) : '') + '"></label>' +
        '<label class="field">Notes (optional)<input class="input" id="ho-notes" maxlength="160"></label>' +
        '<p class="muted small">No serial numbers, locations or other sensitive details.</p>' +
        '<button class="btn" type="submit">Save session</button></form>';
      var renderTasks = function () {
        var kind = equipKind(document.getElementById('ho-eq').value);
        document.getElementById('ho-tasks').innerHTML = '<legend>What was practiced</legend>' + H.tasks[kind].map(function (t, i) {
          return '<label class="row small"><input type="checkbox" value="' + u.esc(t) + '"' + (params.task === t ? ' checked' : '') + '> ' + u.esc(t) + '</label>';
        }).join('');
      };
      renderTasks();
      document.getElementById('ho-eq').addEventListener('change', renderTasks);
      document.getElementById('ho-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var minutes = parseInt(document.getElementById('ho-min').value, 10);
        if (!minutes || minutes < 1) { u.toast('Enter how many minutes.'); return; }
        var rec = {
          equipment: document.getElementById('ho-eq').value,
          tasks: [].slice.call(document.querySelectorAll('#ho-tasks input:checked')).map(function (c) { return c.value; }),
          date: document.getElementById('ho-date').value, minutes: minutes,
          supervisor: document.getElementById('ho-sup').value.trim(), notes: document.getElementById('ho-notes').value.trim(),
          loggedBy: u.S.user.uid, review: forOther ? 'verified' : null
        };
        if (forOther) rec.reviewedBy = u.S.user.uid;
        var btn = this.querySelector('button[type=submit]');
        btn.disabled = true;
        BWC.Store.addHandson(forOther ? forUid : u.S.user.uid, rec).then(function (saved) {
          if (!forOther) { (u.S.handson = u.S.handson || []).push(saved); u.toast('Saved. Your sponsor will verify it.'); location.hash = '#/handson'; }
          else { u.toast('Logged and verified for ' + u.displayName(person)); location.hash = '#/team/' + encodeURIComponent(forUid); }
        }).catch(function () { btn.disabled = false; u.toast('Could not save. Only the Soldier, their sponsor or a leader can log this.'); });
      });
    });
  }

  // ---------- walkthrough player ----------

  function viewGuide(id) {
    var u = U();
    var g = guides().filter(function (x) { return x.id === id; })[0];
    if (!g) { location.hash = '#/handson'; return; }
    var i = -1; // -1 = intro
    var aloud = false;
    var started = Date.now();
    function say(text) { if (aloud) BWC.Speech.speak(text, { rate: 0.95 }); }
    function render() {
      if (i < 0) {
        app().innerHTML = u.header(g.title, '#/handson') +
          '<div class="card"><div class="row"><span class="chip">' + u.esc(g.equipment) + '</span></div><p>' + u.esc(g.intro || '') + '</p>' +
          '<div class="callout-warn small"><strong>Safety:</strong> clear the weapon and confirm no ammunition is present before you begin. Follow your range and unit SOP.</div>' +
          '<label class="row small"><input type="checkbox" id="gd-aloud"> Read each step aloud</label>' +
          BWC.Drills.cite(g) + '<button type="button" class="btn" id="gd-start">Start: ' + g.steps.length + ' steps</button></div>';
        document.getElementById('gd-start').addEventListener('click', function () {
          aloud = document.getElementById('gd-aloud').checked;
          if (aloud) BWC.Speech.unlock();
          i = 0; started = Date.now(); render();
        });
        return;
      }
      if (i >= g.steps.length) {
        var mins = Math.max(5, Math.round((Date.now() - started) / 60000 / 5) * 5);
        var task = g.kind === 'radio' ? (/hop/i.test(g.title) ? 'Frequency hop operation' : 'Set up and operate (single channel)') : 'Function check';
        app().innerHTML = u.header(g.title, '#/handson') +
          '<div class="banner"><div class="grow"><div class="eyebrow">Walkthrough complete</div><div class="big">' + g.steps.length + ' STEPS</div></div>' + u.icon('check', 56, 2) + '</div>' +
          '<a class="btn" href="#/handson/new?equip=' + encodeURIComponent(g.equipment) + '&task=' + encodeURIComponent(task) + '&min=' + mins + '">Log this session</a>' +
          '<button type="button" class="btn ghost" id="gd-again">Run it again</button>';
        document.getElementById('gd-again').addEventListener('click', function () { i = 0; started = Date.now(); render(); });
        say('Walkthrough complete.');
        return;
      }
      var s = g.steps[i];
      app().innerHTML = '<div class="row"><a class="btn small ghost" href="#/handson" aria-label="Back to hands-on">' + u.icon('back', 18) + '</a><h1 class="grow">' + u.esc(g.title) + '</h1></div>' +
        '<div class="progress-dots" aria-hidden="true">' + g.steps.map(function (_, k) { return '<span class="' + (k <= i ? 'done' : '') + '"></span>'; }).join('') + '</div>' +
        '<div class="card guide-step"><div class="eyebrow">Step ' + (i + 1) + ' of ' + g.steps.length + '</div>' +
        '<div class="guide-do">' + u.esc(s.do) + '</div>' +
        (s.expect ? '<div class="guide-expect"><span class="eyebrow">Expect</span> ' + u.esc(s.expect) + '</div>' : '') + '</div>' +
        '<div class="audio-controls"><button type="button" class="btn ghost audio-btn" id="gd-prev" aria-label="Previous step"' + (i === 0 ? ' disabled' : '') + '>' + u.icon('back', 28) + '</button>' +
        '<button type="button" class="btn ghost audio-btn" id="gd-say" aria-label="Read this step aloud">' + u.icon('mic', 28) + '</button>' +
        '<button type="button" class="btn audio-btn" id="gd-next" aria-label="Next step">' + u.icon('arrow', 28) + '</button></div>';
      document.getElementById('gd-prev').addEventListener('click', function () { if (i > 0) { i--; render(); } });
      document.getElementById('gd-next').addEventListener('click', function () { i++; render(); });
      document.getElementById('gd-say').addEventListener('click', function () { BWC.Speech.speak(s.do + (s.expect ? '. Expect: ' + s.expect : ''), { rate: 0.95 }); });
      say(s.do + (s.expect ? '. Expect: ' + s.expect : ''));
    }
    render();
  }

  function view(step, arg) {
    if (step === 'new') return viewNew(arg && decodeURIComponent(arg.split('?')[0]));
    if (step === 'guide') return viewGuide(arg);
    return viewHub();
  }

  BWC.HandsOn = { view: view, awardVerified: awardVerified, statusChip: statusChip, equipName: equipName, hours: hours };
})();
