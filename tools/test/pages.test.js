// The pages that run on the TV (launcher, manager, picker, notification card): nothing newer than Chromium 120 (webOS 25, the oldest
// TV this fork supports: DECISIONS.md D-20261029-3), and fixes that must not come back. The scripts written for Chromium 68 stay ES5
// until they are touched for another reason; new code may use what Chromium 120 has.
const fs = require('fs'),
  path = require('path');
const { root, ok, run } = require('./lib');

run(async () => {
  const pages = ['app', 'manager/app', 'picker/app', 'notify/app'].map(d => path.join(root, d, 'index.html'));
  // what Chromium 120 does not have yet: add to it when you find another
  const rules = [
    [
      /\bArray\.fromAsync\b|\.(union|intersection|symmetricDifference|isSubsetOf|isSupersetOf|isDisjointFrom)\(|\bPromise\.try\b|\bURL\.parse\(|\bRegExp\.escape\b|\bError\.isError\b|\bFloat16Array\b|\.(fromBase64|toBase64|fromHex|toHex)\(|\bIntl\.DurationFormat\b/,
      'a function newer than Chromium 120',
    ],
    [
      /light-dark\(|\bfield-sizing\b|\banchor-name\b|\bposition-anchor\b|\bposition-area\b|@position-try\b|@view-transition\b|:state\(|\bscrollbar-(width|color)\b|\binterpolate-size\b|\bcalc-size\(|\btext-box(-trim|-edge)?\s*:|::details-content|\bsibling-(index|count)\(|::scroll-(marker|button)|@function\b|\breading-flow\b/,
      'CSS newer than Chromium 120',
    ],
  ];
  const bad = [];
  for (const f of pages)
    fs.readFileSync(f, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        for (const r of rules) if (r[0].test(line)) bad.push(path.relative(root, f) + ':' + (i + 1) + ' ' + r[1]);
      });
  ok(!bad.length, 'the pages use nothing newer than Chromium 120' + (bad.length ? ':\n  ' + bad.join('\n  ') : ''));
  // the scripts parse as ES2023, what Chromium 120 knows: a slip there is a page that stays blank on the TV only
  const acorn = require(path.join(root, 'tools', 'vendor', 'acorn.js'));
  for (const f of pages) {
    const html = fs.readFileSync(f, 'utf8'),
      re = /<script>([\s\S]*?)<\/script>/g;
    let m,
      err = '';
    while ((m = re.exec(html))) {
      try {
        acorn.parse(m[1], { ecmaVersion: 2023 });
      } catch (e) {
        err = e.message;
      }
    }
    ok(!err, 'the script of ' + path.relative(root, f) + ' parses as ES2023 (Chromium 120)' + (err ? ': ' + err : ''));
  }
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
});
