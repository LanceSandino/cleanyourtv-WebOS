// The service as a whole: every file parses and loads on this Node, and nothing in it needs a Node newer than 16 (webOS 25 has 16.20.2,
// the oldest TV this fork supports: DECISIONS.md D-20261029-3). The tests run on the Node of this computer, so the rules below catch
// what a newer Node has and Node 16 does not; ESLint (ecmaVersion 2022) catches newer syntax. Add to them when you find another.
const fs = require('fs'),
  path = require('path'),
  cp = require('child_process');
const { root, helper, ok, run } = require('./lib');

run(async () => {
  const files = fs
    .readdirSync(helper)
    .filter(f => /\.js$/.test(f))
    .map(f => path.join(helper, f))
    .concat(path.join(root, 'scripts', 'jtool.js'));
  for (const f of files) {
    const r = cp.spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
    ok(r.status === 0, 'syntax ' + path.relative(root, f) + (r.status ? '\n' + r.stderr : ''));
  }
  // every module loads (helper.js starts the service and sharelog.js is a program: they are only parsed above)
  for (const f of files.filter(f => /helper[\\/][a-z]+\.js$/.test(f) && !/(helper|sharelog|selfupdate)\.js$/.test(f))) {
    try {
      require(f);
      ok(true, 'loads ' + path.basename(f));
    } catch (e) {
      ok(false, 'loads ' + path.basename(f) + ': ' + e.message);
    }
  }
  // code that works on a newer Node but not on Node 16: [what, why, files it does not apply to]
  const rules = [
    [
      /\.(findLast|findLastIndex|toSorted|toReversed|toSpliced|isWellFormed|toWellFormed)\(|\b(Object|Map)\.groupBy\b|\bPromise\.withResolvers\b|\bArray\.fromAsync\b/,
      'an array or string function newer than Node 16',
    ],
    [/\.(union|intersection|symmetricDifference|isSubsetOf|isSupersetOf|isDisjointFrom)\(/, 'a Set method newer than Node 16'],
    [/\bstructuredClone\b|\bAbortSignal\.any\b/, 'a global function newer than Node 16'],
    // the phone page (remotepage.js, and its TV tab statuspage.js) is a page for the phone's browser kept in a string: fetch and
    // navigator are the browser's there
    [
      /(^|[^.\w$])fetch\(|\bnew (Blob|File|FormData|Headers|Request|Response|WebSocket|ReadableStream|WritableStream|TransformStream|CompressionStream|DecompressionStream|BroadcastChannel)\(|\bnavigator\./,
      'a global of Node 18 or newer (fetch.js downloads)',
      ['remotepage.js', 'statuspage.js'],
    ],
    [
      /\bfs\.(globSync|glob)\b|\bprocess\.loadEnvFile\b|\butil\.(styleText|parseEnv)\b|\bcrypto\.hash\(/,
      'a module function newer than Node 16',
    ],
  ];
  const bad = [];
  for (const f of files) {
    const base = path.basename(f);
    fs.readFileSync(f, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        const code = line.replace(/^\s*\/\/.*$/, '');
        if (!code.trim()) return;
        for (const r of rules) if (r[0].test(code) && (r[2] || []).indexOf(base) < 0) bad.push(base + ':' + (i + 1) + ' ' + r[1]);
      });
  }
  ok(!bad.length, 'nothing needs a Node newer than 16 (webOS 25)' + (bad.length ? ':\n  ' + bad.join('\n  ') : ''));
  // the TV's paths are in paths.js only, so a test (or another TV) can move them
  const fixed = [];
  for (const f of files.filter(f => !/(paths|jtool)\.js$/.test(f)))
    fs.readFileSync(f, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (/'\/media\/developer\/cleanyourtv|'\/proc['\/]/.test(line.replace(/\/\/.*$/, ''))) fixed.push(path.basename(f) + ':' + (i + 1));
      });
  ok(!fixed.length, 'the service folder and /proc are named only in paths.js' + (fixed.length ? ': ' + fixed.join(', ') : ''));
  const direct = files.filter(
    f => !/(exec|diag|selfupdate|lgscreensaver)\.js$/.test(f) && /\bcp\.(execFile|exec|spawn)\(|execSync\(/.test(fs.readFileSync(f, 'utf8'))
  );
  ok(
    direct.length <= 1,
    'programs are started through exec.js (voice.js keeps its long-running recogniser and stream, lgscreensaver.js its one waiting luna-send -i): ' +
      direct.map(f => path.basename(f)).join(', ')
  );
});
