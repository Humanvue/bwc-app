// Storage layer. Every screen saves and loads through BWC.Store, so the Firebase
// version (cloud.js) can replace these methods without touching the screens.
// This file is the on-device version used when Firebase is not configured.
// Every method returns a Promise to match the network-backed version.
(function () {
  var KEY = 'bwc.v1';

  // Browser storage can be missing or blocked (private windows), so reads fall back
  // and writes are allowed to fail quietly.
  function load() {
    try {
      var raw = window.localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function save() {
    try { window.localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* ignore */ }
  }

  function newId(prefix) {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  var db = load() || {
    profile: { uid: 'local', name: '', rank: 'SPC', unit: '', role: 'admin', status: 'approved', theme: 'black-gold' },
    attempts: [],   // { qid, topic, correct, mode, at }
    ledger: [],     // { kind, pts, ref, at } every point earned
    learned: {},    // qid -> true
    reports: [],    // { id, qid, reason, comment, status, at, by }
    daily: {},      // 'YYYY-MM-DD' -> { done, correct }
    workouts: []    // { id, type, date, minutes, miles, weight, effort, notes, aft, shot, pts, at }
  };
  db.workouts = db.workouts || [];
  db.threads = db.threads || [];   // { id, channel, title, body, byUid, by, at, lastAt, replies, hooah, pinned, hidden, qid, list: [replies] }

  function findThread(id) { return db.threads.filter(function (t) { return t.id === id; })[0]; }
  function strip(t) { var c = Object.assign({}, t); delete c.list; return c; }

  var listeners = [];

  window.BWC = window.BWC || {};
  BWC.Store = {
    cloud: false,
    ready: Promise.resolve(),

    user: function () { return db.profile; },
    onAuth: function (fn) { listeners.push(fn); },
    signIn: function () { return Promise.resolve(db.profile); },
    signOut: function () { return Promise.resolve(); },

    saveProfile: function (fields) {
      Object.assign(db.profile, fields);
      save();
      return Promise.resolve(db.profile);
    },

    // ---------- answers and points ----------

    attempts: function () { return Promise.resolve(db.attempts.slice()); },

    addAttempts: function (list) {
      list.forEach(function (a) { db.attempts.push(Object.assign({ at: Date.now() }, a)); });
      save();
      return Promise.resolve();
    },

    ledger: function () { return Promise.resolve(db.ledger.slice()); },

    addPoints: function (entries) {
      entries.forEach(function (e) { db.ledger.push(Object.assign({ at: Date.now() }, e)); });
      db.profile.points = db.ledger.reduce(function (s, e) { return s + e.pts; }, 0);
      save();
      return Promise.resolve(db.profile.points);
    },

    learned: function () { return Promise.resolve(Object.assign({}, db.learned)); },

    setLearned: function (qid, on) {
      if (on) db.learned[qid] = true; else delete db.learned[qid];
      save();
      return Promise.resolve();
    },

    daily: function () { return Promise.resolve(Object.assign({}, db.daily)); },

    saveDaily: function (date, result) {
      db.daily[date] = result;
      save();
      return Promise.resolve();
    },

    // ---------- workouts ----------

    workouts: function () { return Promise.resolve(db.workouts.slice()); },

    addWorkout: function (w) {
      var rec = Object.assign({ id: newId('w'), at: Date.now() }, w);
      db.workouts.push(rec);
      save();
      return Promise.resolve(rec);
    },

    // ---------- sponsor and leader views (demo: you are your own competitor) ----------

    competitors: function () { return Promise.resolve([Object.assign({}, db.profile)]); },

    memberMeta: function () { return Promise.resolve({ learned: Object.assign({}, db.learned), daily: Object.assign({}, db.daily) }); },

    reviewWorkout: function (uid, workoutId, review) {
      db.workouts.forEach(function (w) { if (w.id === workoutId) { w.review = review; w.reviewedBy = db.profile.uid; } });
      save();
      return Promise.resolve();
    },

    // ---------- discussion board ----------

    threads: function (channel) {
      return Promise.resolve(db.threads.filter(function (t) { return !channel || t.channel === channel; }).map(strip));
    },

    thread: function (id) {
      var t = findThread(id);
      if (!t) return Promise.resolve(null);
      return Promise.resolve({ thread: strip(t), replies: (t.list || []).slice() });
    },

    addThread: function (fields, id) {
      var p = db.profile;
      var t = Object.assign({
        id: id || newId('t'), byUid: p.uid, by: ((p.rank ? p.rank + ' ' : '') + (p.name || '')).trim(),
        at: Date.now(), lastAt: Date.now(), replies: 0, hooah: {}, pinned: false, hidden: false, list: []
      }, fields);
      db.threads.push(t);
      save();
      return Promise.resolve(t.id);
    },

    addReply: function (threadId, body) {
      var t = findThread(threadId);
      var p = db.profile;
      t.list = t.list || [];
      t.list.push({ id: newId('r'), body: body, byUid: p.uid, by: ((p.rank ? p.rank + ' ' : '') + (p.name || '')).trim(), at: Date.now(), hooah: {}, hidden: false });
      t.replies = t.list.length;
      t.lastAt = Date.now();
      save();
      return Promise.resolve();
    },

    toggleHooah: function (threadId, replyId) {
      var t = findThread(threadId);
      var target = replyId ? (t.list || []).filter(function (r) { return r.id === replyId; })[0] : t;
      var uid = db.profile.uid;
      target.hooah = target.hooah || {};
      if (target.hooah[uid]) delete target.hooah[uid]; else target.hooah[uid] = true;
      save();
      return Promise.resolve();
    },

    moderate: function (threadId, replyId, fields) {
      var t = findThread(threadId);
      var target = replyId ? (t.list || []).filter(function (r) { return r.id === replyId; })[0] : t;
      Object.assign(target, fields);
      save();
      return Promise.resolve();
    },

    // ---------- question error reports ----------

    addReport: function (r) {
      db.reports.push(Object.assign({ id: newId('r'), status: 'open', at: Date.now(), by: db.profile.name || 'You' }, r));
      save();
      return Promise.resolve();
    },

    reports: function () { return Promise.resolve(db.reports.slice().reverse()); },

    resolveReport: function (id, status) {
      db.reports.forEach(function (r) { if (r.id === id) r.status = status; });
      save();
      return Promise.resolve();
    },

    // ---------- people (single person on this device) ----------

    leaderboard: function () {
      var p = db.profile;
      return Promise.resolve([{ uid: p.uid, name: p.name || 'You', rank: p.rank, unit: p.unit, points: p.points || 0 }]);
    },

    users: function () { return Promise.resolve([db.profile]); },
    updateUser: function () { return Promise.resolve(); }
  };
})();
