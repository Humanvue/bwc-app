// Map math for land nav drills: latitude/longitude <-> UTM <-> MGRS, and map pixel <-> UTM.
// Pure functions (tested by tools/test_geo.js). WGS 84 ellipsoid, standard UTM formulas.
(function (root) {
  var a = 6378137, f = 1 / 298.257223563, k0 = 0.9996;
  var e2 = f * (2 - f), ep2 = e2 / (1 - e2);

  function toUTM(lat, lon, zone) {
    zone = zone || Math.floor((lon + 180) / 6) + 1;
    var lon0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180;
    var phi = lat * Math.PI / 180, lam = lon * Math.PI / 180;
    var N = a / Math.sqrt(1 - e2 * Math.sin(phi) * Math.sin(phi));
    var T = Math.tan(phi) * Math.tan(phi), Cc = ep2 * Math.cos(phi) * Math.cos(phi);
    var A = Math.cos(phi) * (lam - lon0);
    var M = a * ((1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256) * phi
      - (3 * e2 / 8 + 3 * e2 * e2 / 32 + 45 * e2 * e2 * e2 / 1024) * Math.sin(2 * phi)
      + (15 * e2 * e2 / 256 + 45 * e2 * e2 * e2 / 1024) * Math.sin(4 * phi)
      - (35 * e2 * e2 * e2 / 3072) * Math.sin(6 * phi));
    var E = k0 * N * (A + (1 - T + Cc) * A * A * A / 6 + (5 - 18 * T + T * T + 72 * Cc - 58 * ep2) * Math.pow(A, 5) / 120) + 500000;
    var Nn = k0 * (M + N * Math.tan(phi) * (A * A / 2 + (5 - T + 9 * Cc + 4 * Cc * Cc) * Math.pow(A, 4) / 24
      + (61 - 58 * T + T * T + 600 * Cc - 330 * ep2) * Math.pow(A, 6) / 720));
    return { zone: zone, e: E, n: Nn };
  }

  var BAND = 'CDEFGHJKLMNPQRSTUVWX';
  function band(lat) { return BAND[Math.min(19, Math.floor((lat + 80) / 8))]; }

  // 100 km square letters (AA lettering scheme).
  var COLS = ['ABCDEFGH', 'JKLMNPQR', 'STUVWXYZ'];
  var ROWS = 'ABCDEFGHJKLMNPQRSTUV';
  function square(zone, e, n) {
    var set = (zone - 1) % 3;
    var col = COLS[set][Math.floor(e / 100000) - 1];
    var rowOffset = zone % 2 === 0 ? 5 : 0;
    var row = ROWS[(Math.floor(n / 100000) + rowOffset) % 20];
    return col + row;
  }

  // An MGRS grid at the requested number of digits (8 = 10 m).
  function toMGRS(zone, bandLetter, e, n, digits) {
    digits = digits || 8;
    var half = digits / 2;
    var div = Math.pow(10, 5 - half);
    var ee = String(Math.floor((e % 100000) / div)).padStart(half, '0');
    var nn = String(Math.floor((n % 100000) / div)).padStart(half, '0');
    return { gzd: zone + bandLetter, sq: square(zone, e, n), e: ee, n: nn, text: zone + bandLetter + ' ' + square(zone, e, n) + ' ' + ee + ' ' + nn };
  }

  // Read "UM 9560 0550" or "15T UM 95600550" etc. back to full UTM, given the map's reference point
  // (to resolve which 100 km square and the hundreds-of-km digits).
  function parseGrid(text, ref) {
    var t = String(text || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
    t = t.replace(/^\d{1,2}[C-X]/, '');
    var m = t.match(/^([A-Z]{2})?(\d+)$/);
    if (!m || m[2].length % 2 || m[2].length < 4 || m[2].length > 10) return null;
    var digits = m[2], half = digits.length / 2;
    var mult = Math.pow(10, 5 - half);
    var de = parseInt(digits.slice(0, half), 10) * mult, dn = parseInt(digits.slice(half), 10) * mult;
    var sq = m[1] || square(ref.zone, ref.e, ref.n);
    // Find the 100 km block near the reference point that has these square letters.
    var best = null;
    for (var be = -1; be <= 1; be++) {
      for (var bn = -1; bn <= 1; bn++) {
        var E = (Math.floor(ref.e / 100000) + be) * 100000 + de, N = (Math.floor(ref.n / 100000) + bn) * 100000 + dn;
        if (square(ref.zone, E, N) !== sq) continue;
        var d = Math.hypot(E - ref.e, N - ref.n);
        if (!best || d < best.d) best = { e: E, n: N, d: d, precision: mult };
      }
    }
    return best && { e: best.e + best.precision / 2, n: best.n + best.precision / 2, precision: best.precision, sq: sq, digits: digits.length };
  }

  // Least-squares affine fit from pixel (x, y) to UTM (e, n) using the four frame corners.
  function fitAffine(px, utm) {
    function solve(target) {
      // Normal equations for t = c0 + c1*x + c2*y
      var S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b = [0, 0, 0];
      for (var i = 0; i < px.length; i++) {
        var r = [1, px[i][0], px[i][1]];
        for (var j = 0; j < 3; j++) { b[j] += r[j] * target[i]; for (var k = 0; k < 3; k++) S[j][k] += r[j] * r[k]; }
      }
      // Gaussian elimination
      for (var c = 0; c < 3; c++) {
        for (var r2 = c + 1; r2 < 3; r2++) {
          var fct = S[r2][c] / S[c][c];
          for (var k2 = c; k2 < 3; k2++) S[r2][k2] -= fct * S[c][k2];
          b[r2] -= fct * b[c];
        }
      }
      var x = [0, 0, 0];
      for (var c2 = 2; c2 >= 0; c2--) {
        var s = b[c2];
        for (var k3 = c2 + 1; k3 < 3; k3++) s -= S[c2][k3] * x[k3];
        x[c2] = s / S[c2][c2];
      }
      return x;
    }
    var ce = solve(utm.map(function (u) { return u.e; }));
    var cn = solve(utm.map(function (u) { return u.n; }));
    var det = ce[1] * cn[2] - ce[2] * cn[1];
    return {
      toUTM: function (x, y) { return { e: ce[0] + ce[1] * x + ce[2] * y, n: cn[0] + cn[1] * x + cn[2] * y }; },
      toPixel: function (e, n) {
        var de = e - ce[0], dn = n - cn[0];
        return { x: (cn[2] * de - ce[2] * dn) / det, y: (-cn[1] * de + ce[1] * dn) / det };
      }
    };
  }

  // Grid azimuth (degrees from grid north, clockwise) and distance between two UTM points.
  function azimuth(p, q) {
    var d = Math.atan2(q.e - p.e, q.n - p.n) * 180 / Math.PI;
    return (d + 360) % 360;
  }
  function distance(p, q) { return Math.hypot(q.e - p.e, q.n - p.n); }

  // Build a map projection from a GeoPDF's frame size and corner coordinates
  // (corners: [lat, lon] for bottom-left, top-left, top-right, bottom-right).
  function mapProjection(width, height, corners, zone) {
    var px = [[0, height], [0, 0], [width, 0], [width, height]];
    var utm = corners.map(function (c) { return toUTM(c[0], c[1], zone); });
    var fit = fitAffine(px, utm);
    var resid = px.map(function (p, i) { var u = fit.toUTM(p[0], p[1]); return Math.hypot(u.e - utm[i].e, u.n - utm[i].n); });
    var center = fit.toUTM(width / 2, height / 2);
    var midLat = corners.reduce(function (s, c) { return s + c[0]; }, 0) / 4;
    return {
      zone: zone, band: band(midLat), toUTM: fit.toUTM, toPixel: fit.toPixel, center: center,
      maxCornerError: Math.max.apply(null, resid),
      mgrs: function (e, n, digits) { return toMGRS(zone, band(midLat), e, n, digits); },
      parse: function (text) { return parseGrid(text, { zone: zone, e: center.e, n: center.n }); }
    };
  }

  var api = { toUTM: toUTM, toMGRS: toMGRS, parseGrid: parseGrid, square: square, band: band, azimuth: azimuth, distance: distance, mapProjection: mapProjection };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.BWC = root.BWC || {}; root.BWC.Geo = api; }
})(this);
