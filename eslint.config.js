// Lint rules (node tools/lint.js). The service runs on Node 16 and the pages on Chromium 120 (webOS 25, the oldest TV this fork
// supports): the syntax each may use is set here, and the rules catch mistakes a test may not reach, such as a name that is used but
// never defined.
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
    files: ['helper/*.js', 'scripts/jtool.js', 'tools/**/*.js'],
    ignores: ['tools/vendor/**'],
    // ES2022: what Node 16 parses (newer functions are caught by tools/test/service.test.js)
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: Object.assign({}, globals.node) },
    rules: mistakes,
  },
  {
    // the scripts of the built pages, given to ESLint by tools/lint.js
    files: ['**/*.page.js'],
    languageOptions: {
      // ES2023: what Chromium 120 parses (the older scripts are ES5 and stay so until they are touched)
      ecmaVersion: 2023,
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
