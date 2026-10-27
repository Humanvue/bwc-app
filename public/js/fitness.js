// Fitness log: record workouts with or without a wearable screenshot, earn points,
// unlock vehicles with ruck miles, and track AFT practice results.
// Routes: #/fitness (summary), #/fitness/new (log), #/fitness/aft (AFT trends).
(function () {
  var C = window.BWC_CONFIG;
  var F = C.fitness;
  var P = BWC.Progress;

  function U() { return BWC.UI; }
  function app() { return document.getElementById('app'); }
  function typeById(id) { return F.types.filter(function (t) { return t.id === id; })[0] || F.types[F.types.length - 1]; }

  function dayStr(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function toDay(ms) { return dayStr(new Date(ms || Date.now())); }

  // "4:05" -> 245 seconds; plain numbers pass through.
  function parseTime(s) {
    s = String(s || '').trim();
    if (!s) return null;
    if (s.indexOf(':') >= 0) {
      var p = s.split(':');
      var m = parseInt(p[0], 10), sec = parseInt(p[1], 10);
      return isNaN(m) || isNaN(sec) ? null : m * 60 + sec;
    }
    var n = parseFloat(s);
    return isNaN(n) ? null : n;
  }
  function fmtTime(sec) { return Math.floor(sec / 60) + ':' + String(Math.round(sec % 60)).padStart(2, '0'); }

  // Base points for a workout before the daily cap.
  function pointsFor(w) {
    var base = Math.floor((w.minutes || 0) / 10) * F.perTenMinutes;
    var pts = base * typeById(w.type).mult;
    if (w.shot) pts *= 1 + F.screenshotBonus;
    return Math.round(pts);
  }

  function usedToday() {
    var t = P.today();
    return U().S.ledger.filter(function (e) { return e.kind === 'fitness' && toDay(e.at) === t; })
      .reduce(function (s, e) { return s + e.pts; }, 0);
  }

  function ruckMiles(list) {
    return list.filter(function (w) { return w.type === 'ruck'; }).reduce(function (s, w) { return s + (w.miles || 0); }, 0);
  }

  function load() {
    var S = U().S;
    if (S.workouts) return Promise.resolve(S.workouts);
    return BWC.Store.workouts().then(function (list) { S.workouts = list; return list; });
  }

  // Shrink a screenshot to a small JPEG. Re-drawing it on a canvas also drops the photo's
  // hidden metadata, including any GPS location.
  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = reject;
      reader.onload = function () {
        var img = new Image();
        img.onerror = reject;
        img.onload = function () {
          var max = 640;
          var scale = Math.min(1, max / Math.max(img.width, img.height));
          var c = document.createElement('canvas');
          c.width = Math.round(img.width * scale);
          c.height = Math.round(img.height * scale);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          var q = 0.7, data = c.toDataURL('image/jpeg', q);
          while (data.length > 250000 && q > 0.3) { q -= 0.1; data = c.toDataURL('image/jpeg', q); }
          resolve(data);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // ---------- summary ----------

  function viewSummary() {
    var u = U();
    app().innerHTML = u.header('Fitness', '#/') + '<div class="card"><p class="muted">Loading…</p></div>';
    load().then(function (list) {
      var week = P.weekDates();
      var thisWeek = list.filter(function (w) { return week.indexOf(w.date) >= 0; });
      var minutes = thisWeek.reduce(function (s, w) { return s + (w.minutes || 0); }, 0);
      var miles = ruckMiles(list);
      var next = F.vehicles.filter(function (v) { return miles < v.need; })[0];
      var recent = list.slice().sort(function (a, b) { return (b.date + b.at) > (a.date + a.at) ? 1 : -1; }).slice(0, 15);

      app().innerHTML = u.header('Fitness', '#/') +
        '<div class="banner"><div class="grow"><div class="eyebrow">This week</div><div class="big">' + minutes + ' MIN</div>' +
        '<div class="small" style="font-weight:700">' + thisWeek.length + ' workout' + (thisWeek.length === 1 ? '' : 's') + ' · ' +
        miles.toFixed(1) + ' total ruck miles</div></div>' + u.icon('fitness', 60, 1.8) + '</div>' +
        '<div class="row wrap"><a class="btn grow" href="#/fitness/new">' + u.icon('fitness', 18) + 'Log a workout</a>' +
        '<a class="btn ghost grow" href="#/fitness/aft">AFT practice</a></div>' +
        '<div class="card"><div class="row"><h2 class="grow">Vehicles</h2><span class="muted small">Unlocked by ruck miles</span></div>' +
        (next ? '<div class="small">' + (next.need - miles).toFixed(1) + ' miles to the <strong>' + u.esc(next.name) + '</strong></div>' +
          '<div class="bar"><span style="width:' + Math.min(100, Math.round(miles / next.need * 100)) + '%"></span></div>' : '<div class="small"><strong>Every vehicle unlocked.</strong></div>') +
        '<div class="vehicles">' + F.vehicles.map(function (v) {
          var on = miles >= v.need;
          return '<div class="vehicle' + (on ? ' on' : '') + '">' + vehicleIcon(v.kind) + '<span class="name">' + u.esc(v.name) + '</span><span class="small">' +
            (on ? 'Unlocked' : v.need + ' mi') + '</span></div>';
        }).join('') + '</div></div>' +
        '<div class="card"><h2>Recent workouts</h2>' + (recent.length ? '<div class="list">' + recent.map(function (w) {
          return '<div class="list-row"><div class="grow"><div><strong>' + u.esc(typeById(w.type).name) + '</strong> · ' + w.minutes + ' min' +
            (w.miles ? ' · ' + w.miles + ' mi' : '') + (w.weight ? ' · ' + w.weight + ' lb' : '') + '</div>' +
            '<div class="muted small">' + u.esc(w.date) + (w.notes ? ' · ' + u.esc(w.notes) : '') + '</div></div>' +
            (w.shot ? '<span class="chip">' + (w.review === 'verified' ? 'Verified' : w.review === 'flagged' ? 'Flagged' : 'Screenshot') + '</span>' : '') +
            '<span class="mono small">+' + (w.pts || 0) + '</span></div>';
        }).join('') + '</div>' : '<p class="muted">No workouts yet. Log your first one; no watch needed.</p>') + '</div>' +
        '<p class="muted small">' + F.perTenMinutes + ' point per 10 minutes. Rucks ×' + typeById('ruck').mult + ', AFT practice ×' + typeById('aft').mult +
        ', screenshot +' + Math.round(F.screenshotBonus * 100) + '%. Up to ' + F.dailyCap + ' fitness points a day.</p>';
    });
  }

  var VEHICLE_PATHS = {
    truck: 'M2 7h11v9H2z M13 10h5l3 3v3h-8z M6 20a2 2 0 1 0 0-4a2 2 0 1 0 0 4z M17 20a2 2 0 1 0 0-4a2 2 0 1 0 0 4z',
    apc: 'M2 10h15l4 3v4H2z M7 10V7h6v3 M5 20a2 2 0 1 0 0-4a2 2 0 1 0 0 4z M11 20a2 2 0 1 0 0-4a2 2 0 1 0 0 4z M17 20a2 2 0 1 0 0-4a2 2 0 1 0 0 4z',
    tank: 'M3 14h18l-2 5H5z M7 10h8v4H7z M15 11h7 M6 19v0 M10 19v0 M14 19v0 M18 19v0',
    heli: 'M3 5h18 M12 5v3 M6 12a4 4 0 0 1 4-4h5a4 4 0 0 1 0 8h-5a4 4 0 0 1-4-4z M6 12H2 M2 10v4 M9 20h8 M11 16v4 M15 16v4'
  };

  function vehicleIcon(kind) {
    return '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="' + (VEHICLE_PATHS[kind] || VEHICLE_PATHS.truck) + '"></path></svg>';
  }

  // ---------- log a workout ----------

  function viewNew() {
    var u = U();
    var today = new Date();
    var min = new Date(today.getFullYear(), today.getMonth(), today.getDate() - F.backdateDays);
    var shot = null;

    app().innerHTML = u.header('Log a workout', '#/fitness') +
      '<form class="card" id="fx-form">' +
      '<label class="field">Type<select class="input" id="fx-type">' + F.types.map(function (t) {
        return '<option value="' + t.id + '">' + u.esc(t.name) + '</option>';
      }).join('') + '</select></label>' +
      '<div class="row wrap"><label class="field grow">Date<input class="input" type="date" id="fx-date" value="' + dayStr(today) + '" min="' + dayStr(min) + '" max="' + dayStr(today) + '" required></label>' +
      '<label class="field grow">Minutes<input class="input" type="number" id="fx-min" min="1" max="600" inputmode="numeric" required></label></div>' +
      '<div class="row wrap" id="fx-dist-row"><label class="field grow">Distance (miles)<input class="input" type="number" id="fx-mi" min="0" max="100" step="0.1" inputmode="decimal"></label>' +
      '<label class="field grow" id="fx-wt-wrap" hidden>Ruck weight (lb)<input class="input" type="number" id="fx-wt" min="0" max="150" inputmode="numeric"></label></div>' +
      '<div id="fx-aft" hidden><p class="small"><strong>AFT practice results</strong> (leave blank what you didn\'t do)</p><div class="aft-grid">' +
      F.aftEvents.map(function (e) {
        return '<label class="field">' + u.esc(e.name) + ' <span class="muted">(' + e.unit + ')</span><input class="input" id="fx-aft-' + e.id + '" inputmode="' + (e.unit === 'm:ss' ? 'text' : 'numeric') + '" placeholder="' + (e.unit === 'm:ss' ? '3:30' : '') + '"></label>';
      }).join('') + '</div></div>' +
      '<label class="field">Effort: <span id="fx-eff-val">6</span> of 10<input type="range" id="fx-eff" min="1" max="10" value="6"></label>' +
      '<label class="field">Notes (optional)<input class="input" id="fx-notes" maxlength="120" placeholder="e.g. hill repeats, 35 lb ruck"></label>' +
      '<div class="card" style="background:var(--surface-2)"><h3>Screenshot (optional)</h3>' +
      '<p class="small">From Oura, Apple Watch, Garmin, WHOOP or any app. No watch? Skip this; you earn the same base points.</p>' +
      '<p class="small"><strong>OPSEC:</strong> crop out any map or route before uploading. Location data hidden in the photo is removed automatically.</p>' +
      '<input type="file" id="fx-shot" accept="image/*">' +
      '<img id="fx-preview" alt="Screenshot preview" hidden style="max-width:220px;border-radius:12px">' +
      '<label class="row small" id="fx-opsec-wrap" hidden><input type="checkbox" id="fx-opsec"> This screenshot shows no map, route or location.</label></div>' +
      '<div class="row spread"><span class="small">Points for this workout: <strong id="fx-pts">0</strong></span><span class="muted small" id="fx-cap"></span></div>' +
      '<button class="btn" type="submit">Save workout</button></form>';

    var $ = function (id) { return document.getElementById(id); };
    function current() {
      return { type: $('fx-type').value, minutes: parseInt($('fx-min').value, 10) || 0, shot: shot };
    }
    function refresh() {
      var t = $('fx-type').value;
      $('fx-dist-row').hidden = ['run', 'ruck', 'swim', 'other'].indexOf(t) < 0;
      $('fx-wt-wrap').hidden = t !== 'ruck';
      $('fx-aft').hidden = t !== 'aft';
      $('fx-eff-val').textContent = $('fx-eff').value;
      var left = Math.max(0, F.dailyCap - usedToday());
      var pts = pointsFor(current());
      $('fx-pts').textContent = Math.min(pts, left);
      $('fx-cap').textContent = left < pts ? 'Daily cap: ' + left + ' left today' : '';
    }
    ['fx-type', 'fx-min', 'fx-eff'].forEach(function (id) { $(id).addEventListener('input', refresh); });
    refresh();

    $('fx-shot').addEventListener('change', function () {
      var file = this.files && this.files[0];
      if (!file) { shot = null; $('fx-preview').hidden = true; $('fx-opsec-wrap').hidden = true; refresh(); return; }
      shrink(file).then(function (data) {
        shot = data;
        $('fx-preview').src = data;
        $('fx-preview').hidden = false;
        $('fx-opsec-wrap').hidden = false;
        refresh();
      }).catch(function () { u.toast('That image could not be read. Try a PNG or JPEG screenshot.'); });
    });

    $('fx-form').addEventListener('submit', function (e) {
      e.preventDefault();
      if (shot && !$('fx-opsec').checked) { u.toast('Confirm the screenshot shows no map or route, or remove it.'); return; }
      var w = {
        type: $('fx-type').value,
        date: $('fx-date').value,
        minutes: parseInt($('fx-min').value, 10),
        miles: parseFloat($('fx-mi').value) || 0,
        weight: $('fx-type').value === 'ruck' ? (parseInt($('fx-wt').value, 10) || 0) : 0,
        effort: parseInt($('fx-eff').value, 10),
        notes: $('fx-notes').value.trim(),
        shot: shot,
        review: null
      };
      if (!w.minutes || w.minutes < 1) { u.toast('Enter how many minutes.'); return; }
      if (w.type === 'aft') {
        w.aft = {};
        F.aftEvents.forEach(function (ev) {
          var v = parseTime($('fx-aft-' + ev.id).value);
          if (v != null) w.aft[ev.id] = v;
        });
      }
      var left = Math.max(0, F.dailyCap - usedToday());
      w.pts = Math.min(pointsFor(w), left);
      var before = ruckMiles(u.S.workouts || []);
      var btn = this.querySelector('button[type=submit]');
      btn.disabled = true;
      BWC.Store.addWorkout(w).then(function (saved) {
        (u.S.workouts = u.S.workouts || []).push(saved);
        var after = ruckMiles(u.S.workouts);
        var unlocked = F.vehicles.filter(function (v) { return before < v.need && after >= v.need; });
        return u.award(w.pts ? [{ kind: 'fitness', pts: w.pts, ref: w.type }] : []).then(function () {
          u.toast(unlocked.length ? 'Unlocked: ' + unlocked[unlocked.length - 1].name + '!' : 'Workout saved' + (w.pts ? ', +' + w.pts + ' points' : ''));
          location.hash = '#/fitness';
        });
      }).catch(function () { btn.disabled = false; u.toast('Could not save. Check your connection and try again.'); });
    });
  }

  // ---------- AFT practice ----------

  function spark(points, better) {
    if (points.length < 2) return '';
    var w = 220, h = 48, pad = 4;
    var vals = points.map(function (p) { return p.v; });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    var span = hi - lo || 1;
    var xy = points.map(function (p, i) {
      var x = pad + (i / (points.length - 1)) * (w - pad * 2);
      // Draw "better" as up, so improvement always climbs.
      var norm = (p.v - lo) / span;
      var y = pad + (better === 'low' ? norm : 1 - norm) * (h - pad * 2);
      return x.toFixed(1) + ',' + y.toFixed(1);
    });
    var last = xy[xy.length - 1].split(',');
    return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Trend over ' + points.length + ' attempts">' +
      '<polyline points="' + xy.join(' ') + '" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"></polyline>' +
      '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="4" fill="var(--accent)"></circle></svg>';
  }

  function viewAft() {
    var u = U();
    app().innerHTML = u.header('AFT practice', '#/fitness') + '<div class="card"><p class="muted">Loading…</p></div>';
    load().then(function (list) {
      var practice = list.filter(function (w) { return w.type === 'aft' && w.aft; })
        .sort(function (a, b) { return a.date > b.date ? 1 : -1; });
      app().innerHTML = u.header('AFT practice', '#/fitness') +
        '<p class="muted">Raw results from your logged AFT practice. Log one under <strong>Log a workout → AFT practice</strong>.</p>' +
        F.aftEvents.map(function (ev) {
          var pts = practice.filter(function (w) { return w.aft[ev.id] != null; }).map(function (w) { return { d: w.date, v: w.aft[ev.id] }; });
          var fmt = function (v) { return ev.unit === 'm:ss' ? fmtTime(v) : v + ' ' + ev.unit; };
          var best = pts.length ? pts.reduce(function (b, p) { return (ev.better === 'low' ? p.v < b.v : p.v > b.v) ? p : b; }) : null;
          var last = pts[pts.length - 1];
          return '<div class="card"><div class="row"><h3 class="grow">' + u.esc(ev.name) + '</h3><span class="muted small">' + (ev.better === 'low' ? 'lower is better' : 'higher is better') + '</span></div>' +
            (pts.length ? '<div class="row wrap"><span class="chip">Latest ' + fmt(last.v) + '</span><span class="chip good">Best ' + fmt(best.v) + '</span><span class="muted small">' + pts.length + ' logged</span></div>' + spark(pts, ev.better)
              : '<p class="muted small">Nothing logged yet.</p>') + '</div>';
        }).join('') +
        '<p class="muted small">Score your results with the current AFT scoring tables on DA Form 705. Your sponsor can help.</p>';
    });
  }

  function homeStat(list) {
    var week = P.weekDates();
    var mins = (list || []).filter(function (w) { return week.indexOf(w.date) >= 0; }).reduce(function (s, w) { return s + (w.minutes || 0); }, 0);
    return { text: mins ? mins + ' min this week' : 'Log a workout', pct: Math.min(100, Math.round(mins / 150 * 100)) };
  }

  function view(step) {
    if (step === 'new') return viewNew();
    if (step === 'aft') return viewAft();
    return viewSummary();
  }

  BWC.Fitness = { view: view, load: load, homeStat: homeStat, pointsFor: pointsFor, parseTime: parseTime };
})();
