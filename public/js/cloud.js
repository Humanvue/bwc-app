// Online mode: when the Firebase SDK and config are present, this swaps BWC.Store's
// methods over to Firestore and adds Google sign-in with admin approval.
// Without a config the app stays on this device (store.js).
//
// Firestore layout (see firestore.rules):
//   users/{uid}                    name, rank, unit, role, status, sponsorUid, points, theme
//   users/{uid}/private/meta       email (admins only), learned question ids, Daily 10 history
//   users/{uid}/attempts/{id}      one answered question
//   users/{uid}/ledger/{id}        one point award
//   reports/{id}                   question error reports
(function () {
  var config = window.BWC_FIREBASE_CONFIG;
  var fb = window.firebase;
  if (!config || !config.apiKey || !fb || !fb.firestore || !fb.auth) return;
  // ?demo in the address runs on this device only, for testing without signing in.
  if (/[?&]demo\b/.test(location.search)) return;

  var Store = BWC.Store;
  var auth, db;
  try {
    fb.initializeApp(config);
    auth = fb.auth();
    db = fb.firestore();
  } catch (e) {
    return;
  }
  var now = fb.firestore.FieldValue.serverTimestamp;
  var inc = fb.firestore.FieldValue.increment;

  var profile = null;
  var meta = { learned: {}, daily: {} };
  var listeners = [];

  function userRef(uid) { return db.collection('users').doc(uid || profile.uid); }
  function metaRef(uid) { return userRef(uid).collection('private').doc('meta'); }

  Store.cloud = true;

  Store.ready = new Promise(function (resolve) {
    var settled = false;
    setTimeout(function () { if (!settled) { settled = true; resolve(); } }, 5000);
    auth.onAuthStateChanged(function (user) {
      var done = function () {
        listeners.forEach(function (fn) { fn(profile); });
        if (!settled) { settled = true; resolve(); }
      };
      if (!user) { profile = null; return done(); }
      var ref = userRef(user.uid);
      ref.get().then(function (snap) {
        if (!snap.exists) {
          // New accounts start as pending Soldiers until an admin approves them.
          var fresh = {
            name: (user.displayName || '').slice(0, 40), rank: '', unit: '',
            role: 'soldier', status: 'pending', points: 0, theme: 'black-gold', createdAt: now()
          };
          return ref.set(fresh).then(function () {
            return metaRef(user.uid).set({ email: user.email || '', learned: {}, daily: {} });
          }).then(function () { return fresh; });
        }
        return snap.data();
      }).then(function (data) {
        profile = Object.assign({ uid: user.uid }, data);
        return metaRef(user.uid).get().then(function (m) {
          if (m.exists) meta = Object.assign({ learned: {}, daily: {} }, m.data());
        });
      }).catch(function (e) {
        console.warn('Profile load failed', e);
        profile = { uid: user.uid, name: user.displayName || '', status: 'pending', role: 'soldier', points: 0 };
      }).then(done);
    });
  });

  Store.user = function () { return profile; };
  Store.onAuth = function (fn) { listeners.push(fn); };

  Store.signIn = function () {
    var provider = new fb.auth.GoogleAuthProvider();
    return auth.signInWithPopup(provider).catch(function (e) {
      var code = e && e.code;
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        return auth.signInWithRedirect(provider);
      }
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return null;
      throw e;
    });
  };

  Store.signOut = function () { return auth.signOut(); };

  // Soldiers may edit only their own name, rank, unit and theme. Role, status and
  // points are protected by firestore.rules.
  Store.saveProfile = function (fields) {
    var allowed = {};
    ['name', 'rank', 'unit', 'theme'].forEach(function (k) { if (k in fields) allowed[k] = fields[k]; });
    Object.assign(profile, allowed);
    return userRef().update(allowed).then(function () { return profile; });
  };

  // ---------- answers and points ----------

  function listSub(name) {
    return userRef().collection(name).get().then(function (snap) {
      return snap.docs.map(function (d) {
        var v = d.data();
        return Object.assign({}, v, { at: v.at && v.at.toMillis ? v.at.toMillis() : Date.now() });
      });
    });
  }

  Store.attempts = function () { return listSub('attempts'); };
  Store.ledger = function () { return listSub('ledger'); };

  Store.addAttempts = function (list) {
    var batch = db.batch();
    list.forEach(function (a) {
      batch.set(userRef().collection('attempts').doc(), Object.assign({}, a, { at: now() }));
    });
    return batch.commit();
  };

  Store.addPoints = function (entries) {
    var total = entries.reduce(function (s, e) { return s + e.pts; }, 0);
    if (!entries.length) return Promise.resolve(profile.points || 0);
    // Zero-point entries still go in the ledger (e.g. a board sat after the daily points cap).
    var batch = db.batch();
    entries.forEach(function (e) {
      batch.set(userRef().collection('ledger').doc(), Object.assign({}, e, { at: now() }));
    });
    if (total) batch.update(userRef(), { points: inc(total) });
    return batch.commit().then(function () {
      profile.points = (profile.points || 0) + total;
      return profile.points;
    });
  };

  Store.learned = function () { return Promise.resolve(Object.assign({}, meta.learned)); };

  Store.setLearned = function (qid, on) {
    if (on) meta.learned[qid] = true; else delete meta.learned[qid];
    var upd = {};
    upd['learned.' + qid] = on ? true : fb.firestore.FieldValue.delete();
    return metaRef().update(upd);
  };

  Store.daily = function () { return Promise.resolve(Object.assign({}, meta.daily)); };

  Store.saveDaily = function (date, result) {
    meta.daily[date] = result;
    var upd = {};
    upd['daily.' + date] = result;
    return metaRef().update(upd);
  };

  // ---------- workouts ----------

  Store.workouts = function (uid) {
    return userRef(uid).collection('workouts').orderBy('date', 'desc').limit(500).get().then(function (snap) {
      return snap.docs.map(function (d) {
        var v = d.data();
        return Object.assign({ id: d.id }, v, { at: v.at && v.at.toMillis ? v.at.toMillis() : Date.now() });
      });
    });
  };

  Store.addWorkout = function (w) {
    var ref = userRef().collection('workouts').doc();
    return ref.set(Object.assign({}, w, { at: now() })).then(function () {
      return Object.assign({ id: ref.id, at: Date.now() }, w);
    });
  };

  // ---------- discussion board ----------
  //   threads/{id}                 channel, title, body, author, reply count, Hooahs, pinned, hidden
  //   threads/{id}/replies/{rid}   body, author, Hooahs, hidden

  function withTimes(d) {
    var v = d.data();
    return Object.assign({ id: d.id }, v, {
      at: v.at && v.at.toMillis ? v.at.toMillis() : Date.now(),
      lastAt: v.lastAt && v.lastAt.toMillis ? v.lastAt.toMillis() : Date.now()
    });
  }

  function byline() { return ((profile.rank ? profile.rank + ' ' : '') + (profile.name || '')).trim(); }

  Store.threads = function (channel) {
    var q = db.collection('threads');
    if (channel) q = q.where('channel', '==', channel);
    return q.limit(200).get().then(function (snap) { return snap.docs.map(withTimes); });
  };

  Store.thread = function (id) {
    var ref = db.collection('threads').doc(id);
    return ref.get().then(function (snap) {
      if (!snap.exists) return null;
      return ref.collection('replies').orderBy('at').limit(500).get().then(function (r) {
        return { thread: withTimes(snap), replies: r.docs.map(withTimes) };
      });
    });
  };

  Store.addThread = function (fields, id) {
    var ref = id ? db.collection('threads').doc(id) : db.collection('threads').doc();
    return ref.set(Object.assign({}, fields, {
      byUid: profile.uid, by: byline(), at: now(), lastAt: now(), replies: 0, hooah: {}, pinned: false, hidden: false
    })).then(function () { return ref.id; });
  };

  Store.addReply = function (threadId, body) {
    var tRef = db.collection('threads').doc(threadId);
    var batch = db.batch();
    batch.set(tRef.collection('replies').doc(), { body: body, byUid: profile.uid, by: byline(), at: now(), hooah: {}, hidden: false });
    batch.update(tRef, { replies: inc(1), lastAt: now() });
    return batch.commit();
  };

  Store.toggleHooah = function (threadId, replyId) {
    var ref = db.collection('threads').doc(threadId);
    if (replyId) ref = ref.collection('replies').doc(replyId);
    return ref.get().then(function (snap) {
      var on = !!((snap.data() || {}).hooah || {})[profile.uid];
      var upd = {};
      upd['hooah.' + profile.uid] = on ? fb.firestore.FieldValue.delete() : true;
      return ref.update(upd);
    });
  };

  Store.moderate = function (threadId, replyId, fields) {
    var ref = db.collection('threads').doc(threadId);
    if (replyId) ref = ref.collection('replies').doc(replyId);
    return ref.update(fields);
  };

  // ---------- question error reports ----------

  Store.addReport = function (r) {
    return db.collection('reports').add(Object.assign({}, r, {
      status: 'open', at: now(), byUid: profile.uid, by: (profile.rank ? profile.rank + ' ' : '') + (profile.name || '')
    }));
  };

  Store.reports = function () {
    return db.collection('reports').orderBy('at', 'desc').limit(200).get().then(function (snap) {
      return snap.docs.map(function (d) {
        var v = d.data();
        return Object.assign({ id: d.id }, v, { at: v.at && v.at.toMillis ? v.at.toMillis() : Date.now() });
      });
    });
  };

  Store.resolveReport = function (id, status) {
    return db.collection('reports').doc(id).update({ status: status, resolvedBy: profile.uid, resolvedAt: now() });
  };

  // ---------- people ----------

  Store.leaderboard = function () {
    return db.collection('users').where('status', '==', 'approved').get().then(function (snap) {
      return snap.docs.map(function (d) { return Object.assign({ uid: d.id }, d.data()); })
        .sort(function (a, b) { return (b.points || 0) - (a.points || 0); });
    });
  };

  // Admin view: everyone, with email from the private doc so pending accounts can be recognized.
  Store.users = function () {
    return db.collection('users').get().then(function (snap) {
      var people = snap.docs.map(function (d) { return Object.assign({ uid: d.id }, d.data()); });
      return Promise.all(people.map(function (p) {
        return metaRef(p.uid).get().then(function (m) {
          p.email = m.exists ? m.data().email : '';
          return p;
        }).catch(function () { return p; });
      }));
    });
  };

  Store.updateUser = function (uid, fields) {
    return userRef(uid).update(fields);
  };
})();
