// 25 m zero adjustment drill (M4 iron sights / BUIS). A 3-round group lands off center on the
// zero target; the Soldier gives the front sight (elevation) and rear sight (windage) corrections.
// Rules from STP 21-1-SMCT Task 071-COM-0031 (verified quotes in drills-data.js):
//   front sight post: 1 click = 1 square; clockwise moves the strike DOWN, counterclockwise UP
//   rear sight:       3 clicks = 1 square; counterclockwise moves the strike LEFT, clockwise RIGHT
(function () {
  var SQ = 22;        // drawn size of one target square in px
  var N = 13;         // target is N x N squares, center square in the middle

  function U() { return BWC.UI; }
  function app() { return document.getElementById('app'); }
  function facts() { return ((window.BWC_DRILLS || {}).zero || {}).facts || []; }

  // The correction that brings a group at (dx right, dy up) squares back to center.
  function answer(dx, dy) {
    return {
      elev: { dir: dy > 0 ? 'cw' : dy < 0 ? 'ccw' : 'none', clicks: Math.abs(dy) },
      wind: { dir: dx > 0 ? 'ccw' : dx < 0 ? 'cw' : 'none', clicks: Math.abs(dx) * 3 }
    };
  }

  function target(dx, dy, shots) {
    var size = SQ * N, c = size / 2;
    var lines = '';
    for (var i = 0; i <= N; i++) {
      var p = i * SQ;
      lines += '<line x1="' + p + '" y1="0" x2="' + p + '" y2="' + size + '"></line><line x1="0" y1="' + p + '" x2="' + size + '" y2="' + p + '"></line>';
    }
    var r4 = SQ * 1.55; // 4 cm circle on the M4 target (1.3 cm squares)
    return '<svg class="zero-target" viewBox="-4 -4 ' + (size + 8) + ' ' + (size + 8) + '" role="img" aria-label="25 meter zero target with a three round shot group">' +
      '<rect x="0" y="0" width="' + size + '" height="' + size + '" fill="#fff"></rect>' +
      '<g stroke="#9aa3ad" stroke-width="1">' + lines + '</g>' +
      '<line x1="' + c + '" y1="0" x2="' + c + '" y2="' + size + '" stroke="#111" stroke-width="1.5"></line>' +
      '<line x1="0" y1="' + c + '" x2="' + size + '" y2="' + c + '" stroke="#111" stroke-width="1.5"></line>' +
      '<circle cx="' + c + '" cy="' + c + '" r="' + r4 + '" fill="none" stroke="#111" stroke-width="2"></circle>' +
      '<rect x="' + (c - SQ * 0.6) + '" y="' + (c - SQ * 1.6) + '" width="' + (SQ * 1.2) + '" height="' + (SQ * 3.2) + '" fill="#111" opacity="0.85"></rect>' +
      shots.map(function (s) {
        return '<circle cx="' + (c + (dx + s[0]) * SQ) + '" cy="' + (c - (dy + s[1]) * SQ) + '" r="6" fill="#dc2626" stroke="#fff" stroke-width="2"></circle>';
      }).join('') + '</svg>';
  }

  function sel(id, label, opts) {
    return '<label class="field">' + label + '<select class="input" id="' + id + '">' + opts.map(function (o) {
      return '<option value="' + o[0] + '">' + o[1] + '</option>';
    }).join('') + '</select></label>';
  }

  function view() {
    var u = U();
    var F = facts();
    if (F.length < 2) { location.hash = '#/drills#weapons'; return; }
    var dx = 0, dy = 0;
    while (dx === 0 && dy === 0) { dx = Math.floor(Math.random() * 9) - 4; dy = Math.floor(Math.random() * 9) - 4; }
    // A tight group: three rounds within about a square of the group's center.
    var shots = [[-0.4, 0.3], [0.35, 0.25], [0.05, -0.4]].map(function (s) { return [s[0] + (Math.random() - 0.5) * 0.3, s[1] + (Math.random() - 0.5) * 0.3]; });
    var ans = answer(dx, dy);
    var dirs = [['none', 'No change'], ['cw', 'Clockwise'], ['ccw', 'Counterclockwise']];
    var clicks = [];
    for (var i = 0; i <= 15; i++) clicks.push([String(i), i + (i === 1 ? ' click' : ' clicks')]);

    app().innerHTML = '<div class="row"><a class="btn small ghost" href="#/drills#weapons" aria-label="Back">' + u.icon('back', 18) + '</a><h1 class="grow">25 m zero adjustments</h1></div>' +
      '<p class="muted">Your 3-round group at 25 m is shown in red. Give the corrections that move it to the center of the target. Count from the center of the group to the center of the target.</p>' +
      '<div class="card zero-card">' + target(dx, dy, shots) + '</div>' +
      '<form class="card" id="zr-form"><h3>Front sight post (elevation)</h3><div class="row wrap">' + sel('zr-ed', 'Turn', dirs) + sel('zr-ec', 'Clicks', clicks) + '</div>' +
      '<h3>Rear sight (windage)</h3><div class="row wrap">' + sel('zr-wd', 'Turn', dirs) + sel('zr-wc', 'Clicks', clicks) + '</div>' +
      '<button class="btn" type="submit">Check</button></form><div id="zr-result"></div>';

    document.getElementById('zr-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var g = function (id) { return document.getElementById(id).value; };
      var elevOk = g('zr-ed') === ans.elev.dir && +g('zr-ec') === ans.elev.clicks;
      var windOk = g('zr-wd') === ans.wind.dir && +g('zr-wc') === ans.wind.clicks;
      // "No change" with any click count, or 0 clicks with a direction, both mean no change.
      if (ans.elev.dir === 'none') elevOk = g('zr-ed') === 'none' || +g('zr-ec') === 0;
      if (ans.wind.dir === 'none') windOk = g('zr-wd') === 'none' || +g('zr-wc') === 0;
      var ok = elevOk && windOk;
      this.querySelector('button[type=submit]').disabled = true;
      function say(a, kind) { return a.dir === 'none' ? 'no change' : (a.dir === 'cw' ? 'clockwise ' : 'counterclockwise ') + a.clicks + ' click' + (a.clicks === 1 ? '' : 's'); }
      var where = (dy ? Math.abs(dy) + ' square' + (Math.abs(dy) === 1 ? '' : 's') + (dy > 0 ? ' high' : ' low') : '') + (dy && dx ? ' and ' : '') +
        (dx ? Math.abs(dx) + ' square' + (Math.abs(dx) === 1 ? '' : 's') + (dx > 0 ? ' right' : ' left') : '');
      var src = F[1] || F[0];
      BWC.Drills.record('zero', ok).then(function (pts) {
        document.getElementById('zr-result').innerHTML = '<div class="card ' + (ok ? 'pass' : '') + '"><div class="row"><h2 class="grow">' + (ok ? 'GO' : 'NO-GO') + '</h2></div>' +
          '<p>The group is <strong>' + where + '</strong>.</p>' +
          '<div class="list"><div class="list-row"><span class="grow">Front sight post</span><span class="chip ' + (elevOk ? 'good' : 'bad') + '">' + say(ans.elev) + '</span></div>' +
          '<div class="list-row"><span class="grow">Rear sight</span><span class="chip ' + (windOk ? 'good' : 'bad') + '">' + say(ans.wind) + '</span></div></div>' +
          '<p class="small">Front sight post: 1 click moves the strike 1 square; clockwise moves it down. Rear sight: 3 clicks move it 1 square; counterclockwise moves it left.</p>' +
          F.slice(1, 3).map(function (f) { return '<div class="quote">"' + u.esc(f.quote) + '"</div>'; }).join('') +
          BWC.Drills.cite(src) + (pts ? '<p class="small">+' + pts + ' points</p>' : '') +
          '<button type="button" class="btn" id="zr-again">Next group</button></div>';
        document.getElementById('zr-again').addEventListener('click', view);
      });
    });
  }

  BWC.Zero = { view: view, answer: answer };
})();
