// The service as a whole: every file parses and loads on this Node, and nothing in it needs a Node newer than 12.21 (webOS 22, the
// oldest TV this fork supports: DECISIONS.md D-20261101-1). tools/check.sh runs this under Node.js 12.21.0 itself, so there the
// syntax check and the loading below are the TV's own; on a newer Node the rules below catch what it has and Node 12 does not, and
// ESLint (ecmaVersion 2019) catches newer syntax. Add to them when you find another.
const fs = require('fs'),
  path = require('path'),
  cp = require('child_process');
const { root, helper, ok, run } = require('./lib');

run(async () => {
  const files = fs
    .readdirSync(helper)
    .filter(f => /\.js$/.test(f))
    .map(f => path.join(helper, f))
    // and the scripts the setup runs with the TV's node (jtool.js)
    .concat(
      fs
        .readdirSync(path.join(root, 'scripts'))
        .filter(f => /\.js$/.test(f))
        .map(f => path.join(root, 'scripts', f))
    );
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
  // code that works on a newer Node but not on Node 12.21: [what, why, files it does not apply to]. The phone pages (remotepage.js and
  // its TV tab statuspage.js) are pages for the phone's browser kept in strings: what they hold is the browser's, not Node's
  const PHONE = ['remotepage.js', 'statuspage.js'];
  const rules = [
    [/\?\?|\?\.[A-Za-z_$\[(]/, 'optional chaining or ?? (Node 14)', PHONE],
    [/\|\|=|&&=/, 'logical assignment (Node 15)', PHONE],
    [
      /\bstatic\s*\{|#[A-Za-z_$][\w$]*\s+in\b|^\s*(static\s+)?(async\s+)?#[A-Za-z_$][\w$]*\s*\(/,
      'a class static block, #x in or a private method (Node 14 to 16)',
    ],
    [
      /\.(replaceAll|at|findLast|findLastIndex|toSorted|toReversed|toSpliced|isWellFormed|toWellFormed)\(|\bObject\.(hasOwn|groupBy)\b|\bMap\.groupBy\b|\bPromise\.(any|withResolvers)\b|\bArray\.fromAsync\b/,
      'an array, string or object function newer than Node 12',
    ],
    [/\.(union|intersection|symmetricDifference|isSubsetOf|isSupersetOf|isDisjointFrom)\(/, 'a Set method newer than Node 12'],
    [
      /\b(structuredClone|AggregateError|WeakRef|FinalizationRegistry|AbortController|AbortSignal|EventTarget|BroadcastChannel|MessageChannel)\b/,
      'a global newer than Node 12 (14 to 18)',
      PHONE,
    ],
    [
      /(^|[^.\w$])(atob|btoa)\(|(^|[^.\w$'"])performance\.|\bnew Event\(/,
      'a global of Node 15 or 16 (atob, btoa, performance, Event)',
      PHONE,
    ],
    [
      /(^|[^.\w$])fetch\(|\bnew (Blob|File|FormData|Headers|Request|Response|WebSocket|ReadableStream|WritableStream|TransformStream|CompressionStream|DecompressionStream)\(|\bnavigator\./,
      'a global of Node 18 or newer (fetch.js downloads)',
      PHONE,
    ],
    [
      /\bfs\.(rm|rmSync|cp|cpSync|statfsSync|readv|readvSync|lutimes|lutimesSync|globSync|glob)\b|\bthrowIfNoEntry\b/,
      'an fs function or option newer than Node 12',
    ],
    [
      /require\(['"](node:|fs\/promises|timers\/promises|stream\/promises|readline\/promises|dns\/promises|util\/types|path\/(posix|win32)|assert\/strict|stream\/web)/,
      'a module name newer than Node 12 (node:..., .../promises)',
    ],
    [
      /\bcrypto\.(randomUUID|webcrypto|subtle|getRandomValues|hkdf|hkdfSync|diffieHellman|generatePrime|checkPrime|hash)\b|\bX509Certificate\b|['"]jwk['"]|['"]base64url['"]/,
      'a crypto function or format newer than Node 12 (base64url: replace the characters by hand)',
    ],
    [
      /\bdns\.setDefaultResultOrder\b|\bautoSelectFamily\b|\.(closeAllConnections|closeIdleConnections|setHeaders)\(|\bnet\.(BlockList|SocketAddress)\b|\bos\.(devNull|availableParallelism|machine)\b/,
      'a network or os function newer than Node 12',
    ],
    [
      /\bprocess\.(loadEnvFile|getActiveResourcesInfo|constrainedMemory|availableMemory)\b|\butil\.(styleText|parseEnv|parseArgs|stripVTControlCharacters|toUSVString|aborted)\b|\bevents\.(getEventListeners|addAbortListener)\b|\bIntl\.(Segmenter|DisplayNames|supportedValuesOf)\b/,
      'a process, util, events or Intl function newer than Node 12',
    ],
  ];
  // the rules themselves: each catches what it is for, and what Node 12.21 has passes
  const flagged = line => rules.filter(r => r[0].test(line)).length > 0;
  const newer = [
    'const v = a?.b;',
    'const v = a ?? b;',
    'a ||= b;',
    'static {',
    "s.replaceAll('a', 'b');",
    'const last = list.at(-1);',
    "Object.hasOwn(o, 'k');",
    'await Promise.any(jobs);',
    'fs.rmSync(dir, { recursive: true });',
    'const st = fs.statSync(f, { throwIfNoEntry: false });',
    "const fsp = require('fs/promises');",
    "const fs = require('node:fs');",
    'const id = crypto.randomUUID();',
    "const k = buf.toString('base64url');",
    'const c = new AbortController();',
    'const copy = structuredClone(x);',
    'const t = performance.now();',
    'const s = atob(b);',
    "dns.setDefaultResultOrder('ipv4first');",
  ].filter(l => !flagged(l));
  const fine = [
    'const o = Object.fromEntries(pairs);',
    'for (const m of s.matchAll(re)) n++;',
    'const all = await Promise.allSettled(jobs);',
    'const flat = list.flat();',
    'const n = crypto.randomInt(10);',
    'fs.mkdirSync(d, { recursive: true });',
    'const v = a ? .5 : 1;',
    "const t = require('perf_hooks').performance.now();",
    'const statfs = /** @type {any} */ (fs).statfs;',
    "const s = String(n).padStart(2, '0');",
  ].filter(flagged);
  ok(
    !newer.length && !fine.length,
    'the rules catch what Node 12 lacks and let through what it has' +
      (newer.length ? '; not caught: ' + newer.join(' ') : '') +
      (fine.length ? '; caught wrongly: ' + fine.join(' ') : '')
  );
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
  ok(!bad.length, 'nothing needs a Node newer than 12.21 (webOS 22)' + (bad.length ? ':\n  ' + bad.join('\n  ') : ''));
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
    f => !/(exec|diag|selfupdate)\.js$/.test(f) && /\bcp\.(execFile|exec|spawn)\(|execSync\(/.test(fs.readFileSync(f, 'utf8'))
  );
  ok(
    direct.length <= 1,
    'programs are started through exec.js (voice.js keeps its long-running recogniser and stream): ' +
      direct.map(f => path.basename(f)).join(', ')
  );
});
