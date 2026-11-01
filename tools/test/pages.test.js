// The pages that run on the TV (launcher, manager, picker, notification card): nothing newer than Chromium 87 (webOS 22, the oldest
// TV this fork supports: DECISIONS.md D-20261101-1), and fixes that must not come back. The scripts written for Chromium 68 stay ES5
// until they are touched for another reason; new code may use what Chromium 87 has (ES2021, flex gap, inset, :focus-visible), and
// tools/oldchrome.js runs the pages in Chromium 87 and 120.
const fs = require('fs'),
  path = require('path');
const { root, ok, run } = require('./lib');

run(async () => {
  const pages = ['app', 'manager/app', 'picker/app', 'notify/app'].map(d => path.join(root, d, 'index.html'));
  // what Chromium 87 does not have yet, in a page's scripts and in its CSS (the <style> blocks and style attributes; CSS that a script
  // writes is not looked at here): add to it when you find another. [rule, what, where: 'js' or 'css']
  const rules = [
    [
      /\.(at|findLast|findLastIndex|toSorted|toReversed|toSpliced|isWellFormed|toWellFormed)\(|\bObject\.(hasOwn|groupBy)\b|\bMap\.groupBy\b|\bstructuredClone\b|\bArray\.fromAsync\b|\bPromise\.(withResolvers|try)\b/,
      'a function newer than Chromium 87',
      'js',
    ],
    [
      /\.(union|intersection|symmetricDifference|isSubsetOf|isSupersetOf|isDisjointFrom)\(|\bURL\.(parse|canParse)\(|\bRegExp\.escape\b|\bError\.isError\b|\bFloat16Array\b|\.(fromBase64|toBase64|fromHex|toHex)\(|\bIntl\.(DurationFormat|supportedValuesOf)\b/,
      'a function newer than Chromium 87',
      'js',
    ],
    [
      /\bcrypto\.randomUUID\b|\bAbortSignal\.(timeout|any)\b|\.(checkVisibility|showPopover|hidePopover|togglePopover|startViewTransition)\(|\buserAgentData\b|\bfocusVisible\b|\.inert\b|\bscheduler\.postTask\b/,
      'a browser function newer than Chromium 87',
      'js',
    ],
    [
      /:is\(|:where\(|:has\(|:not\([^)]*[\s,>+~][^)]*\)|:nth-(last-)?child\([^)]*\bof\b|:user-(in)?valid|:popover-open|:state\(|@scope\b|(^|[{;]\s*)&/,
      'a selector newer than Chromium 87 (:is and :where 88, a list or complex selector in :not 88, :has 105, nesting 112)',
      'css',
    ],
    [
      /\baspect-ratio\s*:|\baccent-color\b|\b\d+(\.\d+)?(d|s|l)v(h|w|min|max|i|b)\b|\b\d+(\.\d+)?cq(w|h|i|b|min|max)\b|\bcontainer(-type|-name)?\s*:|@container\b|@layer\b|\boverflow(-x|-y)?\s*:\s*clip\b|\boverflow-clip-margin\b|\btext-wrap\b|\bscrollbar-(gutter|width|color)\b/,
      'CSS newer than Chromium 87 (aspect-ratio 88, overflow: clip 90, accent-color 93, @layer 99, @container and dvh 105)',
      'css',
    ],
    [
      /(^|[;{\s])(translate|rotate|scale)\s*:|(^|[^-\w])mask(-image|-size|-position|-repeat|-mode|-composite|-clip|-origin)?\s*:|(^|[^-\w])image-set\(|(^|[^-\w])(color|hwb|lab|lch|oklab|oklch|color-mix|light-dark)\(|@media[^{]*(\(\s*[a-z-]+\s*[<>]=?|[<>]=?\s*[a-z-]+\s*\))/,
      'CSS newer than Chromium 87 (translate, rotate and scale as properties 104, unprefixed mask 120 and image-set 113, the newer colour ' +
        'functions 101 to 123, media ranges 104: use -webkit-mask, transform and min-/max-)',
      'css',
    ],
    [
      /@starting-style\b|\btransition-behavior\b|\bfield-sizing\b|\banchor-name\b|\bposition-anchor\b|\bposition-area\b|@position-try\b|@view-transition\b|\bview-transition-name\b|\binterpolate-size\b|\bcalc-size\(|\btext-box(-trim|-edge)?\s*:|::details-content|\bsibling-(index|count)\(|::scroll-(marker|button)|@function\b|\breading-flow\b|\bfont-palette\b|\binitial-letter\b/,
      'CSS newer than Chromium 87',
      'css',
    ],
  ];
  const partsOf = html => {
    const parts = { js: [], css: [] };
    html.replace(/<script>([\s\S]*?)<\/script>/g, (_, x) => parts.js.push(x));
    html.replace(/<style[^>]*>([\s\S]*?)<\/style>/g, (_, x) => parts.css.push(x));
    html.replace(/\sstyle="([^"]*)"/g, (_, x) => parts.css.push(x));
    return parts;
  };
  const bad = [];
  for (const f of pages) {
    const parts = partsOf(fs.readFileSync(f, 'utf8'));
    for (const r of rules)
      parts[r[2]]
        .join('\n')
        .split('\n')
        .forEach(line => {
          if (r[0].test(line)) bad.push(path.relative(root, f) + ': ' + r[1] + ': ' + line.trim().slice(0, 120));
        });
  }
  ok(!bad.length, 'the pages use nothing newer than Chromium 87' + (bad.length ? ':\n  ' + bad.join('\n  ') : ''));
  // the rules themselves: each catches what it is for, and what Chromium 87 has passes
  const hits = (where, line) => rules.some(r => r[2] === where && r[0].test(line));
  const newer = [
    ['js', 'var last = list.at(-1);'],
    ['js', "if (Object.hasOwn(o, 'k')) n++;"],
    ['js', 'var c = structuredClone(x);'],
    ['js', 'var id = crypto.randomUUID();'],
    ['css', '.a:is(.b, .c) { color: red }'],
    ['css', '#grid:not(.a .b) { gap: 0 }'],
    ['css', '.tile { aspect-ratio: 16 / 9 }'],
    ['css', '.full { height: 100dvh }'],
    ['css', '.card { overflow: clip }'],
    ['css', '.icon { translate: 0 4px }'],
    ['css', '.dim { background: color-mix(in srgb, red, blue) }'],
    ['css', '@media (width >= 600px) { .a { top: 0 } }'],
    ['css', '.x { mask-image: url(a.svg) }'],
  ].filter(x => !hits(x[0], x[1]));
  const fine = [
    ['js', 'var t = s.replaceAll("a", "b"), v = o?.k ?? 1;'],
    ['js', 'Promise.allSettled(jobs).then(done);'],
    ['css', '#grid { display: flex; gap: 16px; inset: 0 }'],
    ['css', '.tile:focus-visible { outline: none }'],
    ['css', 'body:not([data-galign=center]) #grid { gap: 8px }'],
    ['css', '.ico { -webkit-mask-image: url(a.svg); transform: translateY(4px) scale(1.1) }'],
    ['css', '@media (min-width: 600px) { .a { top: 0 } }'],
    ['css', '#sv.svw, .lvh-row { height: 100vh }'],
  ].filter(x => hits(x[0], x[1]));
  ok(
    !newer.length && !fine.length,
    'the rules catch what Chromium 87 lacks and let through what it has' +
      (newer.length ? '; not caught: ' + newer.map(x => x[1]).join(' ') : '') +
      (fine.length ? '; caught wrongly: ' + fine.map(x => x[1]).join(' ') : '')
  );
  // the scripts parse as ES2021, what Chromium 87 knows (ES2022's #x in and class static blocks came in 91 and 94): a slip there is a
  // page that stays blank on the TV only
  const acorn = require(path.join(root, 'tools', 'vendor', 'acorn.js'));
  for (const f of pages) {
    const html = fs.readFileSync(f, 'utf8'),
      re = /<script>([\s\S]*?)<\/script>/g;
    let m,
      err = '';
    while ((m = re.exec(html))) {
      try {
        acorn.parse(m[1], { ecmaVersion: 2021 });
      } catch (e) {
        err = e.message;
      }
    }
    ok(!err, 'the script of ' + path.relative(root, f) + ' parses as ES2021 (Chromium 87)' + (err ? ': ' + err : ''));
  }
  // and ES2021 is that line: a class static block does not parse, ?? and ||= (Chromium 80 and 85) do
  const parses = src => {
    try {
      acorn.parse(src, { ecmaVersion: 2021 });
      return true;
    } catch (_) {
      return false;
    }
  };
  ok(
    !parses('class A { static { this.x = 1; } }') && parses('var a = b ?? c; a ||= d; var e = f?.g;'),
    'ES2021 refuses a class static block (Chromium 94) and takes ?? and ||= (Chromium 80 and 85)'
  );
  // flex "gap" works from Chromium 84 on, so the old rule (sibling margins only) is gone; the script that once added the spacing after
  // each redraw made lists jump and left old text behind on webOS 5 (issues 4, 8, 13) and must not come back
  ok(
    !fs.existsSync(path.join(root, 'shared', 'flexgap.js')) && !/flexgap/.test(fs.readFileSync(path.join(root, 'ipk', 'build.py'), 'utf8')),
    'no script adds the spacing after a redraw'
  );
  ok(
    !/\.tile\.f\s*\{[^}]*outline/.test(fs.readFileSync(path.join(root, 'app', 'index.html'), 'utf8')) &&
      /\.tile\.f::before\s*\{[^}]*border-radius:/.test(fs.readFileSync(path.join(root, 'app', 'index.html'), 'utf8')) &&
      /\.tile\.fill\.f\s*\{\s*box-shadow:\s*0 0 0 var\(--ring-w\)/.test(fs.readFileSync(path.join(root, 'app', 'index.html'), 'utf8')),
    'the focus ring has its own rounded corners (an outline is a rectangle before Chromium 94), also on tiles that crop their picture'
  );
  const built = require(path.join(root, 'tools', 'build-pages.js'));
  for (const p of built.PAGES)
    ok(
      built.build(p[0]) === fs.readFileSync(path.join(root, p[1]), 'utf8'),
      p[1] + ' is built from ' + p[0] + ' (run: node tools/build-pages.js)'
    );
  // a long device name (HDMI-CEC) is the second line of a chip in the Inputs picker: the line could not shrink, so it was painted outside the
  // card, over the next ones (issue 19). It wraps onto a second line now, ends in an ellipsis there when that is not enough, and the card
  // reserves the two lines so every card's icon and port sit at the same height.
  const pickerPage = fs.readFileSync(path.join(root, 'picker', 'app', 'index.html'), 'utf8'),
    cssRule = (css, sel) => (css.match(new RegExp(sel.replace(/\./g, '\\.') + '\\s*\\{([^}]*)\\}')) || [])[1] || '',
    chipSt = cssRule(pickerPage, '.chip .st'),
    chipTx = cssRule(pickerPage, '.chip .tx');
  ok(
    /-webkit-line-clamp:\s*2/.test(chipSt) &&
      /overflow:\s*hidden/.test(chipSt) &&
      /min-height:\s*2\.4em/.test(chipSt) &&
      !/white-space:\s*nowrap/.test(chipSt) &&
      /text-align:\s*center/.test(chipSt) &&
      /width:\s*100%/.test(chipTx) &&
      /overflow:\s*hidden/.test(cssRule(pickerPage, '.chip')),
    'a long input name stays inside its card in the Inputs picker, on two lines'
  );
  // the favourite star and the menus' right-hand text both had the class st: the star's width squeezed the menu text into a column
  const launcher = fs.readFileSync(path.join(root, 'app', 'index.html'), 'utf8');
  ok(
    !/(^|\n)\s*\.st\s*\{/.test(launcher) && /svg\.st\s*\{\s*width:\s*26px/.test(launcher),
    "the favourite star is styled as svg.st, so the menu's .st text keeps its natural width"
  );
  // the light on open apps stays a small corner light (it was a 14 to 18 px dot with a 3 px dark ring, big over the icons)
  const picker = fs.readFileSync(path.join(root, 'picker', 'app', 'index.html'), 'utf8');
  const lights = [/\.tile \.rd \{[^}]*width: (\d+)px/, /#dock \.tile \.rd \{[^}]*width: (\d+)px/].map(r => +(r.exec(launcher) || [])[1]);
  const pick = +(/\.tile\.act::after\{[^}]*width:(\d+)px/.exec(picker) || [])[1];
  ok(
    lights.concat(pick).every(w => w > 0 && w <= 12),
    'the light on open apps is at most 12 px, on Home, the dock and the Inputs list: ' + lights.concat(pick)
  );
});
