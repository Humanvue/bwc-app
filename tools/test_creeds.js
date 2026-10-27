// Checks the creed trainer's word matching. Run: node tools/test_creeds.js
const K = require('../public/js/creeds.js');

let failed = 0;
function expect(label, got, want) {
  const ok = got === want;
  if (!ok) failed++;
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : `  (got ${got}, want ${want})`));
}

const soldier = K.CREEDS.find((c) => c.id === 'soldiers-creed').sections[0].text;
const nco1 = K.CREEDS.find((c) => c.id === 'nco-creed').sections[0].text;

expect('perfect recitation scores 100%', K.check(soldier, soldier).score, 1);
expect('lowercase, no punctuation still 100%', K.check(soldier, soldier.toLowerCase().replace(/[.,]/g, '')).score, 1);

const skipLine = soldier.replace('I will never quit.\n', '');
const r = K.check(soldier, skipLine);
expect('skipping one line misses exactly its 4 words', r.total - r.right, 4);
expect('skipping a line fails the pass mark', r.score >= K.PASS, false);
const oneSlip = soldier.replace('I will never quit.', 'I will never quiet.');
expect('one misheard word still passes', K.check(soldier, oneSlip).score >= K.PASS, true);

const extra = soldier.replace('I am a warrior', 'I am um a warrior');
expect('an extra filler word costs nothing', K.check(soldier, extra).score, 1);

const swapped = nco1.replace('pleasure, profit, or personal safety', 'profit, pleasure, or personal safety');
expect('swapping two words drops one (order matters)', K.check(nco1, swapped).total - K.check(nco1, swapped).right, 1);

expect('hyphen and dash words split the same way', K.tokens('time-honored mind—accomplishment').join(' '), 'time honored mind accomplishment');
expect('typed "time honored" matches "time-honored"', K.check('a time-honored corps', 'a time honored corps').score, 1);
expect('curly and straight apostrophes match', K.check("Soldier's Creed", 'Soldier’s creed').score, 1);

// Hidden words only grow with each level.
let grows = true;
for (let i = 0; i < 300; i++) {
  if (K.hiddenAt(i, 0.25) && !K.hiddenAt(i, 0.5)) grows = false;
  if (K.hiddenAt(i, 0.5) && !K.hiddenAt(i, 0.75)) grows = false;
}
expect('a word hidden at one level stays hidden at harder levels', grows, true);
const share = Array.from({ length: 1000 }, (_, i) => K.hiddenAt(i, 0.5)).filter(Boolean).length / 1000;
expect('about half the words are hidden at 50%', share > 0.4 && share < 0.6, true);

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
