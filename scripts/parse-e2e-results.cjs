const r = require('../test-results/results.json');
const rows = [];
function walk(s) {
  (s.suites || []).forEach(walk);
  (s.specs || []).forEach((sp) => {
    sp.tests.forEach((t) => {
      const last = t.results[t.results.length - 1];
      rows.push({
        id: sp.title.split(' ')[0],
        title: sp.title,
        outcome: t.status,
        attempts: t.results.length,
        dur: (t.results.reduce((a, b) => a + b.duration, 0) / 1000).toFixed(1),
        last: last.status,
        file: sp.file,
        line: sp.line,
      });
    });
  });
}
r.suites.forEach(walk);
const ml = rows.filter((x) => /^ML/.test(x.id));
ml.forEach((x) => {
  console.log([x.id.padEnd(7), x.outcome.padEnd(9), 'x' + x.attempts, (x.dur + 's').padStart(7), x.last].join('  '));
});
console.log('---');
console.log(
  'passed:', r.stats.expected,
  '| flaky:', r.stats.flaky,
  '| skipped:', r.stats.skipped,
  '| failed:', r.stats.unexpected,
  '| duration:', (r.stats.duration / 1000).toFixed(0) + 's'
);
module.exports = { rows: ml, stats: r.stats };
