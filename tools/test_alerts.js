// Checks the readiness alert rules. Run: node tools/test_alerts.js
const AL = require('../public/js/alerts.js');

let failed = 0;
function expect(label, ok, detail) {
  if (!ok) failed++;
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (detail ? '  (' + detail + ')' : ''));
}
const DAY = 86400000;
// A Friday (day 5 of the week), so the weekly checks are active.
const now = new Date(2026, 10, 6, 18, 0).getTime();
const iso = (ms) => { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const opts = (extra) => Object.assign({ now, weeklyGoal: 4, topicNames: { 'land-nav': 'Land Navigation' }, daysToCompetition: 65 }, extra || {});
const keys = (list) => list.map((a) => a.key).join(',');

const none = AL.check({}, opts());
expect('never started is a high alert', none.length === 1 && none[0].key === 'never' && none[0].level === 'high', keys(none));

const quiet = AL.check({ attempts: [{ at: now - 9 * DAY, topic: 'rifle', correct: true }] }, opts());
expect('9 days idle is a high "quiet" alert', quiet[0].key === 'quiet' && /9 days/.test(quiet[0].text), quiet[0].text);

const slowing = AL.check({ attempts: [{ at: now - 5 * DAY, topic: 'rifle', correct: true }] }, opts());
expect('5 days idle is a medium "slowing" alert', slowing.some((a) => a.key === 'slowing' && a.level === 'medium'));

// An active Soldier on track: Daily 10 three days this week, a workout, a recent board, no weak topic.
const daily = {}; [0, 1, 3].forEach((i) => { daily[iso(now - i * DAY)] = { done: true }; });
const onTrack = {
  attempts: Array.from({ length: 10 }, (_, i) => ({ at: now - i * DAY, topic: 'rifle', correct: true })),
  ledger: [{ kind: 'board-done', at: now - 3 * DAY }],
  workouts: [{ date: iso(now - DAY), minutes: 40 }],
  daily
};
expect('an on-track Soldier gets no alerts', AL.check(onTrack, opts({ daysToCompetition: 30 })).length === 0, keys(AL.check(onTrack, opts({ daysToCompetition: 30 }))));

const behind = Object.assign({}, onTrack, { daily: { [iso(now)]: { done: true } }, workouts: [] });
const b = AL.check(behind, opts());
expect('Friday with 1 of 4 Daily 10 days flags Daily 10', b.some((a) => a.key === 'daily' && /1 of 4/.test(a.text)), keys(b));
expect('no workouts this week is flagged', b.some((a) => a.key === 'fitness'));

const monday = new Date(2026, 10, 2, 18, 0).getTime();
expect('weekly checks wait until Thursday', !AL.check(behind, opts({ now: monday })).some((a) => a.key === 'daily' || a.key === 'fitness'));

const weak = Object.assign({}, onTrack, { attempts: onTrack.attempts.concat(Array.from({ length: 10 }, (_, i) => ({ at: now - i * DAY, topic: 'land-nav', correct: i < 4 }))) });
const w = AL.check(weak, opts({ daysToCompetition: 30 }));
expect('a topic stuck under 60% is flagged by name', w.some((a) => a.key === 'weak:land-nav' && /Land Navigation stuck at 40%/.test(a.text)), keys(w));

const improving = Object.assign({}, onTrack, { attempts: onTrack.attempts
  .concat(Array.from({ length: 8 }, () => ({ at: now - 30 * DAY, topic: 'land-nav', correct: false })))
  .concat(Array.from({ length: 4 }, () => ({ at: now - DAY, topic: 'land-nav', correct: true }))) });
expect('a weak topic that improved in the last 2 weeks is not flagged', !AL.check(improving, opts({ daysToCompetition: 30 })).some((a) => a.key.startsWith('weak')));

const noBoard = Object.assign({}, onTrack, { ledger: [{ kind: 'board-done', at: now - 20 * DAY }] });
expect('no board in 20 days is flagged within 60 days of competition', AL.check(noBoard, opts({ daysToCompetition: 45 })).some((a) => a.key === 'board' && a.level === 'medium'));
expect('...and is high within 21 days', AL.check(noBoard, opts({ daysToCompetition: 14 })).some((a) => a.key === 'board' && a.level === 'high'));
expect('...but not when the competition is far off', !AL.check(noBoard, opts({ daysToCompetition: 90 })).some((a) => a.key === 'board'));

const shots = Object.assign({}, onTrack, { workouts: [{ date: iso(now - DAY), minutes: 40, shot: 'data:x', review: null }] });
const s = AL.check(shots, opts({ daysToCompetition: 30 }));
expect('screenshots to verify are an info alert, listed last', s.length && s[s.length - 1].key === 'verify' && s[s.length - 1].level === 'info', keys(s));

const mixed = AL.check({ attempts: [{ at: now - 8 * DAY, topic: 'rifle', correct: true }], workouts: [{ date: iso(now - 8 * DAY), shot: 'x' }] }, opts());
expect('alerts are sorted high, then medium, then info', mixed[0].level === 'high' && mixed[mixed.length - 1].level === 'info', mixed.map((a) => a.level).join(','));

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
