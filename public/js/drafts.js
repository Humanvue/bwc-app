// Award (DA Form 638) and NCOER (DA Form 2166-9 series) bullet DRAFTS built only from a Soldier's
// own records in this app, inside a chosen rating period. Rules applied:
//  - AR 623-3 glossary: bullets start with an action verb (or "their"), are no longer than two lines
//    (preferably one), one bullet to a line. No pronouns are used, so sex is never implied.
//  - AR 623-3 para 3-21d: nothing outside the rating period; only records dated inside it count.
//  - AR 623-3 paras 3-21 and 3-22: no comments on protected characteristics, marital status or family.
// The pure functions (metrics, ncoer, award) are tested by tools/test_drafts.js.
// Route: #/drafts/<uid> (sponsors and leaders, from a competitor's dashboard page).
(function (root) {
  var MAX_LEN = 180; // about two lines on the form

  function dayKey(ms) { var d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function fmtTime(sec) { return Math.floor(sec / 60) + ':' + String(Math.round(sec % 60)).padStart(2, '0'); }
  function n(x) { return Number(x).toLocaleString('en-US'); }

  // Everything a draft may say, computed from records dated inside [from, thru] (ms).
  function metrics(m, questions, topicNames, from, thru) {
    var inP = function (at) { return at >= from && at <= thru; };
    var A = (m.attempts || []).filter(function (a) { return inP(a.at); });
    var L = (m.ledger || []).filter(function (e) { return inP(e.at); });
    var W = (m.workouts || []).filter(function (w) { var t = new Date(w.date + 'T12:00:00').getTime(); return inP(t); });
    var topicOf = {};
    questions.forEach(function (q) { topicOf[q.id] = q.topic; });

    var byTopic = {};
    A.forEach(function (a) {
      var t = a.topic || topicOf[a.qid];
      if (!t) return;
      var s = byTopic[t] || (byTopic[t] = { n: 0, right: 0 });
      s.n++; if (a.correct) s.right++;
    });
    var mastered = Object.keys(byTopic).filter(function (t) { return byTopic[t].n >= 5 && byTopic[t].right / byTopic[t].n >= 0.85; })
      .map(function (t) { return topicNames[t] || t; });
    var right = A.filter(function (a) { return a.correct; }).length;
    var days = {};
    [].concat(A, L).forEach(function (x) { days[dayKey(x.at)] = true; });
    W.forEach(function (w) { days[w.date] = true; });

    var boards = L.filter(function (e) { return e.kind === 'board-done' && !e.sponsored; });
    var sboards = L.filter(function (e) { return e.kind === 'board-done' && e.sponsored; });
    var drillGo = L.filter(function (e) { return e.kind === 'drill' && e.ok; }).length;
    var lnGo = L.filter(function (e) { return e.kind === 'landnav' && e.ok; });
    var plots = L.filter(function (e) { return e.kind === 'landnav' && e.ref === 'plot' && typeof e.err === 'number'; });
    var creeds = {};
    L.forEach(function (e) { if (e.kind === 'creed' && /:4$/.test(e.ref || '')) creeds[e.ref.split(':')[0]] = true; });

    var aft = {};
    W.filter(function (w) { return w.type === 'aft' && w.aft; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; })
      .forEach(function (w) { Object.keys(w.aft).forEach(function (k) { (aft[k] = aft[k] || []).push(w.aft[k]); }); });

    var weeks = Math.max(1, Math.round((thru - from) / (7 * 86400000)));
    return {
      weeks: weeks,
      activeDays: Object.keys(days).length,
      answered: A.length,
      accuracy: A.length ? Math.round(right / A.length * 100) : null,
      topics: Object.keys(byTopic).length,
      mastered: mastered,
      boards: boards.length,
      bestBoard: boards.length ? Math.max.apply(null, boards.map(function (b) { return b.score || 0; })) : null,
      sponsorBoards: sboards.length,
      sponsorBest: sboards.length ? Math.max.apply(null, sboards.map(function (b) { return b.score || 0; })) : null,
      drillGo: drillGo,
      landNavGo: lnGo.length,
      plotAvg: plots.length ? Math.round(plots.reduce(function (s, e) { return s + e.err; }, 0) / plots.length) : null,
      creeds: Object.keys(creeds),
      workouts: W.length,
      minutes: W.reduce(function (s, w) { return s + (w.minutes || 0); }, 0),
      ruckMiles: Math.round(W.filter(function (w) { return w.type === 'ruck'; }).reduce(function (s, w) { return s + (w.miles || 0); }, 0) * 10) / 10,
      maxRuckLb: W.filter(function (w) { return w.type === 'ruck'; }).reduce(function (s, w) { return Math.max(s, w.weight || 0); }, 0),
      aft: aft
    };
  }

  var CREED_NAMES = { 'soldiers-creed': 'Soldier\'s Creed', 'nco-creed': 'NCO Creed', 'army-values': 'Army Values', 'general-orders': 'General Orders', 'warrior-ethos': 'Warrior Ethos' };
  var AFT_IMPROVE = { '2mr': ['2-mile run', 'low', true], 'sdc': ['sprint-drag-carry', 'low', true], 'plk': ['plank', 'high', true], 'mdl': ['deadlift', 'high', false], 'hrp': ['hand-release push-ups', 'high', false] };

  function list(items) {
    if (items.length <= 1) return items.join('');
    return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
  }

  function bullet(text) {
    var t = 'o ' + text;
    return t.length > MAX_LEN ? t.slice(0, MAX_LEN - 1).replace(/\s+\S*$/, '') + '…' : t;
  }

  function aftLines(M) {
    var out = [];
    Object.keys(AFT_IMPROVE).forEach(function (k) {
      var v = M.aft[k];
      if (!v || v.length < 2) return;
      var first = v[0], last = v[v.length - 1], spec = AFT_IMPROVE[k];
      var better = spec[1] === 'low' ? last < first : last > first;
      if (!better) return;
      var f = spec[2] ? fmtTime(first) : first, l = spec[2] ? fmtTime(last) : last;
      out.push(spec[0] + ' from ' + f + ' to ' + l + (k === 'mdl' ? ' lb' : ''));
    });
    return out;
  }

  // NCOER bullets grouped by part IV block. Only bullets the records support are produced.
  function ncoer(M, placement) {
    var blocks = { Character: [], Presence: [], Intellect: [], Achieves: [] };
    if (M.creeds.length) blocks.Character.push(bullet('memorized and recited the ' + list(M.creeds.map(function (c) { return CREED_NAMES[c] || c; })) + ' word for word'));
    if (M.workouts >= 5) blocks.Presence.push(bullet('logged ' + n(M.workouts) + ' workouts (' + n(Math.round(M.minutes / 60)) + ' hours) in ' + M.weeks + ' weeks' + (M.ruckMiles >= 5 ? ', including ' + M.ruckMiles + ' ruck miles' + (M.maxRuckLb ? ' under loads up to ' + M.maxRuckLb + ' lb' : '') : '')));
    var aft = aftLines(M);
    if (aft.length) blocks.Presence.push(bullet('improved ' + list(aft.slice(0, 2)) + ' during competition preparation'));
    if (M.answered >= 50) blocks.Intellect.push(bullet('answered ' + n(M.answered) + ' doctrinal board questions at ' + M.accuracy + '% accuracy across ' + M.topics + ' topics'));
    if (M.mastered.length >= 2) blocks.Intellect.push(bullet('mastered ' + M.mastered.length + ' subject areas, including ' + list(M.mastered.slice(0, 3)) + ', at 85% or better'));
    if (M.landNavGo >= 5) blocks.Intellect.push(bullet('earned ' + M.landNavGo + ' GOs on 1:25,000 land navigation drills' + (M.plotAvg != null ? '; averaged ' + M.plotAvg + ' m plotting error' : '')));
    if (placement && placement.place) blocks.Achieves.push(bullet((placement.place === 'competed' ? 'competed in' : 'placed ' + placement.place + ' at') + ' the ' + placement.event));
    if (M.boards >= 2) blocks.Achieves.push(bullet('sat ' + M.boards + ' timed mock boards; achieved a best score of ' + M.bestBoard + '%'));
    if (M.sponsorBoards) blocks.Achieves.push(bullet('completed ' + M.sponsorBoards + ' sponsor-scored board' + (M.sponsorBoards === 1 ? '' : 's') + '; best result ' + M.sponsorBest + '% GO'));
    if (M.drillGo >= 5) blocks.Achieves.push(bullet('performed ' + M.drillGo + ' weapons and warrior task drills to standard'));
    return blocks;
  }

  // DA Form 638: achievement bullets (strongest four) and a proposed citation.
  function award(M, who, period, placement, level) {
    var b = ncoer(M, placement);
    var ordered = [].concat(b.Achieves, b.Intellect, b.Presence, b.Character).slice(0, 4);
    var name = (who.rank ? who.rank + ' ' : '') + (who.last || who.name || 'the Soldier');
    var highlights = [];
    if (placement && placement.place && placement.place !== 'competed') highlights.push('placing ' + placement.place + ' at the ' + placement.event);
    if (M.answered >= 50) highlights.push('answering ' + n(M.answered) + ' doctrinal questions at ' + M.accuracy + '% accuracy');
    if (M.boards || M.sponsorBoards) highlights.push('sitting ' + (M.boards + M.sponsorBoards) + ' practice boards');
    if (M.ruckMiles >= 10) highlights.push('rucking ' + M.ruckMiles + ' miles');
    var citation = 'For meritorious achievement while preparing for the TY27 Minnesota National Guard Best Warrior Competition from ' +
      period.fromText + ' to ' + period.thruText + '. ' + name + ' demonstrated exceptional dedication and discipline' +
      (highlights.length ? ', ' + list(highlights.slice(0, 3)) : '') + '. ' + name + '\'s efforts reflect great credit upon ' +
      (who.unit ? who.unit + ', ' : '') + 'the Minnesota National Guard, and the United States Army.';
    return { achievements: ordered, citation: citation };
  }

  var api = { metrics: metrics, ncoer: ncoer, award: award, bullet: bullet, MAX_LEN: MAX_LEN };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  // ---------- screen ----------

  function U() { return BWC.UI; }
  function app() { return document.getElementById('app'); }
  var NCO_RANKS = ['SGT', 'SSG', 'SFC', 'MSG', '1SG', 'SGM', 'CSM'];

  function view(uid) {
    var u = U();
    uid = decodeURIComponent(uid || '');
    app().innerHTML = u.header('Award and NCOER drafts', '#/team/' + encodeURIComponent(uid)) + '<div class="card"><p class="muted">Loading records…</p></div>';
    Promise.all([BWC.Store.competitors(), BWC.Team.loadMember(uid)]).then(function (r) {
      var p = r[0].filter(function (x) { return x.uid === uid; })[0];
      if (!p) { app().innerHTML = u.header('Drafts', '#/team') + '<div class="card"><p>This Soldier is not in your list.</p></div>'; return; }
      var m = r[1];
      var stamps = [].concat(m.attempts, m.ledger).map(function (x) { return x.at; }).filter(Boolean);
      var first = stamps.length ? Math.min.apply(null, stamps) : Date.now();
      var iso = function (ms) { return dayKey(ms); };
      var events = ['HHBn Best Warrior Competition', '34ID Best Warrior Competition', 'MNNG Best Warrior Competition', 'Region IV Best Warrior Competition'];
      var isNco = NCO_RANKS.indexOf(p.rank) >= 0;

      app().innerHTML = u.header('Award and NCOER drafts', '#/team/' + encodeURIComponent(uid)) +
        '<div class="card draft-warning"><strong>DRAFTS for the rater and award recommender to review and edit.</strong> Built only from ' + u.esc(u.displayName(p)) +
        '\'s records in this app, within the period you set. Check every fact before using it. Follow AR 623-3 and AR 600-8-22.</div>' +
        '<form class="card" id="df-form"><div class="row wrap">' +
        '<label class="field grow">Period from<input class="input" type="date" id="df-from" value="' + iso(first) + '"></label>' +
        '<label class="field grow">Through<input class="input" type="date" id="df-thru" value="' + iso(Date.now()) + '"></label></div>' +
        '<div class="row wrap"><label class="field grow">Competition result (optional)<select class="input" id="df-event"><option value="">None</option>' +
        events.map(function (e) { return '<option>' + e + '</option>'; }).join('') + '</select></label>' +
        '<label class="field grow">Place<select class="input" id="df-place"><option value="competed">Competed</option><option value="1st">1st</option><option value="2nd">2nd</option><option value="3rd">3rd</option></select></label></div>' +
        '<label class="field">Award recommended<select class="input" id="df-level"><option value="AAM">Army Achievement Medal</option><option value="ARCOM">Army Commendation Medal</option></select></label>' +
        '<button class="btn" type="submit">Build drafts</button></form><div id="df-out"></div>';

      document.getElementById('df-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var fromV = document.getElementById('df-from').value, thruV = document.getElementById('df-thru').value;
        var from = new Date(fromV + 'T00:00:00').getTime(), thru = new Date(thruV + 'T23:59:59').getTime();
        var names = {};
        window.BWC_CONFIG.topics.forEach(function (t) { names[t.id] = t.name.replace(/ \(.*\)$/, ''); });
        var M = metrics(m, window.BWC_QUESTIONS || [], names, from, thru);
        var ev = document.getElementById('df-event').value;
        var placement = ev ? { event: ev, place: document.getElementById('df-place').value } : null;
        // Army date style: 18 September 2026
        var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        var fmt = function (v) { var d = new Date(v + 'T12:00:00'); return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); };
        var last = String(p.name || '').trim().split(/\s+/).pop();
        var aw = award(M, { rank: p.rank, last: last, name: p.name, unit: p.unit }, { fromText: fmt(fromV), thruText: fmt(thruV) }, placement, document.getElementById('df-level').value);
        var nc = ncoer(M, placement);
        var ncText = Object.keys(nc).filter(function (k) { return nc[k].length; }).map(function (k) { return k.toUpperCase() + '\n' + nc[k].join('\n'); }).join('\n\n');
        var awText = aw.achievements.join('\n');
        var thin = M.answered < 50 && M.workouts < 5 && M.boards + M.sponsorBoards < 2;

        document.getElementById('df-out').innerHTML =
          (thin ? '<div class="card attention"><p>There isn\'t much recorded in this period yet, so the drafts are short. Widen the period or wait for more training.</p></div>' : '') +
          '<div class="card"><div class="row"><h2 class="grow">DA Form 638: achievements</h2><button type="button" class="btn small ghost" data-copy="df-aw">Copy</button></div>' +
          '<pre class="draft" id="df-aw">' + u.esc(awText || '(Not enough records in this period.)') + '</pre>' +
          '<div class="row"><h3 class="grow">Proposed citation</h3><button type="button" class="btn small ghost" data-copy="df-cit">Copy</button></div>' +
          '<pre class="draft" id="df-cit">' + u.esc(aw.citation) + '</pre></div>' +
          '<div class="card"><div class="row"><h2 class="grow">NCOER bullets</h2>' + (isNco ? '<button type="button" class="btn small ghost" data-copy="df-nc">Copy</button>' : '') + '</div>' +
          (isNco ? '<pre class="draft" id="df-nc">' + u.esc(ncText || '(Not enough records in this period.)') + '</pre>'
            : '<p class="muted">NCOER bullets apply to SGT and above (DA Form 2166-9-1 and -2). ' + u.esc(u.displayName(p)) + ' is listed as ' + u.esc(p.rank || 'no rank') + '.</p>') +
          '<p class="muted small">Bullets follow AR 623-3: start with an action verb, no longer than two lines, one per line, no pronouns. Use each example once, under the block it fits best. Do not add comments on race, color, religion, sex, age, sexual orientation, national origin, marital status or family (AR 623-3 paras 3-21 and 3-22).</p></div>' +
          '<div class="card"><h3>What the drafts are based on</h3><div class="small mono">' + u.esc(M.activeDays + ' active days · ' + M.answered + ' answers (' + (M.accuracy == null ? '–' : M.accuracy + '%') + ') · ' +
            M.boards + ' mock board' + (M.boards === 1 ? '' : 's') + ' · ' + M.sponsorBoards + ' sponsor board' + (M.sponsorBoards === 1 ? '' : 's') + ' · ' + M.drillGo + ' drill GOs · ' + M.landNavGo + ' land nav GOs · ' + M.workouts + ' workouts · ' + M.ruckMiles + ' ruck mi') + '</div></div>';
        app().querySelectorAll('[data-copy]').forEach(function (b) {
          b.addEventListener('click', function () {
            var text = document.getElementById(b.getAttribute('data-copy')).textContent;
            var done = function () { u.toast('Copied'); };
            if (navigator.clipboard) navigator.clipboard.writeText(text).then(done).catch(function () { selectText(b.getAttribute('data-copy')); });
            else selectText(b.getAttribute('data-copy'));
          });
        });
      });
    });
  }

  function selectText(id) {
    var el = document.getElementById(id);
    var r = document.createRange(); r.selectNodeContents(el);
    var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    U().toast('Selected. Copy it from the menu.');
  }

  root.BWC = root.BWC || {};
  root.BWC.Drafts = Object.assign({ view: view }, api);
})(this);
