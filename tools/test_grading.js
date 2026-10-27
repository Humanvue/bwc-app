// Checks the mock board grader against real questions. Run: node tools/test_grading.js
const fs = require('fs');
const path = require('path');
const G = require('../public/js/grading.js');

const window = {};
new Function('window', fs.readFileSync(path.join(__dirname, '../public/js/questions.js'), 'utf8'))(window);
const Q = Object.fromEntries(window.BWC_QUESTIONS.map((q) => [q.id, q]));

let failed = 0;
function expect(label, got, want) {
  const ok = Object.keys(want).every((k) => got[k] === want[k]);
  if (!ok) failed++;
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : '\n     got ' + JSON.stringify(got)));
}

const aar = Q['a-025'];   // four parts of a training AAR agenda
const att = Q['a-070'];   // position of attention, toe angle
const lead = Q['a-009'];  // definition of leadership
const tri = Q['b-052'] || window.BWC_QUESTIONS.find((q) => /triage categor/i.test(q.q));

expect('perfect answer, SGM asks',
  G.grade('Sergeant Major, at the position of attention the toes form a 45-degree angle.', att, 'SGM'),
  { address: true, restate: true, content: true });

expect('right content, no address',
  G.grade('At the position of attention the toes form a 45 degree angle.', att, 'CSM'),
  { address: false, restate: true, content: true });

expect('right content, no restatement',
  G.grade('Sergeant Major, 45 degrees.', att, 'CSM'),
  { address: true, restate: false, content: true });

expect('wrong content',
  G.grade('Sergeant Major, at the position of attention the toes form a 30-degree angle.', att, 'CSM'),
  { address: true, content: false });

expect('1SG asks, Soldier says Sergeant Major',
  G.grade('Sergeant Major, at the position of attention the toes form a 45-degree angle.', att, '1SG'),
  { address: false, content: true });

expect('1SG asks, correct title',
  G.grade('First Sergeant, at the position of attention the toes form a 45-degree angle.', att, '1SG'),
  { address: true, content: true });

expect('leadership definition, spoken style',
  G.grade('Sergeant Major the Army definition of leadership is the activity of influencing people by providing purpose direction and motivation to accomplish the mission and improve the organization', lead, 'SGM'),
  { address: true, restate: true, content: true });

expect('AAR parts, paraphrased',
  G.grade('Sergeant Major, the four parts of a training AAR agenda are review what was supposed to happen, establish what happened, determine what was right or wrong, and determine how to do it to standard next time.', aar, 'CSM'),
  { address: true, restate: true, partial: true });

expect('AAR parts, close to the source',
  G.grade('Sergeant Major, the four parts of a training AAR agenda are a review of what was supposed to happen, establishing what did happen, determining what was right or wrong, and how to perform to standard next time.', aar, 'CSM'),
  { address: true, restate: true, content: true });

if (tri) {
  expect('triage, missing one category is partly right',
    G.grade('Sergeant Major, the four triage categories are immediate, delayed and minimal.', tri, 'SGM'),
    { address: true, restate: true, content: false, partial: true });
  expect('triage, all four',
    G.grade('Sergeant Major, the four triage categories are immediate, delayed, minimal and expectant.', tri, 'SGM'),
    { content: true, partial: false });
}

expect('blank answer', G.grade('', att, 'CSM'), { blank: true, content: false });
expect('filler count', { n: G.fillers('Sergeant Major, um, the uh toes, um') }, { n: 3 });
expect('reporting in', G.gradeReport('Sergeant Major, Specialist Doe reports to the President of the Board.', 'Specialist', 'Doe'),
  { address: true, reports: true, rank: true, name: true });

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
