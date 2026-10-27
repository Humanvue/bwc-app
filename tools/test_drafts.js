// Checks the award and NCOER draft generator. Run: node tools/test_drafts.js
const D = require('../public/js/drafts.js');

let failed = 0;
function expect(label, ok, detail) {
  if (!ok) failed++;
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (detail ? '  (' + detail + ')' : ''));
}

const DAY = 86400000;
const from = Date.UTC(2026, 9, 1), thru = Date.UTC(2026, 11, 31);
const inside = (d) => from + d * DAY;
const before = from - 30 * DAY;

const questions = Array.from({ length: 120 }, (_, i) => ({ id: 'q' + i, topic: ['rifle', 'land-nav', 'uniforms', 'first-aid'][i % 4] }));
const attempts = questions.map((q, i) => ({ qid: q.id, topic: q.topic, correct: q.topic !== 'land-nav' || i % 3 === 0, at: inside(i % 60) }))
  .concat(questions.slice(0, 40).map((q) => ({ qid: q.id, topic: q.topic, correct: true, at: before }))); // outside the period
const ledger = [
  { kind: 'board-done', score: 70, at: inside(10) }, { kind: 'board-done', score: 85, at: inside(40) },
  { kind: 'board-done', score: 90, sponsored: true, at: inside(50) },
  { kind: 'board-done', score: 100, at: before }, // outside: must not become the best score
  ...Array.from({ length: 6 }, (_, i) => ({ kind: 'drill', ok: true, at: inside(i) })),
  ...Array.from({ length: 7 }, (_, i) => ({ kind: 'landnav', ok: true, ref: 'plot', err: 20 + i, at: inside(i) })),
  { kind: 'creed', ref: 'soldiers-creed:0:4', at: inside(20) }, { kind: 'creed', ref: 'nco-creed:3:4', at: inside(30) }
];
const workouts = [
  ...Array.from({ length: 8 }, (_, i) => ({ type: 'ruck', minutes: 90, miles: 6, weight: 35, date: new Date(inside(i * 7)).toISOString().slice(0, 10) })),
  { type: 'aft', minutes: 50, date: new Date(inside(5)).toISOString().slice(0, 10), aft: { '2mr': 1010, mdl: 225 } },
  { type: 'aft', minutes: 50, date: new Date(inside(55)).toISOString().slice(0, 10), aft: { '2mr': 940, mdl: 250 } }
];
const names = { rifle: 'Rifle and Carbine', 'land-nav': 'Land Navigation', uniforms: 'Uniforms', 'first-aid': 'First Aid and TCCC' };

const M = D.metrics({ attempts, ledger, workouts }, questions, names, from, thru);
expect('only answers inside the rating period count', M.answered === 120, M.answered);
expect('best mock board ignores the pre-period 100%', M.bestBoard === 85, M.bestBoard);
expect('sponsor boards counted separately', M.sponsorBoards === 1 && M.sponsorBest === 90);
expect('weak topic (land nav ~33%) is not "mastered"', M.mastered.indexOf('Land Navigation') < 0, M.mastered.join(', '));
expect('ruck miles add up', M.ruckMiles === 48, M.ruckMiles);

const nc = D.ncoer(M, { event: 'HHBn Best Warrior Competition', place: '1st' });
const all = Object.values(nc).flat();
expect('NCOER produced bullets in several blocks', Object.values(nc).filter((b) => b.length).length >= 3, Object.keys(nc).map((k) => k + ':' + nc[k].length).join(' '));
const VERBS = /^o (memorized|logged|improved|answered|mastered|earned|placed|competed|sat|completed|performed)\b/;
expect('every bullet starts with "o " and an action verb', all.every((b) => VERBS.test(b)), all.find((b) => !VERBS.test(b)));
expect('"improved" appears once per AFT bullet', all.filter((b) => /improved/.test(b)).every((b) => b.match(/improved/g).length === 1));
expect('every bullet fits two lines', all.every((b) => b.length <= D.MAX_LEN), Math.max(...all.map((b) => b.length)));
expect('AFT improvement is reported', all.some((b) => /2-mile run from 16:50 to 15:40/.test(b)));
expect('placement is reported', all.some((b) => /placed 1st at the HHBn/.test(b)));

const aw = D.award(M, { rank: 'SPC', last: 'Doe', unit: 'HHBn, 34th Infantry Division' }, { fromText: '1 October 2026', thruText: '31 December 2026' }, { event: 'HHBn Best Warrior Competition', place: '1st' }, 'AAM');
const text = all.join(' ') + ' ' + aw.achievements.join(' ') + ' ' + aw.citation;
expect('no pronouns anywhere (he, she, his, her, him, himself, herself)', !/\b(he|she|his|her|him|himself|herself|hers)\b/i.test(text), (text.match(/\b(he|she|his|her|him|himself|herself|hers)\b/i) || [])[0]);
expect('no marital or family words', !/\b(wife|husband|spouse|married|family|children)\b/i.test(text));
expect('award has at most four achievements', aw.achievements.length <= 4 && aw.achievements.length > 0);
expect('citation names the period and the Soldier', /from 1 October 2026 to 31 December 2026/.test(aw.citation) && /SPC Doe/.test(aw.citation));

const empty = D.metrics({ attempts: [], ledger: [], workouts: [] }, questions, names, from, thru);
expect('no records gives no NCOER bullets (nothing invented)', Object.values(D.ncoer(empty, null)).flat().length === 0);

console.log('\nSample NCOER:\n' + Object.keys(nc).map((k) => k + '\n  ' + nc[k].join('\n  ')).join('\n'));
console.log('\nSample citation:\n  ' + aw.citation);
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
