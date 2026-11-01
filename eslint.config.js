// Lint rules (node tools/lint.js). The service runs on Node 12.21 and the pages on Chromium 87 (webOS 22, the oldest TV this fork
// supports: DECISIONS.md D-20261101-1): the syntax each may use is set here, and the rules catch mistakes a test may not reach, such as
// a name that is used but never defined.
const globals = require('globals');

const mistakes = {
  'no-undef': 'error',
  'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
  'no-dupe-keys': 'error',
  'no-unreachable': 'error',
  'no-redeclare': 'error',
  'no-self-assign': 'error',
  'no-constant-condition': ['error', { checkLoops: false }],
};

module.exports = [
  {
    // the service, the scripts the setup runs on the TV, and the tests (tools/check.sh runs them on Node 12.21 too)
    files: ['helper/*.js', 'scripts/*.js', 'tools/test.js', 'tools/test/**/*.js'],
    // ES2019: Node 12 parses ES2019 and a little more, but not ?. and ?? (ES2020); newer functions are caught by
    // tools/test/service.test.js
    languageOptions: { ecmaVersion: 2019, sourceType: 'commonjs', globals: Object.assign({}, globals.node) },
    rules: mistakes,
  },
  {
    // the other tools run on this computer's Node (16 or newer)
    files: ['tools/**/*.js'],
    ignores: ['tools/vendor/**', 'tools/test.js', 'tools/test/**'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: Object.assign({}, globals.node) },
    rules: mistakes,
  },
  {
    // the scripts of the built pages, given to ESLint by tools/lint.js
    files: ['**/*.page.js'],
    languageOptions: {
      // ES2021: what Chromium 87 parses (ES2022's class static blocks, #x in and top-level await came later; the older scripts
      // are ES5 and stay so until they are touched)
      ecmaVersion: 2021,
      sourceType: 'script',
      // the browser's globals and what webOS adds
      globals: Object.assign({}, globals.browser, {
        Promise: 'readonly',
        Intl: 'readonly',
        webOS: 'readonly',
        webOSSystem: 'readonly',
        PalmSystem: 'readonly',
        PalmServiceBridge: 'readonly',
        CYTV_TOKEN: 'readonly', // cytv-token.js, written next to the page by the service (helper/apitoken.js)
        qrcode: 'readonly',
      }),
    },
    // a page's functions are called from its markup and from each other across the files it is built from
    rules: Object.assign({}, mistakes, { 'no-unused-vars': 'off' }),
  },
];
