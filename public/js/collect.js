// Collectibles: an arms room of weapons unlocked by weapons study and drills, and a rack of
// app ribbons earned from tracked activity. These are app badges, not Army awards, so they use
// their own names and stripe colors rather than real ribbon designs.
// Route: #/collection. Also checks for new unlocks and announces them.
(function () {
  var WEAPON_TOPICS = ['rifle', 'pistol', 'machine-guns', 'qualification', 'range-safety'];

  // Arms room: weapons points = first-time right answers in weapons topics + weapons drill GOs.
  var WEAPONS = [
    { need: 5, name: 'M17 pistol', kind: 'pistol' },
    { need: 15, name: 'M4 carbine', kind: 'rifle' },
    { need: 30, name: 'M249 light machine gun', kind: 'mg' },
    { need: 50, name: 'M240 medium machine gun', kind: 'mg' },
    { need: 75, name: 'M2 heavy machine gun', kind: 'mg' },
    { need: 100, name: 'Javelin', kind: 'launcher' },
    { need: 150, name: 'XM7 rifle', kind: 'rifle' }
  ];

  // App ribbons in this app's order of precedence (highest first). Stripe colors are the app's own.
  var RIBBONS = [
    { id: 'adv-region', name: 'Region IV Competitor', how: 'Advance to the Region IV Best Warrior Competition', colors: ['#FFCC33', '#0A0A0D', '#FFCC33', '#0A0A0D', '#FFCC33'] },
    { id: 'adv-state', name: 'State Competitor', how: 'Advance to the MNNG Best Warrior Competition', colors: ['#0C1E3E', '#FFCC33', '#0C1E3E'] },
    { id: 'adv-division', name: '34ID Competitor', how: 'Advance to the 34ID Best Warrior Competition', colors: ['#B91C1C', '#0A0A0D', '#B91C1C'] },
    { id: 'sponsor-board', name: 'Board Excellence', how: 'Score 80% or better on a sponsor-scored board', colors: ['#1D3A8A', '#FFCC33', '#FFFFFF', '#FFCC33', '#1D3A8A'] },
    { id: 'board-pass', name: 'Mock Board', how: 'Pass a timed mock board', colors: ['#5B2C83', '#FFFFFF', '#5B2C83'] },
    { id: 'nco-creed', name: 'NCO Creed', how: 'Recite the whole NCO Creed from memory', colors: ['#0A0A0D', '#FFCC33', '#0A0A0D', '#FFCC33', '#0A0A0D'] },
    { id: 'soldiers-creed', name: 'Soldier\'s Creed', how: 'Recite the Soldier\'s Creed from memory', colors: ['#2E5E2E', '#FFCC33', '#2E5E2E'] },
    { id: 'lifesaver', name: 'Lifesaver', how: 'GO on MARCH, the CAT tourniquet and the 9-line MEDEVAC drills', colors: ['#B91C1C', '#FFFFFF', '#B91C1C', '#FFFFFF', '#B91C1C'] },
    { id: 'navigator', name: 'Navigator', how: '10 land nav GOs', colors: ['#0E7490', '#F2E8CF', '#0E7490'] },
    { id: 'marksman', name: 'Zero Marksman', how: '5 GOs on the 25 m zero drill', colors: ['#3F3F46', '#E0A800', '#3F3F46', '#E0A800', '#3F3F46'] },
    { id: 'scholar', name: 'Scholar', how: '100 questions answered right at least once', colors: ['#7A1F2B', '#E8D9B5', '#7A1F2B'] },
    { id: 'iron-ruck', name: 'Iron Ruck', how: '50 total ruck miles', colors: ['#4B3B2A', '#C2410C', '#4B3B2A'] },
    { id: 'daily-grind', name: 'Daily Grind', how: 'Daily 10 on 20 different days', colors: ['#1F2937', '#60A5FA', '#FFFFFF', '#60A5FA', '#1F2937'] }
  ];

  function U() { return BWC.UI; }
  function app() { return document.getElementById('app'); }
  function drillGo(L, ref) { return L.some(function (e) { return e.kind === 'drill' && e.ref === ref && e.ok; }); }

  function compute(S) {
    var L = S.ledger || [], A = S.attempts || [], W = S.workouts || [];
    var Q = window.BWC_QUESTIONS || [];
    var topicOf = {};
    Q.forEach(function (q) { topicOf[q.id] = q.topic; });
    var everRight = {};
    A.forEach(function (a) { if (a.correct) everRight[a.qid] = true; });
    var weaponRight = Object.keys(everRight).filter(function (id) { return WEAPON_TOPICS.indexOf(topicOf[id]) >= 0; }).length;
    var weaponDrillIds = ((window.BWC_DRILLS || {}).sequences || []).filter(function (d) { return d.group === 'weapons'; }).map(function (d) { return d.id; }).concat(['zero']);
    var weaponGos = L.filter(function (e) { return e.kind === 'drill' && e.ok && weaponDrillIds.indexOf(e.ref) >= 0; }).length;
    var weaponPts = weaponRight + weaponGos;

    var creedRef = function (id, sec) { return L.some(function (e) { return e.kind === 'creed' && e.ref === id + ':' + sec + ':4'; }); };
    var ncoWhole = ((window.BWC && BWC.Creeds && BWC.Creeds.CREEDS.filter(function (c) { return c.id === 'nco-creed'; })[0]) || { sections: [] }).sections.length - 1;
    var miles = W.filter(function (w) { return w.type === 'ruck'; }).reduce(function (s, w) { return s + (w.miles || 0); }, 0);
    var dailyDays = Object.keys(S.daily || {}).filter(function (d) { return S.daily[d] && S.daily[d].done; }).length;
    var boards = L.filter(function (e) { return e.kind === 'board-done'; });
    var passPct = window.BWC_CONFIG.board.passPct;

    var stageIdx = window.BWC && BWC.Stages ? BWC.Stages.index(S.user && S.user.stage) : 0;
    var earned = {
      'adv-division': stageIdx >= 1,
      'adv-state': stageIdx >= 2,
      'adv-region': stageIdx >= 3,
      'sponsor-board': boards.some(function (b) { return b.sponsored && (b.score || 0) >= 80; }),
      'board-pass': boards.some(function (b) { return !b.sponsored && (b.score || 0) >= passPct; }),
      'nco-creed': ncoWhole >= 0 && creedRef('nco-creed', ncoWhole),
      'soldiers-creed': creedRef('soldiers-creed', 0),
      'lifesaver': drillGo(L, 'seq-march') && drillGo(L, 'seq-cat') && drillGo(L, 'fmt-9line'),
      'navigator': L.filter(function (e) { return e.kind === 'landnav' && e.ok; }).length >= 10,
      'marksman': L.filter(function (e) { return e.kind === 'drill' && e.ref === 'zero' && e.ok; }).length >= 5,
      'scholar': Object.keys(everRight).length >= 100,
      'iron-ruck': miles >= 50,
      'daily-grind': dailyDays >= 20
    };
    return {
      weaponPts: weaponPts,
      weapons: WEAPONS.map(function (w) { return Object.assign({ on: weaponPts >= w.need }, w); }),
      ribbons: RIBBONS.map(function (r) { return Object.assign({ on: !!earned[r.id] }, r); })
    };
  }

  // ---------- drawing ----------

  var GUN = {
    pistol: 'M3 9h13l1 2h3v2H9l-1 4H5l1-4H3z',
    rifle: 'M1 11h15l2-1h5v3h-6l-2 1v3h-2l-1-3H7l-2 3H3l1-3H1z',
    mg: 'M1 10h17l1-1h4v3h-5v2h-3l-1 3h-2l1-3H8l-1 2-2 2-1-1 2-3H1z',
    launcher: 'M1 9h20v4H1z M5 13v3h3v-3 M14 13v4h2v-4 M21 10h2v2h-2'
  };
  function gun(kind) {
    return '<svg width="64" height="32" viewBox="0 0 24 20" fill="currentColor" aria-hidden="true"><path d="' + (GUN[kind] || GUN.rifle) + '"></path></svg>';
  }

  function ribbonHtml(r, big) {
    var n = r.colors.length;
    var stops = r.colors.map(function (c, i) {
      var a = (i / n * 100).toFixed(1), b = ((i + 1) / n * 100).toFixed(1);
      return c + ' ' + a + '%, ' + c + ' ' + b + '%';
    }).join(', ');
    return '<span class="ribbon' + (big ? ' big' : '') + (r.on ? '' : ' locked') + '" style="background: linear-gradient(90deg, ' + stops + ')" role="img" aria-label="' +
      U().esc(r.name) + (r.on ? '' : ' (not earned yet)') + '"></span>';
  }

  function view() {
    var u = U();
    var c = compute(u.S);
    var next = c.weapons.filter(function (w) { return !w.on; })[0];
    var rack = c.ribbons.filter(function (r) { return r.on; });
    app().innerHTML = u.header('Arms room and ribbons', '#/me') +
      '<p class="muted small">App badges for training in this app. They are not Army awards.</p>' +
      '<div class="card"><h2>Ribbon rack</h2>' +
      (rack.length ? '<div class="rack">' + rack.map(function (r) { return ribbonHtml(r, true); }).join('') + '</div><p class="muted small">Worn in order of precedence, highest first, top left.</p>'
        : '<p class="muted">No ribbons yet. Each one below shows how to earn it.</p>') + '</div>' +
      '<div class="card"><h2>All ribbons</h2><div class="list">' + c.ribbons.map(function (r) {
        return '<div class="list-row">' + ribbonHtml(r) + '<div class="grow"><strong>' + u.esc(r.name) + '</strong><div class="muted small">' + u.esc(r.how) + '</div></div>' +
          (r.on ? '<span class="chip good">Earned</span>' : '') + '</div>';
      }).join('') + '</div></div>' +
      '<div class="card"><div class="row"><h2 class="grow">Arms room</h2><span class="mono small">' + c.weaponPts + ' weapons pts</span></div>' +
      (next ? '<div class="small">' + (next.need - c.weaponPts) + ' more to unlock the <strong>' + u.esc(next.name) + '</strong></div>' +
        '<div class="bar"><span style="width:' + Math.min(100, Math.round(c.weaponPts / next.need * 100)) + '%"></span></div>' : '<div class="small"><strong>Arms room complete.</strong></div>') +
      '<div class="arms">' + c.weapons.map(function (w) {
        return '<div class="arm' + (w.on ? ' on' : '') + '">' + gun(w.kind) + '<span class="name">' + u.esc(w.name) + '</span><span class="small">' + (w.on ? 'Unlocked' : w.need + ' pts') + '</span></div>';
      }).join('') + '</div><p class="muted small">Weapons points: each weapons question you get right the first time, plus each GO on a weapons drill.</p></div>';
  }

  // Announce anything newly earned since this device last looked.
  function announce() {
    var u = U();
    if (!u || !u.S.user) return;
    var c = compute(u.S);
    var have = c.ribbons.filter(function (r) { return r.on; }).map(function (r) { return 'r:' + r.id; })
      .concat(c.weapons.filter(function (w) { return w.on; }).map(function (w) { return 'w:' + w.name; }));
    var key = 'bwc.collect.' + u.S.user.uid;
    var seen;
    try { seen = JSON.parse(window.localStorage.getItem(key) || 'null'); } catch (e) { seen = null; }
    try { window.localStorage.setItem(key, JSON.stringify(have)); } catch (e) { /* ignore */ }
    if (!seen) return; // first visit on this device: record without a flood of alerts
    var fresh = have.filter(function (k) { return seen.indexOf(k) < 0; });
    if (!fresh.length) return;
    var k = fresh[fresh.length - 1];
    var label = k[0] === 'r' ? (c.ribbons.filter(function (r) { return 'r:' + r.id === k; })[0] || {}).name + ' ribbon' : k.slice(2);
    u.toast('New unlock: ' + label + (fresh.length > 1 ? ' (+' + (fresh.length - 1) + ' more)' : '') + '. See Me → Arms room and ribbons.');
  }

  window.BWC = window.BWC || {};
  BWC.Collect = { view: view, compute: compute, announce: announce, ribbonHtml: ribbonHtml, RIBBONS: RIBBONS, WEAPONS: WEAPONS };
})();
