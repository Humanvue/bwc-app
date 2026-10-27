// Squad discussion board: channels, threads, replies, Hooahs, leader moderation and
// "Discuss this question" threads. No private messages: everything is visible to the unit.
// Routes: #/squad[/channel], #/squad/new/<channel>, #/thread/<id>.
(function () {
  var CHANNELS = [
    { id: 'announcements', name: 'Announcements', leadersOnly: true },
    { id: 'board-prep', name: 'Board Prep' },
    { id: 'fitness', name: 'Fitness' },
    { id: 'land-nav', name: 'Land Nav' },
    { id: 'weapons', name: 'Weapons & WTBDs' },
    { id: 'general', name: 'General' }
  ];

  var OPSEC = 'OPSEC: no locations, dates or times of training or the competition, no details about other units, and no photos with maps. Keep it professional; leaders can see everything.';

  function U() { return BWC.UI; }
  function app() { return document.getElementById('app'); }
  function channelById(id) { return CHANNELS.filter(function (c) { return c.id === id; })[0]; }
  function isLeader() { var r = U().S.user.role; return r === 'leader' || r === 'admin'; }

  function ago(ms) {
    var s = Math.max(0, (Date.now() - ms) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 604800) return Math.floor(s / 86400) + 'd ago';
    return new Date(ms).toLocaleDateString();
  }

  // Escape, keep line breaks, and highlight @mentions.
  function body(text) {
    return U().esc(text).replace(/(^|\s)(@[A-Za-z][\w.-]{1,30})/g, '$1<strong class="mention">$2</strong>').replace(/\n/g, '<br>');
  }

  function hooahBtn(item, threadId, replyId) {
    var u = U();
    var count = Object.keys(item.hooah || {}).length;
    var mine = !!(item.hooah || {})[u.S.user.uid];
    return '<button type="button" class="btn small ghost hooah' + (mine ? ' on' : '') + '" data-hooah="' + u.esc(threadId) + '"' +
      (replyId ? ' data-reply="' + u.esc(replyId) + '"' : '') + ' aria-pressed="' + mine + '">' + u.icon('star', 16) + 'Hooah' + (count ? ' · ' + count : '') + '</button>';
  }

  function chips(active) {
    var u = U();
    return '<div class="chips" role="tablist" aria-label="Channels">' + [{ id: '', name: 'All' }].concat(CHANNELS).map(function (c) {
      var on = (active || '') === c.id;
      return '<a role="tab" aria-selected="' + on + '" class="chip-link' + (on ? ' on' : '') + '" href="#/squad' + (c.id ? '/' + c.id : '') + '">' + u.esc(c.name) + '</a>';
    }).join('') + '</div>';
  }

  // ---------- thread list ----------

  function viewList(channel) {
    var u = U();
    var ch = channelById(channel);
    var canPost = !ch || !ch.leadersOnly || isLeader();
    app().innerHTML = '<div class="row"><h1 class="grow">Squad</h1><a class="btn small ghost" href="#/leaderboard">' + u.icon('trophy', 18) + 'Leaderboard</a></div>' +
      chips(channel) +
      (canPost ? '<a class="btn" href="#/squad/new/' + (channel || 'general') + '">' + u.icon('chat', 18) + 'New post' + (ch ? ' in ' + u.esc(ch.name) : '') + '</a>' : '<p class="muted small">Only leaders post announcements.</p>') +
      '<div class="card" id="threads"><p class="muted">Loading…</p></div>';
    BWC.Store.threads(channel || null).then(function (list) {
      var el = document.getElementById('threads');
      if (!el) return;
      list = list.filter(function (t) { return !t.hidden || isLeader(); })
        .sort(function (a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.lastAt - a.lastAt; });
      el.innerHTML = list.length ? '<div class="list">' + list.map(function (t) {
        var c = channelById(t.channel) || { name: t.channel };
        return '<a class="list-row" href="#/thread/' + encodeURIComponent(t.id) + '"><div class="grow">' +
          '<div style="font-weight:700">' + (t.pinned ? u.icon('flag', 14) + ' ' : '') + u.esc(t.title) + (t.hidden ? ' <span class="chip bad">Hidden</span>' : '') + '</div>' +
          '<div class="muted small">' + (channel ? '' : u.esc(c.name) + ' · ') + u.esc(t.by) + ' · ' + ago(t.lastAt) + '</div></div>' +
          '<span class="muted small">' + (t.replies || 0) + ' ' + u.icon('chat', 14) + '</span></a>';
      }).join('') + '</div>' : '<p class="muted">Nothing here yet. Start the conversation.</p>';
    }).catch(function () {
      var el = document.getElementById('threads');
      if (el) el.innerHTML = '<p class="muted">Could not load posts. Check your connection.</p>';
    });
  }

  // ---------- new post ----------

  function viewNew(channel) {
    var u = U();
    var choices = CHANNELS.filter(function (c) { return !c.leadersOnly || isLeader(); });
    if (!choices.some(function (c) { return c.id === channel; })) channel = 'general';
    app().innerHTML = u.header('New post', '#/squad/' + channel) +
      '<form class="card" id="np-form">' +
      '<label class="field">Channel<select class="input" id="np-ch">' + choices.map(function (c) {
        return '<option value="' + c.id + '"' + (c.id === channel ? ' selected' : '') + '>' + u.esc(c.name) + '</option>';
      }).join('') + '</select></label>' +
      '<label class="field">Title<input class="input" id="np-title" maxlength="140" required></label>' +
      '<label class="field">Message<textarea class="input" id="np-body" rows="6" maxlength="4000" placeholder="Use @Name to mention someone."></textarea></label>' +
      '<p class="opsec small">' + u.esc(OPSEC) + '</p>' +
      '<button class="btn" type="submit">Post</button></form>';
    document.getElementById('np-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = this.querySelector('button[type=submit]');
      btn.disabled = true;
      BWC.Store.addThread({
        channel: document.getElementById('np-ch').value,
        title: document.getElementById('np-title').value.trim(),
        body: document.getElementById('np-body').value.trim()
      }).then(function (id) { location.hash = '#/thread/' + encodeURIComponent(id); })
        .catch(function () { btn.disabled = false; u.toast('Could not post. Try again.'); });
    });
  }

  // ---------- thread ----------

  // quiet: redraw in place (after a Hooah, reply or moderation) without a loading flash.
  function viewThread(id, quiet) {
    var u = U();
    var y = window.scrollY;
    if (!quiet) app().innerHTML = u.header('Thread', '#/squad') + '<div class="card"><p class="muted">Loading…</p></div>';
    BWC.Store.thread(id).then(function (res) {
      if (quiet) setTimeout(function () { window.scrollTo(0, y); }, 0);
      if (!res) { app().innerHTML = u.header('Thread', '#/squad') + '<div class="card"><p>This thread does not exist.</p></div>'; return; }
      var t = res.thread;
      var c = channelById(t.channel) || { name: t.channel };
      var leader = isLeader();
      if (t.hidden && !leader) { app().innerHTML = u.header('Thread', '#/squad') + '<div class="card"><p>A leader hid this thread.</p></div>'; return; }
      var replies = res.replies.filter(function (r) { return !r.hidden || leader; });
      var q = t.qid ? (window.BWC_QUESTIONS || []).filter(function (x) { return x.id === t.qid; })[0] : null;

      app().innerHTML = u.header(c.name, '#/squad/' + t.channel) +
        '<article class="card"><div class="row wrap">' + (t.pinned ? '<span class="chip">Pinned</span>' : '') + (t.hidden ? '<span class="chip bad">Hidden</span>' : '') +
        '<span class="muted small grow">' + u.esc(t.by) + ' · ' + ago(t.at) + '</span></div>' +
        '<h2>' + u.esc(t.title) + '</h2>' + (t.body ? '<div>' + body(t.body) + '</div>' : '') +
        (q ? '<div class="quote">Answer: ' + u.esc(q.answer) + ' (' + u.esc(q.pub) + (q.para ? ', para ' + u.esc(q.para) : '') + ')</div><div class="row wrap">' + u.sourceLink(q.pub, q.page, 'Open source') + '</div>' : '') +
        '<div class="row wrap">' + hooahBtn(t, t.id) +
        (leader ? '<button type="button" class="btn small ghost" data-mod="pinned" data-val="' + !t.pinned + '">' + (t.pinned ? 'Unpin' : 'Pin') + '</button>' +
          '<button type="button" class="btn small ghost" data-mod="hidden" data-val="' + !t.hidden + '">' + (t.hidden ? 'Unhide' : 'Hide') + '</button>' : '') +
        (t.byUid !== u.S.user.uid ? '<button type="button" class="link-btn" data-report-post="">Report</button>' : '') + '</div></article>' +
        '<h2>' + replies.length + ' repl' + (replies.length === 1 ? 'y' : 'ies') + '</h2>' +
        replies.map(function (r) {
          return '<div class="card reply"><div class="row wrap"><strong>' + u.esc(r.by) + '</strong><span class="muted small grow">' + ago(r.at) + '</span>' +
            (r.hidden ? '<span class="chip bad">Hidden</span>' : '') + '</div><div>' + body(r.body) + '</div>' +
            '<div class="row wrap">' + hooahBtn(r, t.id, r.id) +
            (leader ? '<button type="button" class="btn small ghost" data-mod="hidden" data-reply="' + u.esc(r.id) + '" data-val="' + !r.hidden + '">' + (r.hidden ? 'Unhide' : 'Hide') + '</button>' : '') +
            (r.byUid !== u.S.user.uid ? '<button type="button" class="link-btn" data-report-post="' + u.esc(r.id) + '">Report</button>' : '') + '</div></div>';
        }).join('') +
        '<form class="card" id="rp-form"><label class="field" for="rp-body">Reply</label>' +
        '<textarea class="input" id="rp-body" rows="3" maxlength="2000" required placeholder="Use @Name to mention someone."></textarea>' +
        '<p class="opsec small">' + u.esc(OPSEC) + '</p><button class="btn" type="submit">Reply</button></form>';

      document.getElementById('rp-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var text = document.getElementById('rp-body').value.trim();
        if (!text) return;
        var btn = this.querySelector('button[type=submit]');
        btn.disabled = true;
        BWC.Store.addReply(t.id, text).then(function () { viewThread(id, true); })
          .catch(function () { btn.disabled = false; u.toast('Could not reply. Try again.'); });
      });
      app().querySelectorAll('[data-mod]').forEach(function (b) {
        b.addEventListener('click', function () {
          var f = {};
          f[b.getAttribute('data-mod')] = b.getAttribute('data-val') === 'true';
          BWC.Store.moderate(t.id, b.getAttribute('data-reply') || null, f).then(function () { viewThread(id, true); })
            .catch(function () { u.toast('Leaders only.'); });
        });
      });
      app().querySelectorAll('[data-report-post]').forEach(function (b) {
        b.addEventListener('click', function () { reportPost(t, b.getAttribute('data-report-post') || null, replies); });
      });
    });
  }

  function reportPost(t, replyId, replies) {
    var u = U();
    var text = replyId ? (replies.filter(function (r) { return r.id === replyId; })[0] || {}).body : t.title;
    var wrap = document.createElement('div');
    wrap.className = 'sheet-wrap';
    wrap.innerHTML = '<form class="sheet" role="dialog" aria-label="Report a post"><h2>Report a post</h2>' +
      '<p class="muted small">"' + u.esc(String(text || '').slice(0, 160)) + '"</p>' +
      '<label class="field">Reason<select class="input" id="rpp-reason">' +
      ['OPSEC concern', 'Unprofessional or disrespectful', 'Wrong information', 'Something else'].map(function (r) { return '<option>' + r + '</option>'; }).join('') +
      '</select></label><label class="field">Details (optional)<textarea class="input" id="rpp-comment" maxlength="1000"></textarea></label>' +
      '<div class="row"><button type="button" class="btn ghost" id="rpp-cancel">Cancel</button><button type="submit" class="btn grow">Send to leaders</button></div></form>';
    document.body.appendChild(wrap);
    var close = function () { wrap.remove(); };
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    wrap.querySelector('#rpp-cancel').addEventListener('click', close);
    wrap.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      BWC.Store.addReport({
        kind: 'post', threadId: t.id, replyId: replyId, question: 'Post: ' + String(text || '').slice(0, 200), pub: 'Discussion board',
        reason: wrap.querySelector('#rpp-reason').value, comment: wrap.querySelector('#rpp-comment').value.trim()
      }).then(function () { close(); u.toast('Sent to leaders.'); }).catch(function () { u.toast('Could not send. Try again.'); });
    });
  }

  // "Discuss this question": one shared thread per question in Board Prep.
  function discuss(qid) {
    var u = U();
    var q = (window.BWC_QUESTIONS || []).filter(function (x) { return x.id === qid; })[0];
    if (!q) return;
    var id = 'q-' + qid;
    BWC.Store.thread(id).then(function (res) {
      if (res) return id;
      return BWC.Store.addThread({ channel: 'board-prep', title: q.q, body: 'Discussion of this study question.', qid: qid }, id);
    }).then(function (tid) { location.hash = '#/thread/' + encodeURIComponent(tid); })
      .catch(function () { u.toast('Could not open the discussion. Try again.'); });
  }

  // One listener for Hooah buttons anywhere on the board.
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-hooah]');
    if (!b) return;
    var tid = b.getAttribute('data-hooah');
    BWC.Store.toggleHooah(tid, b.getAttribute('data-reply') || null).then(function () { viewThread(tid, true); });
  });

  BWC.Discussion = { list: viewList, newPost: viewNew, thread: viewThread, discuss: discuss, channels: CHANNELS };
})();
