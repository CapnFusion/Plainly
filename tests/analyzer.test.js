// Run with:  node tests/analyzer.test.js
const assert = require('assert');
const { analyse, countSyllables, splitSentences, fleschReadingEase } = require('../analyzer.js');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('ok   ' + name);
  } catch (err) {
    console.log('FAIL ' + name + '\n     ' + err.message);
    process.exitCode = 1;
  }
}

const sentencesOf = (text) => splitSentences(text).map((p) => text.slice(p.start, p.end));

test('Flesch formula matches a hand calculation', () => {
  // "The cat sat on the mat." = 6 words, 1 sentence, 6 syllables
  const expected = 206.835 - 1.015 * 6 - 84.6 * 1;
  assert.ok(Math.abs(fleschReadingEase(6, 1, 6) - expected) < 1e-9);
  const r = analyse('The cat sat on the mat.');
  assert.ok(Math.abs(r.flesch - 116.145) < 0.01, 'got ' + r.flesch);
});

test('syllable counts for common words', () => {
  const cases = {
    cat: 1, make: 1, table: 2, little: 2, walked: 1, wanted: 2, makes: 1, faces: 2,
    reading: 2, difficult: 3, readability: 5, university: 5, beautiful: 3, media: 3,
    radio: 3, various: 3, organisation: 5, comprehensive: 4
  };
  for (const [word, expected] of Object.entries(cases)) {
    assert.strictEqual(countSyllables(word), expected, `${word}: got ${countSyllables(word)}, expected ${expected}`);
  }
});

test('empty and whitespace-only input is rejected safely', () => {
  assert.strictEqual(analyse('').ok, false);
  assert.strictEqual(analyse('   \n\n  ').ok, false);
  assert.strictEqual(analyse('...!?').ok, false);
});

test('a single short sentence works', () => {
  const r = analyse('Hello there.');
  assert.ok(r.ok);
  assert.strictEqual(r.sentenceCount, 1);
  assert.strictEqual(r.top.length, 1);
});

test('fewer than five sentences returns only what exists', () => {
  const r = analyse('One short one. Another short one here. And a third sentence.');
  assert.strictEqual(r.sentenceCount, 3);
  assert.strictEqual(r.top.length, 3);
});

test('abbreviations and decimals do not split sentences', () => {
  const text = 'Dr. Rao met Mr. Smith at 3.5 percent growth, e.g. in the U.S. market. They left.';
  assert.deepStrictEqual(sentencesOf(text), [
    'Dr. Rao met Mr. Smith at 3.5 percent growth, e.g. in the U.S. market.',
    'They left.'
  ]);
});

test('blank lines separate paragraphs; positions point at the original text', () => {
  const text = 'A heading without a full stop\n\nFirst sentence here. Second one follows!\n\nLast?';
  const found = splitSentences(text);
  assert.strictEqual(found.length, 4);
  for (const p of found) assert.ok(text.slice(p.start, p.end).trim().length > 0);
  assert.strictEqual(text.slice(found[1].start, found[1].end), 'First sentence here.');
});

test('top sentences are exact slices of the original input, ranked hardest first', () => {
  const text =
    'It is fine. We went home. ' +
    'Notwithstanding the preliminary nature of the quarterly figures, which were compiled hastily by an understaffed department, the leadership nevertheless authorised a comprehensive reorganisation of the regional distribution infrastructure. ' +
    'The end. Yes. No. Maybe so.';
  const r = analyse(text);
  assert.ok(r.top.length <= 5);
  for (const s of r.top) assert.strictEqual(text.slice(s.start, s.end), s.text);
  assert.ok(r.top[0].text.startsWith('Notwithstanding'));
  for (let i = 1; i < r.top.length; i++) assert.ok(r.top[i - 1].difficulty >= r.top[i].difficulty);
});

test('a one-word fragment cannot outrank a genuinely long sentence', () => {
  const text = 'Incomprehensibilities. This sentence is considerably longer, with several clauses, and somewhat complicated vocabulary throughout, which makes it harder to read.';
  const r = analyse(text);
  assert.ok(r.top[0].text.startsWith('This sentence'));
});

test('repeated analysis gives identical results', () => {
  const text = 'The quick brown fox jumps over the lazy dog. Simple words make simple sentences.';
  assert.deepStrictEqual(analyse(text), analyse(text));
});

console.log(`\n${passed} passed`);
