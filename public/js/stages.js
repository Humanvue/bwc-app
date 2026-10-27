// Competition stages: HHBn → 34ID → MNNG State → Region IV. An admin sets each Soldier's stage
// (Me → Admin → People). Advancing unlocks that stage's board level, any questions tagged for it,
// points the countdown at the next competition, awards an advancement badge and a one-time bonus.
(function () {
  var C = window.BWC_CONFIG;

  function index(stageId) {
    var i = C.stages.map(function (s) { return s.id; }).indexOf(stageId || 'hhbn');
    return i < 0 ? 0 : i;
  }
  function of(user) { return C.stages[index(user && user.stage)]; }

  // Questions may carry "stage": "division" | "state" | "region"; they stay hidden until reached.
  // The shared question list is filtered in place so every screen sees the same set.
  var ALL = null;
  function applyContent(user) {
    var Q = window.BWC_QUESTIONS || [];
    if (!ALL) ALL = Q.slice();
    var me = index(user && user.stage);
    var keep = ALL.filter(function (q) { return !q.stage || index(q.stage) <= me; });
    Q.length = 0;
    Array.prototype.push.apply(Q, keep);
    return { total: ALL.length, unlocked: keep.length, locked: ALL.length - keep.length };
  }
  function lockedCounts(user) {
    var me = index(user && user.stage);
    var out = {};
    (ALL || window.BWC_QUESTIONS || []).forEach(function (q) {
      if (q.stage && index(q.stage) > me) out[q.stage] = (out[q.stage] || 0) + 1;
    });
    return out;
  }

  // Board levels this Soldier can sit: the standard board plus one per stage reached.
  function boardLevels(user) {
    var me = index(user && user.stage);
    return C.stages.filter(function (s) { return s.board; }).map(function (s) {
      return Object.assign({ id: s.id, open: index(s.id) <= me, stageName: s.name }, s.board);
    });
  }

  // Competitions from this Soldier's current stage onward (for the countdown).
  function competitionsFor(user) {
    var st = of(user);
    var from = C.competitions.map(function (c) { return c.id; }).indexOf(st.comp);
    return C.competitions.slice(Math.max(0, from));
  }

  // One-time bonus for each stage reached. Called on Home.
  function awardAdvance() {
    var u = BWC.UI;
    if (!u || !u.S.user) return;
    var me = index(u.S.user.stage);
    var entries = [];
    C.stages.slice(1, me + 1).forEach(function (s) {
      var ref = 'advance:' + s.id;
      if (!u.S.ledger.some(function (e) { return e.ref === ref; })) entries.push({ kind: 'advance', pts: C.advanceBonus, ref: ref });
    });
    if (!entries.length) return;
    u.award(entries).then(function () {
      u.toast('Advanced to ' + of(u.S.user).name + '! +' + entries.length * C.advanceBonus + ' points. ' + of(u.S.user).board.name + ' unlocked.');
    });
  }

  window.BWC = window.BWC || {};
  BWC.Stages = { index: index, of: of, applyContent: applyContent, lockedCounts: lockedCounts, boardLevels: boardLevels, competitionsFor: competitionsFor, awardAdvance: awardAdvance };
})();
