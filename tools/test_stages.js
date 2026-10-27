// Checks stage-gated content and board levels using the real stages.js. Run: node tools/test_stages.js
const fs = require('fs');
const path = require('path');
const window = {};
new Function('window', fs.readFileSync(path.join(__dirname, '../public/js/config.js'), 'utf8'))(window);
window.BWC_QUESTIONS = [
  { id: 'base1', level: 1 }, { id: 'base2', level: 2 },
  { id: 'div1', level: 2, stage: 'division' }, { id: 'state1', level: 2, stage: 'state' }, { id: 'reg1', level: 3, stage: 'region' }
];
new Function('window', 'BWC', fs.readFileSync(path.join(__dirname, '../public/js/stages.js'), 'utf8').replace(/window\.BWC = window\.BWC \|\| \{\};/, ''))(window, window.BWC = {});
const S = window.BWC.Stages;

let failed = 0;
function expect(label, ok, detail) { if (!ok) failed++; console.log((ok ? 'PASS ' : 'FAIL ') + label + (detail ? '  (' + detail + ')' : '')); }
const ids = () => window.BWC_QUESTIONS.map((q) => q.id).join(',');

S.applyContent({ stage: 'hhbn' });
expect('HHBn sees only untagged questions', ids() === 'base1,base2', ids());
expect('HHBn locked counts per stage', JSON.stringify(S.lockedCounts({ stage: 'hhbn' })) === '{"division":1,"state":1,"region":1}');
S.applyContent({ stage: 'state' });
expect('State sees division and state packs, not region', ids() === 'base1,base2,div1,state1', ids());
S.applyContent({ stage: 'region' });
expect('Region IV sees everything', ids() === 'base1,base2,div1,state1,reg1', ids());
S.applyContent({});
expect('no stage set means HHBn', ids() === 'base1,base2', ids());
expect('the same array object is filtered in place', window.BWC_QUESTIONS.length === 2);

const lv = S.boardLevels({ stage: 'division' });
expect('Division opens only the Division board', lv.map((l) => l.id + ':' + l.open).join(',') === 'division:true,state:false,region:false');
expect('countdown starts at the Soldier\'s stage', S.competitionsFor({ stage: 'state' })[0].id === 'state');
expect('unknown stage falls back to HHBn', S.of({ stage: 'bogus' }).id === 'hhbn');

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
