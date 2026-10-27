// Checks the land nav map math against the Camp Ripley map itself. Run: node tools/test_geo.js
const G = require('../public/js/geo.js');
const MAP = require('../public/maps/ripley/map.json');

let failed = 0;
function expect(label, ok, detail) {
  if (!ok) failed++;
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (detail ? '  (' + detail + ')' : ''));
}

const P = G.mapProjection(MAP.width, MAP.height, MAP.corners, MAP.zone);
expect('corner fit is within 15 m (map frame is close to a UTM rectangle)', P.maxCornerError < 15, P.maxCornerError.toFixed(1) + ' m');
expect('grid zone is 15T', P.band === 'T' && P.zone === 15, P.zone + P.band);

const c = P.mgrs(P.center.e, P.center.n);
expect('map center is in 100 km square UM (matches Camp Ripley grids)', c.sq === 'UM', c.text);

// The printed 1 km grid lines were located by scanning tile pixels (15 horizontal and 11 vertical
// lines, all within 3 m of a whole kilometer under this projection). Their spacing is 227 px:
const g = P.toUTM(8 * 256 + 157, 14 * 256 + 181);
const offE = Math.abs(g.e - Math.round(g.e / 1000) * 1000);
expect('a printed easting grid line (x = 2205 px) lands on a whole kilometer (within 15 m)', offE < 15, 'off by ' + offE.toFixed(1) + ' m');
const step = P.toUTM(2000, 3000), stepUp = P.toUTM(2000, 3000 - 227);
expect('227 px on the map is 1 km, matching the printed grid spacing', Math.abs((stepUp.n - step.n) - 1000) < 10, (stepUp.n - step.n).toFixed(1) + ' m');

// Round trips
const back = P.toPixel(g.e, g.n);
expect('pixel -> UTM -> pixel round trip', Math.hypot(back.x - (8 * 256 + 157), back.y - (14 * 256 + 181)) < 0.01);
const m = P.mgrs(g.e, g.n, 8);
const parsed = P.parse(m.sq + ' ' + m.e + ' ' + m.n);
expect('MGRS text -> UTM lands in the same 10 m square', Math.abs(parsed.e - g.e) <= 10 && Math.abs(parsed.n - g.n) <= 10, m.text);
expect('a grid typed without square letters still parses', !!P.parse(m.e + m.n));
expect('a 6-digit grid parses at 100 m precision', P.parse(m.sq + m.e.slice(0, 3) + m.n.slice(0, 3)).precision === 100);
expect('bad input is rejected', P.parse('UM 123') === null && P.parse('hello') === null);

expect('due east azimuth is 90', Math.round(G.azimuth({ e: 0, n: 0 }, { e: 100, n: 0 })) === 90);
expect('due south azimuth is 180', Math.round(G.azimuth({ e: 0, n: 0 }, { e: 0, n: -100 })) === 180);
expect('north-west azimuth is 315', Math.round(G.azimuth({ e: 0, n: 0 }, { e: -100, n: 100 })) === 315);

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
