// Creed trainer: learn the Soldier's Creed, NCO Creed and Army Values word for word.
// Each level hides more words (0%, 25%, 50%, 75%, all); the Soldier recites by typing
// or speaking, and the app checks every word against the official text.
// Routes: #/creeds (list), #/creed/<id>[/<section>].
(function () {
  // Official texts. Source: FM 1 (1 May 2025), Appendix D; ADP 6-22 para 1-71.
  var CREEDS = [
    {
      id: 'soldiers-creed', name: "Soldier's Creed", pub: 'FM 1', para: 'Appendix D', page: 97,
      sections: [{ name: 'Whole creed', text: [
        'I am an American Soldier.',
        'I am a warrior and a member of a team.',
        'I serve the people of the United States and live the Army Values.',
        'I will always place the mission first.',
        'I will never accept defeat.',
        'I will never quit.',
        'I will never leave a fallen comrade.',
        'I am disciplined, physically and mentally tough, trained and proficient in my warrior tasks and drills.',
        'I always maintain my arms, my equipment and myself.',
        'I am an expert and I am a professional.',
        'I stand ready to deploy, engage, and destroy, the enemies of the United States of America in close combat.',
        'I am a guardian of freedom and the American way of life.',
        'I am an American Soldier.'
      ].join('\n') }]
    },
    {
      id: 'warrior-ethos', name: 'Warrior Ethos', pub: 'FM 1', para: 'Appendix D (Soldier\'s Creed)', page: 97,
      sections: [{ name: 'Warrior Ethos', text: [
        'I will always place the mission first.',
        'I will never accept defeat.',
        'I will never quit.',
        'I will never leave a fallen comrade.'
      ].join('\n') }]
    },
    {
      id: 'nco-creed', name: 'NCO Creed', pub: 'FM 1', para: 'Appendix D', page: 98,
      sections: [
        { name: 'Paragraph 1', text: 'No one is more professional than I. I am a noncommissioned officer, a leader of Soldiers. As a noncommissioned officer, I realize that I am a member of a time-honored corps, which is known as "The Backbone of the Army". I am proud of the Corps of Noncommissioned Officers and will at all times conduct myself so as to bring credit upon the Corps, the military service and my country regardless of the situation in which I find myself. I will not use my grade or position to attain pleasure, profit, or personal safety.' },
        { name: 'Paragraph 2', text: 'Competence is my watchword. My two basic responsibilities will always be uppermost in my mind—accomplishment of my mission and the welfare of my Soldiers. I will strive to remain technically and tactically proficient. I am aware of my role as a noncommissioned officer. I will fulfill my responsibilities inherent in that role. All Soldiers are entitled to outstanding leadership; I will provide that leadership. I know my Soldiers and I will always place their needs above my own. I will communicate consistently with my Soldiers and never leave them uninformed. I will be fair and impartial when recommending both rewards and punishment.' },
        { name: 'Paragraph 3', text: 'Officers of my unit will have maximum time to accomplish their duties; they will not have to accomplish mine. I will earn their respect and confidence as well as that of my Soldiers. I will be loyal to those with whom I serve; seniors, peers, and subordinates alike. I will exercise initiative by taking appropriate action in the absence of orders. I will not compromise my integrity, nor my moral courage. I will not forget, nor will I allow my comrades to forget that we are professionals, noncommissioned officers, leaders!' }
      ]
    },
    {
      id: 'army-values', name: 'Army Values', pub: 'ADP 6-22', para: '1-71', page: 28,
      sections: [{ name: 'All seven', text: [
        'Loyalty: bear true faith and allegiance to the Constitution of the United States, the Army, your unit and other Soldiers.',
        'Duty: fulfill your obligations.',
        'Respect: treat people as they should be treated.',
        'Selfless service: put the welfare of the nation, the Army, and your subordinates before your own.',
        'Honor: live up to the Army Values.',
        'Integrity: do what is right, legally and morally.',
        'Personal courage: face fear, danger, or adversity.'
      ].join('\n') }]
    }
  ];
  // General Orders exactly as printed in TRADOC Pamphlet 600-4 (C1, 27 Oct 2014), para 10-4.
  CREEDS.push({
    id: 'general-orders', name: 'General Orders', pub: 'TP 600-4', para: '10-4 (C1, 27 Oct 2014)', page: 176,
    sections: [{ name: 'All three', text: [
      'I will guard everything within the limits of my post and quit my post only when properly relieved.',
      'I will obey my special orders and perform all my duties in a military manner.',
      'I will report violations on my special orders, emergencies, and anything not covered in my instructions to the commander of relief.'
    ].join('\n') }]
  });
  // The NCO Creed is also practiced whole once each paragraph is down.
  CREEDS[2].sections.push({ name: 'Whole creed', text: CREEDS[2].sections.map(function (s) { return s.text; }).join('\n\n') });

  var LEVELS = [
    { name: 'Read it', hide: 0, pts: 0 },
    { name: 'Level 1', hide: 0.25, pts: 2 },
    { name: 'Level 2', hide: 0.5, pts: 3 },
    { name: 'Level 3', hide: 0.75, pts: 5 },
    { name: 'From memory', hide: 1, pts: 10 }
  ];
  // 97%: allows a stray word or two (speech recognition slips) but a skipped line fails.
  var PASS = 0.97;

  // ---------- word matching (pure, tested in tools/test_creeds.js) ----------

  function tokens(text) {
    return String(text || '').toLowerCase()
      .replace(/[‘’]/g, "'").replace(/[—–-]/g, ' ')
      .replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
  }

  // Which expected words were said, in order (longest common subsequence), so one
  // skipped or extra word doesn't throw off the rest of the check.
  function align(expected, said) {
    var n = expected.length, m = said.length;
    var dp = [];
    for (var i = 0; i <= n; i++) { dp.push(new Array(m + 1).fill(0)); }
    for (i = n - 1; i >= 0; i--) {
      for (var j = m - 1; j >= 0; j--) {
        dp[i][j] = expected[i] === said[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    var hit = new Array(n).fill(false);
    i = 0; j = 0;
    while (i < n && j < m) {
      if (expected[i] === said[j]) { hit[i] = true; i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
      else j++;
    }
    return hit;
  }

  function check(text, said) {
    var exp = tokens(text);
    var hit = align(exp, tokens(said));
    var right = hit.filter(Boolean).length;
    return { words: exp, hit: hit, right: right, total: exp.length, score: exp.length ? right / exp.length : 0 };
  }

  // Deterministic word hiding: a word hidden at one level stays hidden at harder levels.
  function hiddenAt(index, fraction) {
    if (fraction >= 1) return true;
    if (fraction <= 0) return false;
    var h = Math.sin((index + 1) * 12.9898) * 43758.5453;
    return (h - Math.floor(h)) < fraction;
  }

  var api = { CREEDS: CREEDS, LEVELS: LEVELS, PASS: PASS, tokens: tokens, align: align, check: check, hiddenAt: hiddenAt };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  // ---------- screens ----------

  function U() { return BWC.UI; }
  function app() { return document.getElementById('app'); }

  // Run fn on each word of raw text (hyphenated words count as one) and escape everything,
  // so apostrophes and quotes never get split into extra "words". Lines become <br>.
  var WORD = /[A-Za-z0-9’']+(?:[—–-][A-Za-z0-9’']+)*/g;
  function mapWords(text, fn) {
    var esc = U().esc;
    return String(text).split('\n').map(function (line) {
      var out = '', last = 0, m;
      WORD.lastIndex = 0;
      while ((m = WORD.exec(line))) {
        out += esc(line.slice(last, m.index)) + fn(m[0]);
        last = m.index + m[0].length;
      }
      return out + esc(line.slice(last));
    }).join('<br>');
  }

  // Texts admins add (e.g. the Army Song) become trainer entries like the built-in creeds.
  function customCreeds() {
    return (U().S.customTexts || []).map(function (x) {
      return { id: 'custom-' + x.id, textId: x.id, custom: true, name: x.name, pub: x.source || 'Added by an admin', para: '', sections: [{ name: 'Whole text', text: x.text }] };
    });
  }
  function allCreeds() { return CREEDS.concat(customCreeds()); }
  function loadCustom() {
    return BWC.Store.texts().then(function (list) { U().S.customTexts = list; }).catch(function () { U().S.customTexts = U().S.customTexts || []; });
  }
  function creedById(id) { return allCreeds().filter(function (c) { return c.id === id; })[0]; }
  function isAdmin() { return U().S.user.role === 'admin'; }
  function key(c, si, lvl) { return c.id + ':' + si + ':' + lvl; }

  function bestLevel(c, si) {
    var best = 0;
    U().S.ledger.forEach(function (e) {
      if (e.kind !== 'creed' || !e.ref) return;
      var p = e.ref.split(':');
      if (p[0] === c.id && +p[1] === si) best = Math.max(best, +p[2]);
    });
    return best;
  }

  function viewList() {
    var u = U();
    app().innerHTML = u.header('Creeds', '#/study') + '<div class="card"><p class="muted">Loading…</p></div>';
    loadCustom().then(renderList);
  }

  function renderList() {
    var u = U();
    var custom = customCreeds();
    app().innerHTML = u.header('Creeds', '#/study') +
      '<p class="muted">Boards expect these word for word. Each level hides more words until you recite it from memory, typed or out loud.</p>' +
      '<div class="tiles">' + allCreeds().map(function (c) {
        var done = c.sections.filter(function (s, i) { return bestLevel(c, i) >= 4; }).length;
        var pct = Math.round(c.sections.reduce(function (s, x, i) { return s + bestLevel(c, i); }, 0) / (c.sections.length * 4) * 100);
        return '<a class="tile" href="#/creed/' + c.id + '">' + u.icon('flag', 26, 2.2) + '<span class="name">' + u.esc(c.name) + '</span>' +
          '<span class="stat">' + (done === c.sections.length ? 'Mastered' : pct + '% learned') + '</span><span class="tbar"><span style="width:' + pct + '%"></span></span></a>';
      }).join('') + '</div>' +
      (isAdmin() ? adminTexts(custom) : (custom.length ? '' : '<p class="muted small">Admins can add more texts here, such as the Army Song.</p>'));
    wireAdmin();
  }

  // Admin: add, edit or remove texts. Copy them exactly from an official source and name it.
  function adminTexts(custom) {
    var u = U();
    return '<div class="card"><h2>Texts you added</h2>' +
      (custom.length ? '<div class="list">' + custom.map(function (c) {
        return '<div class="list-row"><span class="grow"><strong>' + u.esc(c.name) + '</strong><span class="muted small"> · ' + u.esc(c.pub) + '</span></span>' +
          '<button type="button" class="btn small ghost" data-edit-text="' + u.esc(c.textId) + '">Edit</button>' +
          '<button type="button" class="btn small ghost" data-del-text="' + u.esc(c.textId) + '">Remove</button></div>';
      }).join('') + '</div>' : '<p class="muted small">None yet.</p>') +
      '<form class="stack" id="tx-form"><h3 id="tx-heading">Add a text</h3>' +
      '<input type="hidden" id="tx-id">' +
      '<label class="field">Name<input class="input" id="tx-name" maxlength="80" required placeholder="e.g. The Army Song"></label>' +
      '<label class="field">Official source<input class="input" id="tx-source" maxlength="120" required placeholder="Publication or page you copied it from"></label>' +
      '<label class="field">Text (word for word; one line per line)<textarea class="input" id="tx-text" rows="8" maxlength="8000" required></textarea></label>' +
      '<div class="row wrap"><button class="btn grow" type="submit">Save text</button><button class="btn ghost" type="button" id="tx-clear">Clear</button></div>' +
      '<p class="muted small">Soldiers are graded against exactly what you enter, so copy it from the official source.</p></form></div>';
  }

  function wireAdmin() {
    var u = U();
    var form = document.getElementById('tx-form');
    if (!form) return;
    var $ = function (id) { return document.getElementById(id); };
    function fill(t) {
      $('tx-id').value = t ? t.id : '';
      $('tx-name').value = t ? t.name : '';
      $('tx-source').value = t ? t.source || '' : '';
      $('tx-text').value = t ? t.text : '';
      $('tx-heading').textContent = t ? 'Edit "' + t.name + '"' : 'Add a text';
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      BWC.Store.saveText({ id: $('tx-id').value || null, name: $('tx-name').value.trim(), source: $('tx-source').value.trim(), text: $('tx-text').value.trim() })
        .then(function () { u.toast('Saved'); return loadCustom(); }).then(renderList)
        .catch(function () { u.toast('Not saved: admins only.'); });
    });
    $('tx-clear').addEventListener('click', function () { fill(null); });
    app().querySelectorAll('[data-edit-text]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = (u.S.customTexts || []).filter(function (x) { return x.id === b.getAttribute('data-edit-text'); })[0];
        fill(t);
        form.scrollIntoView({ behavior: 'smooth' });
      });
    });
    app().querySelectorAll('[data-del-text]').forEach(function (b) {
      var armed = false;
      b.addEventListener('click', function () {
        // Two taps to remove, so a stray tap can't delete it.
        if (!armed) { armed = true; b.textContent = 'Tap again to remove'; return; }
        BWC.Store.deleteText(b.getAttribute('data-del-text')).then(loadCustom).then(renderList);
      });
    });
  }

  function viewCreed(id, sectionArg) {
    if (id.indexOf('custom-') === 0 && !U().S.customTexts) { loadCustom().then(function () { viewCreed(id, sectionArg); }); return; }
    var u = U();
    var c = creedById(id);
    if (!c) { location.hash = '#/creeds'; return; }
    var si = Math.min(c.sections.length - 1, Math.max(0, parseInt(sectionArg || '0', 10) || 0));
    var sec = c.sections[si];
    var best = bestLevel(c, si);
    var lvl = Math.min(best + 1, LEVELS.length - 1);
    if (best === 0 && !u.S.creedRead) lvl = 0;
    renderLevel(c, si, sec, lvl);
  }

  function renderLevel(c, si, sec, lvl) {
    var u = U();
    var L = LEVELS[lvl];
    var best = bestLevel(c, si);
    var idx = 0;
    // Show the text with hidden words as blanks, keeping punctuation and line breaks.
    var display = mapWords(sec.text, function (w) {
      return hiddenAt(idx++, L.hide) ? '<span class="blank" aria-label="hidden word">' + w.replace(/./g, '_') + '</span>' : u.esc(w);
    });

    app().innerHTML = u.header(c.name, '#/creeds') +
      (c.sections.length > 1 ? '<div class="chips">' + c.sections.map(function (s, i) {
        return '<a class="chip-link' + (i === si ? ' on' : '') + '" href="#/creed/' + c.id + '/' + i + '">' + u.esc(s.name) + (bestLevel(c, i) >= 4 ? ' ✓' : '') + '</a>';
      }).join('') + '</div>' : '') +
      '<div class="chips">' + LEVELS.map(function (l, i) {
        var open = i <= best + 1;
        return '<button type="button" class="chip-link' + (i === lvl ? ' on' : '') + '" data-level="' + i + '"' + (open ? '' : ' disabled') + '>' +
          u.esc(l.name) + (i > 0 && i <= best ? ' ✓' : '') + '</button>';
      }).join('') + '</div>' +
      '<div class="card creed-text' + (L.hide >= 1 ? ' memory' : '') + '">' + (L.hide >= 1 ? '<p class="muted">Recite the whole thing from memory.</p>' : '<div>' + display + '</div>') +
      '<div class="cite">' + u.esc(c.pub) + (c.para ? ', ' + u.esc(c.para) : '') + '</div></div>' +
      (lvl === 0 ? '<button type="button" class="btn" id="cr-ready">I\'ve read it. Start Level 1</button>' :
        '<div class="card"><label class="field" for="cr-answer">Recite ' + (L.hide >= 1 ? 'it' : 'the whole text, filling in the blanks') + '</label>' +
        '<textarea class="input" id="cr-answer" rows="6" placeholder="Type it, or tap Speak and say it out loud."></textarea>' +
        '<div class="row wrap">' + (BWC.Board.canListen ? '<button type="button" class="btn ghost small" id="cr-mic">' + u.icon('mic', 18) + 'Speak</button>' : '') +
        '<button type="button" class="btn grow" id="cr-check">Check</button></div>' +
        '<p class="muted small">Pass: ' + Math.round(PASS * 100) + '% of words in order. ' + (L.pts ? 'First pass earns ' + L.pts + ' points.' : '') + '</p></div>' +
        '<div id="cr-result"></div>');

    app().querySelectorAll('[data-level]').forEach(function (b) {
      b.addEventListener('click', function () { BWC.Board.stopListening(); renderLevel(c, si, sec, +b.getAttribute('data-level')); });
    });
    var ready = document.getElementById('cr-ready');
    if (ready) ready.addEventListener('click', function () { u.S.creedRead = true; renderLevel(c, si, sec, 1); });
    var mic = document.getElementById('cr-mic');
    var ta = document.getElementById('cr-answer');
    if (mic) mic.addEventListener('click', function () {
      if (BWC.Board.isListening()) { BWC.Board.stopListening(); mic.innerHTML = u.icon('mic', 18) + 'Speak'; }
      else { BWC.Board.listen(ta, null); mic.innerHTML = u.icon('x', 18) + 'Stop'; }
    });
    var chk = document.getElementById('cr-check');
    if (chk) chk.addEventListener('click', function () {
      BWC.Board.stopListening();
      if (mic) mic.innerHTML = u.icon('mic', 18) + 'Speak';
      var r = check(sec.text, ta.value);
      var passed = r.score >= PASS;
      var k = key(c, si, lvl);
      var first = passed && !u.S.ledger.some(function (e) { return e.kind === 'creed' && e.ref === k; });
      var widx = 0;
      var marked = mapWords(sec.text, function (w) {
        var parts = tokens(w).length || 1;
        var ok = true;
        for (var p = 0; p < parts; p++) ok = r.hit[widx++] && ok;
        return '<span class="' + (ok ? 'w-ok' : 'w-miss') + '">' + u.esc(w) + '</span>';
      });
      document.getElementById('cr-result').innerHTML = '<div class="card ' + (passed ? 'pass' : '') + '">' +
        '<div class="row"><h2 class="grow">' + (passed ? 'Passed' : 'Keep going') + '</h2><span class="chip ' + (passed ? 'good' : 'bad') + '">' + Math.floor(r.score * 100) + '%</span></div>' +
        '<p class="small">' + r.right + ' of ' + r.total + ' words in order. <span class="w-miss">Red words</span> were missed or out of order.</p>' +
        '<div class="creed-check">' + marked + '</div>' +
        (passed && lvl < LEVELS.length - 1 ? '<button type="button" class="btn" id="cr-next">Next: ' + u.esc(LEVELS[lvl + 1].name) + '</button>' : '') +
        (!passed ? '<button type="button" class="btn ghost" id="cr-again">Try again</button>' : '') + '</div>';
      if (first) u.award([{ kind: 'creed', pts: LEVELS[lvl].pts, ref: k }]).then(function () { u.toast('+' + LEVELS[lvl].pts + ' points'); });
      else if (passed) u.S.ledger.push({ kind: 'creed-repeat', pts: 0, ref: k, at: Date.now() });
      var next = document.getElementById('cr-next');
      if (next) next.addEventListener('click', function () { renderLevel(c, si, sec, lvl + 1); });
      var again = document.getElementById('cr-again');
      if (again) again.addEventListener('click', function () { ta.value = ''; document.getElementById('cr-result').innerHTML = ''; ta.focus(); });
      document.getElementById('cr-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function view(id, section) { return id ? viewCreed(id, section) : viewList(); }

  window.BWC = window.BWC || {};
  BWC.Creeds = Object.assign({ view: view }, api);
})();
