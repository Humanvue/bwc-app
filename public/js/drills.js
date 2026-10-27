// Weapons and WTBD drills: put steps in order (clearing, disassembly, MARCH...), match report
// formats (9-line MEDEVAC, SALUTE...), and zeroing. Content comes from drills-data.js, built from
// content/raw/drills.json by tools/build_questions.py, which checks every quote against its page.
// Routes: #/drills, #/drills/seq/<id>, #/drills/fmt/<id>, #/drills/zero.
(function () {
  var P = BWC.Progress;
  var PTS = { go: 3, dailyCap: 30 };

  function U() { return BWC.UI; }
  function app() { return document.getElementById('app'); }
  function data() { return window.BWC_DRILLS || { sequences: [], formats: [], zero: { facts: [] } }; }
  function toDay(ms) { var d = new Date(ms || Date.now()); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  function earnedToday() {
    var t = P.today();
    return U().S.ledger.filter(function (e) { return e.kind === 'drill' && toDay(e.at) === t; }).reduce(function (s, e) { return s + e.pts; }, 0);
  }
  function record(ref, ok) {
    var pts = ok && earnedToday() + PTS.go <= PTS.dailyCap ? PTS.go : 0;
    return U().award([{ kind: 'drill', pts: pts, ref: ref, ok: ok }]).then(function () { return pts; });
  }
  function stats(ref) {
    var l = U().S.ledger.filter(function (e) { return e.kind === 'drill' && e.ref === ref; });
    return { n: l.length, ok: l.filter(function (e) { return e.ok; }).length };
  }

  function cite(d) {
    var u = U();
    return '<div class="cite"><strong>' + u.esc(d.pub) + '</strong>' + (d.para ? ', para ' + u.esc(d.para) : '') + '</div>' +
      '<div class="row wrap">' + u.sourceLink(d.pub, d.page, 'Open at this page') + '</div>';
  }

  // ---------- menu ----------

  function viewMenu(group) {
    var u = U();
    var D = data();
    function card(href, title, ref, sub) {
      var s = stats(ref);
      return '<a class="card roster-card" href="' + href + '"><div class="row"><h3 class="grow">' + u.esc(title) + '</h3>' +
        (s.n ? '<span class="chip' + (s.ok ? ' good' : '') + '">' + s.ok + '/' + s.n + ' GO</span>' : '') + '</div>' +
        (sub ? '<p class="muted small">' + u.esc(sub) + '</p>' : '') + '</a>';
    }
    function section(id, name) {
      var seq = D.sequences.filter(function (d) { return d.group === id; });
      var fmt = D.formats.filter(function (d) { return d.group === id; });
      var zero = id === 'weapons' && D.zero && D.zero.facts && D.zero.facts.length >= 2;
      if (!seq.length && !fmt.length && !zero) return '';
      return '<section class="stack" id="' + id + '"><h2>' + u.esc(name) + '</h2>' +
        seq.map(function (d) { return card('#/drills/seq/' + d.id, d.title, d.id, d.steps.length + ' steps · put them in order'); }).join('') +
        fmt.map(function (d) { return card('#/drills/fmt/' + d.id, d.title, d.id, d.items.length + ' parts · match each one'); }).join('') +
        (zero ? card('#/drills/zero', '25 m zero adjustments', 'zero', 'Read a shot group and give the sight corrections') : '') + '</section>';
    }
    var body = section('weapons', 'Weapons') + section('wtbd', 'Warrior tasks and battle drills');
    app().innerHTML = u.header('Weapons and WTBD drills', '#/activities') +
      '<p class="muted">Hands-on practice from the TCs and the Soldier\'s Manual of Common Tasks. ' + PTS.go + ' points per GO, up to ' + PTS.dailyCap + ' drill points a day.</p>' +
      (body || '<div class="card"><p class="muted">Drills are being added.</p></div>');
    if (group) { var el = document.getElementById(group); if (el) el.scrollIntoView(); }
  }

  // ---------- put the steps in order ----------

  function viewSequence(id) {
    var u = U();
    var d = data().sequences.filter(function (x) { return x.id === id; })[0];
    if (!d) { location.hash = '#/drills'; return; }
    var pool = P.shuffle(d.steps.map(function (s, i) { return { text: s, i: i }; }));
    // Make sure the shuffle isn't already the right order.
    if (pool.every(function (p, k) { return p.i === k; }) && pool.length > 1) pool.reverse();
    var picked = [];
    var checked = false;

    function render() {
      app().innerHTML = '<div class="row"><a class="btn small ghost" href="#/drills#' + d.group + '" aria-label="Back">' + u.icon('back', 18) + '</a><h1 class="grow">' + u.esc(d.title) + '</h1></div>' +
        '<p class="muted">' + u.esc(d.prompt || 'Put the steps in order.') + ' Tap a step to add it; tap it again to take it back.</p>' +
        '<div class="card"><h3>Your order</h3><ol class="seq-list">' + (picked.length ? picked.map(function (p, k) {
          var cls = checked ? (p.i === k ? ' ok' : ' bad') : '';
          return '<li><button type="button" class="seq-step' + cls + '" data-back="' + k + '"' + (checked ? ' disabled' : '') + '>' + u.esc(p.text) + '</button></li>';
        }).join('') : '<li class="muted small">Nothing yet.</li>') + '</ol></div>' +
        (pool.length ? '<div class="card"><h3>Steps</h3><div class="stack">' + pool.map(function (p, k) {
          return '<button type="button" class="seq-step pool" data-pick="' + k + '">' + u.esc(p.text) + '</button>';
        }).join('') + '</div></div>' : '') +
        (!checked ? '<button type="button" class="btn block" id="sq-check"' + (pool.length ? ' disabled' : '') + '>Check my order</button>' : '') +
        '<div id="sq-result"></div>';
      app().querySelectorAll('[data-pick]').forEach(function (b) {
        b.addEventListener('click', function () { picked.push(pool.splice(+b.getAttribute('data-pick'), 1)[0]); render(); });
      });
      app().querySelectorAll('[data-back]').forEach(function (b) {
        b.addEventListener('click', function () { pool.push(picked.splice(+b.getAttribute('data-back'), 1)[0]); render(); });
      });
      var chk = document.getElementById('sq-check');
      if (chk) chk.addEventListener('click', function () {
        checked = true;
        var right = picked.filter(function (p, k) { return p.i === k; }).length;
        var ok = right === picked.length;
        render();
        record(d.id, ok).then(function (pts) {
          document.getElementById('sq-result').innerHTML = '<div class="card ' + (ok ? 'pass' : '') + '"><div class="row"><h2 class="grow">' + (ok ? 'GO' : 'NO-GO') + '</h2>' +
            '<span class="chip ' + (ok ? 'good' : 'bad') + '">' + right + '/' + picked.length + ' in place</span></div>' +
            (ok ? '' : '<h3>Correct order</h3><ol class="seq-answer">' + d.steps.map(function (s) { return '<li>' + u.esc(s) + '</li>'; }).join('') + '</ol>') +
            (d.quote ? '<div class="quote">"' + u.esc(d.quote) + '"</div>' : '') + cite(d) +
            (pts ? '<p class="small">+' + pts + ' points</p>' : '') +
            '<button type="button" class="btn" id="sq-again">Again</button></div>';
          document.getElementById('sq-again').addEventListener('click', function () { viewSequence(id); });
        });
      });
    }
    render();
  }

  // ---------- match the format ----------

  function viewFormat(id) {
    var u = U();
    var d = data().formats.filter(function (x) { return x.id === id; })[0];
    if (!d) { location.hash = '#/drills'; return; }
    var names = P.shuffle(d.items.map(function (it) { return it.name; }));
    app().innerHTML = '<div class="row"><a class="btn small ghost" href="#/drills#' + d.group + '" aria-label="Back">' + u.icon('back', 18) + '</a><h1 class="grow">' + u.esc(d.title) + '</h1></div>' +
      '<p class="muted">Match each part to what goes on it.</p>' +
      '<form class="card" id="fm-form">' + d.items.map(function (it, k) {
        return '<label class="field fm-row"><span class="fm-key">' + u.esc(it.key) + '</span><select class="input" data-k="' + k + '"><option value="">Choose…</option>' +
          names.map(function (n) { return '<option>' + u.esc(n) + '</option>'; }).join('') + '</select></label>';
      }).join('') + '<button class="btn" type="submit">Check</button></form><div id="fm-result"></div>';
    document.getElementById('fm-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var sels = app().querySelectorAll('select[data-k]');
      var right = 0;
      sels.forEach(function (s) {
        var it = d.items[+s.getAttribute('data-k')];
        var ok = s.value === it.name;
        if (ok) right++;
        s.classList.toggle('fm-ok', ok);
        s.classList.toggle('fm-bad', !ok);
      });
      var ok = right === d.items.length;
      this.querySelector('button[type=submit]').disabled = true;
      record(d.id, ok).then(function (pts) {
        document.getElementById('fm-result').innerHTML = '<div class="card ' + (ok ? 'pass' : '') + '"><div class="row"><h2 class="grow">' + (ok ? 'GO' : 'NO-GO') + '</h2>' +
          '<span class="chip ' + (ok ? 'good' : 'bad') + '">' + right + '/' + d.items.length + '</span></div>' +
          '<div class="list">' + d.items.map(function (it) {
            return '<div class="list-row" style="flex-wrap:wrap;align-items:flex-start"><span class="fm-key">' + u.esc(it.key) + '</span><div class="grow"><strong>' + u.esc(it.name) + '</strong>' +
              (it.detail ? '<div class="small muted">' + u.esc(it.detail) + '</div>' : '') +
              (it.codes && it.codes.length ? '<div class="small">' + it.codes.map(u.esc).join(' · ') + '</div>' : '') + '</div></div>';
          }).join('') + '</div>' + (d.quote ? '<div class="quote">"' + u.esc(d.quote) + '"</div>' : '') + cite(d) +
          (pts ? '<p class="small">+' + pts + ' points</p>' : '') + '<button type="button" class="btn" id="fm-again">Again</button></div>';
        document.getElementById('fm-again').addEventListener('click', function () { viewFormat(id); });
      });
    });
  }

  function view(kind, id) {
    if (kind === 'seq') return viewSequence(id);
    if (kind === 'fmt') return viewFormat(id);
    if (kind === 'zero' && BWC.Zero) return BWC.Zero.view();
    return viewMenu(location.hash.split('#')[2]);
  }

  BWC.Drills = { view: view, record: record, cite: cite };
})();
