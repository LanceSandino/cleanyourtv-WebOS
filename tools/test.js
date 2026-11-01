// Runs the tests in tools/test (each *.test.js on its own, in a fresh process) and prints a summary.
//   node tools/test.js                 all tests with this Node
//   node tools/test.js live theme      only these
//   node tools/test.js --quiet         print only failures and the summary
// tools/check.sh runs this with Node.js 12.21.0, the Node of webOS 22 (the oldest TV this fork supports), and with the Node of this
// computer. A test file for something that does not run on the TV (the hub) says "// needs Node <major>" in its first lines; under an
// older Node it is skipped, and the summary says so. Runs on Node 12 and newer.
'use strict';
const fs = require('fs'),
  path = require('path'),
  cp = require('child_process');
const dir = path.join(__dirname, 'test');
const args = process.argv.slice(2);
const quiet = args.indexOf('--quiet') >= 0;
const only = args.filter(a => a.indexOf('--') !== 0);
const files = fs
  .readdirSync(dir)
  .filter(f => /\.test\.js$/.test(f))
  .filter(f => !only.length || only.indexOf(f.replace(/\.test\.js$/, '')) >= 0)
  .sort();
let failedFiles = [],
  skipped = [],
  checks = 0;
const t0 = Date.now();
const major = parseInt(process.versions.node, 10);
const needs = f =>
  parseInt((/^\/\/ needs Node (\d+)/m.exec(fs.readFileSync(path.join(dir, f), 'utf8').slice(0, 4000)) || [])[1] || '0', 10);
for (const f of files) {
  if (needs(f) > major) {
    skipped.push(f);
    console.log('skip ' + f + ' (needs Node ' + needs(f) + ', this is ' + process.version + ')');
    continue;
  }
  const r = cp.spawnSync(process.execPath, [path.join(dir, f)], { encoding: 'utf8', timeout: 180000 });
  const out = (r.stdout || '') + (r.status !== 0 && r.stderr ? r.stderr : '');
  const lines = out.split('\n').filter(Boolean);
  const okN = lines.filter(l => /^ok {3}/.test(l)).length,
    failN = lines.filter(l => /^FAIL /.test(l)).length;
  checks += okN + failN;
  const good = r.status === 0 && failN === 0;
  if (!good) failedFiles.push(f);
  console.log(
    (good ? 'ok   ' : 'FAIL ') +
      f +
      ' (' +
      okN +
      ' checks' +
      (failN ? ', ' + failN + ' failed' : '') +
      (r.error ? ', ' + r.error.message : '') +
      ')'
  );
  if (!quiet || !good) for (const l of lines) if (!quiet || !/^ok {3}/.test(l)) console.log('     ' + l);
}
console.log(
  '\n' +
    (failedFiles.length
      ? failedFiles.length + ' test file(s) failed: ' + failedFiles.join(', ')
      : 'all ' + checks + ' checks in ' + (files.length - skipped.length) + ' files passed') +
    (skipped.length ? ' (' + skipped.join(', ') + ' skipped: newer Node)' : '') +
    ' on Node ' +
    process.version +
    ' (' +
    Math.round((Date.now() - t0) / 1000) +
    ' s)'
);
process.exit(failedFiles.length ? 1 : 0);
