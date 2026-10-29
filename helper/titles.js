// Titles as they are compared (search.js, where.js): one way to write a title for matching, and how well a title matches the words.
//   norm(s)          lower case, no accents, "&" as "and", no punctuation (an apostrophe joins: "Grey's" is "greys"), no year in
//                    brackets, no leading "The"
//   score(title, q)  0 to 100 for two normalized texts: the same 100, the start of the title, every word the start of a word, the title
//                    written as one word, a part of it, then one typo (two from 8 letters)
//   match(title, q)  score() of a title as it is written against normalized words, a year typed at the end tried without it too
// Latin letters with accents, for a Node without the full Unicode tables (normalize then does nothing)
const FOLD = {
  a: '\u00e0\u00e1\u00e2\u00e3\u00e4\u00e5\u0101',
  c: '\u00e7\u0107\u010d',
  e: '\u00e8\u00e9\u00ea\u00eb\u0113\u0117',
  i: '\u00ec\u00ed\u00ee\u00ef\u012b',
  n: '\u00f1\u0144',
  o: '\u00f2\u00f3\u00f4\u00f5\u00f6\u00f8\u014d',
  u: '\u00f9\u00fa\u00fb\u00fc\u016b',
  y: '\u00fd\u00ff',
  s: '\u015b\u0161',
  z: '\u017a\u017c\u017e',
};
const FOLD_RE = new RegExp(
    '[' +
      Object.keys(FOLD)
        .map(k => FOLD[k])
        .join('') +
      ']',
    'g'
  ),
  FOLD_OF = {};
for (const k of Object.keys(FOLD)) for (const ch of FOLD[k]) FOLD_OF[ch] = k;
// punctuation and symbols (ASCII, Latin-1, general punctuation, arrows and shapes, CJK punctuation); letters of every script stay
const PUNCT = /[\u0000-/:-@[-`{-\u00bf\u00d7\u00f7\u2000-\u206f\u2190-\u2bff\u3000-\u303f\ufe30-\ufe4f\uff01-\uff0f]+/g;

// a title or the words as they are compared: lower case, no accents, "&" as "and", no punctuation (an apostrophe joins: "Grey's" is
// "greys"), no year in brackets, no leading "The"
function norm(s) {
  let x = String(s || '').toLowerCase();
  try {
    x = x.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  } catch (_) {}
  return x
    .replace(FOLD_RE, ch => FOLD_OF[ch])
    .replace(/\u00df/g, 'ss')
    .replace(/[(\[]\s*(1[89]|20)\d\d\s*[)\]]/g, ' ')
    .replace(/['\u2019`\u00b4]/g, '')
    .replace(/&/g, ' and ')
    .replace(PUNCT, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^the /, '');
}

// edit distance (insert, delete, change one letter), for one typo; short strings only
function dist(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let prev = [];
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++)
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

// how well a title (normalized) matches the words (normalized): 0 not at all, 100 the same
function score(title, q) {
  if (!title || !q) return 0;
  if (title === q) return 100;
  if (title.indexOf(q) === 0) return title.charAt(q.length) === ' ' ? 90 : 80;
  const tw = title.split(' '),
    qw = q.split(' ');
  const prefixOf = w => tw.some(t => t.indexOf(w) === 0);
  if (qw.every(prefixOf)) return 70;
  const t0 = title.replace(/ /g, ''),
    q0 = q.replace(/ /g, '');
  if (t0.indexOf(q0) === 0) return 65; // "spiderman" for "Spider-Man"
  if (title.indexOf(q) >= 0) return 50;
  // a typo: one (two from 8 letters) in the whole title, one in the start of a title typed so far (from 6 letters), or one in each
  // word of 5 letters or more (shorter words as typed)
  if (q0.length >= 5 && q0.length <= 64) {
    const allow = q0.length >= 8 ? 2 : 1;
    if (dist(t0, q0) <= allow || (q0.length >= 6 && dist(t0.slice(0, q0.length), q0) <= 1)) return 40;
    if (qw.some(w => w.length >= 5) && qw.every(w => (w.length >= 5 ? tw.some(t => dist(t, w) <= 1) : prefixOf(w)))) return 35;
  }
  return 0;
}

// a title as written against normalized words; "dune 2021": a year at the end may be the film's, not its title's (ranked a little
// below the title as typed)
function match(title, q) {
  const t = norm(title),
    noYear = q.replace(/ (1[89]|20)\d\d$/, '');
  return Math.max(score(t, q), noYear !== q ? score(t, noYear) - 5 : 0);
}

module.exports = { norm, score, match };
