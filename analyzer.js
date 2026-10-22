/*
  analyzer.js — the "brain" of Plainly.
  Text goes in, numbers come out. There is no page/DOM code in this file,
  which is why we can also test it from the command line with Node.
*/

// Words ending in a full stop that do NOT mean "the sentence ended here".
const ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'vs',
  'fig', 'vol', 'inc', 'ltd', 'approx', 'dept', 'cf', 'pp', 'mt'
]);

// Words our syllable rules get wrong, so we just list the right answer.
const SYLLABLE_EXCEPTIONS = {
  the: 1, people: 2, business: 2, every: 2, different: 3,
  being: 2, idea: 3, area: 3, create: 2
};

// A "word" = letters/digits, optionally joined by ' or - (don't, well-known).
const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu;

function getWords(text) {
  return text.match(WORD_PATTERN) || [];
}

/* ---------- 1. Counting syllables ---------- */

function countSyllables(word) {
  const lower = word.toLowerCase();

  if (/\d/.test(lower)) return 1; // numbers: keep it simple

  if (lower.includes('-')) {
    return lower.split('-').reduce((sum, part) => sum + (part ? countSyllables(part) : 0), 0) || 1;
  }

  const w = lower.replace(/[^a-z]/g, '');
  if (w.length === 0) return 1;
  if (SYLLABLE_EXCEPTIONS[w]) return SYLLABLE_EXCEPTIONS[w];
  if (w.length <= 3) return 1;

  // Step 1: each group of vowels is roughly one syllable.
  let count = (w.match(/[aeiouy]+/g) || []).length;

  // Step 2: remove endings that are usually silent.
  if (/[^aeiouy]e$/.test(w) && !/[^aeiouy]le$/.test(w)) {
    count--;                                   // "make", "there" (but not "table")
  } else if (/[^aeiouy]es$/.test(w) && !/(?:[sxzcg]|ch|sh)es$/.test(w)) {
    count--;                                   // "makes" (but not "faces", "boxes")
  } else if (/[^aeiouy]ed$/.test(w) && !/[td]ed$/.test(w)) {
    count--;                                   // "walked" (but not "wanted")
  }

  // Step 3: some vowel pairs are really two syllables ("media", "radio", "various").
  if (/[^cgstx]ia|ium|[^cgstx]io(?![nu])|[^cgstx]iou/.test(w)) count++;

  return Math.max(1, count);
}

/* ---------- 2. Splitting text into sentences ---------- */
// We keep the position (start/end) of every sentence in the ORIGINAL text,
// so we can highlight the exact wording the user pasted.

function splitSentences(text) {
  const sentences = [];
  const paragraphBreak = /\n\s*\n/g;      // a blank line always ends a sentence
  let paragraphStart = 0;
  let match;

  while ((match = paragraphBreak.exec(text)) !== null) {
    splitParagraph(text, paragraphStart, match.index, sentences);
    paragraphStart = match.index + match[0].length;
  }
  splitParagraph(text, paragraphStart, text.length, sentences);
  return sentences;
}

function splitParagraph(text, from, to, sentences) {
  const paragraph = text.slice(from, to);
  const endPattern = /[.!?…]+["'”’)\]]*(?=\s|$)/g;  // . ! ? followed by space or end
  let segmentStart = 0;
  let m;

  while ((m = endPattern.exec(paragraph)) !== null) {
    const segmentEnd = m.index + m[0].length;
    if (!isSentenceEnd(paragraph, m.index, segmentEnd)) continue;
    addSegment(paragraph, segmentStart, segmentEnd, from, sentences);
    segmentStart = segmentEnd;
  }
  addSegment(paragraph, segmentStart, paragraph.length, from, sentences);
}

function isSentenceEnd(paragraph, punctStart, punctEnd) {
  // If the next letter is lowercase, the sentence is probably still going.
  const nextChar = (paragraph.slice(punctEnd).match(/\S/) || [''])[0];
  if (/[a-z]/.test(nextChar)) return false;

  if (paragraph[punctStart] === '.') {
    const wordBefore = (paragraph.slice(0, punctStart).match(/[A-Za-z.]+$/) || [''])[0];
    if (ABBREVIATIONS.has(wordBefore.toLowerCase())) return false;          // "Dr."
    if (/^[A-Z]$/.test(wordBefore)) return false;                           // "J. K. Rowling"
    if (/^(?:[A-Za-z]\.)+[A-Za-z]$/.test(wordBefore)) return false;         // "e.g." "U.S."
  }
  return true;
}

function addSegment(paragraph, s, e, offset, sentences) {
  let start = s;
  let end = e;
  while (start < end && /\s/.test(paragraph[start])) start++;
  while (end > start && /\s/.test(paragraph[end - 1])) end--;
  if (!/[\p{L}\p{N}]/u.test(paragraph.slice(start, end))) return; // skip stray punctuation
  sentences.push({ start: offset + start, end: offset + end });
}

/* ---------- 3. Scoring ---------- */

// Flesch Reading Ease: 206.835 − 1.015 × (words / sentences) − 84.6 × (syllables / words)
function fleschReadingEase(words, sentences, syllables) {
  return 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
}

// Flesch–Kincaid Grade Level: roughly "which US school grade can read this".
function fleschKincaidGrade(words, sentences, syllables) {
  return 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59;
}

function describeScore(score) {
  if (score >= 90) return { label: 'Very easy', note: 'Easy for almost any reader. Around 5th-grade level.' };
  if (score >= 80) return { label: 'Easy', note: 'Conversational English. Around 6th-grade level.' };
  if (score >= 70) return { label: 'Fairly easy', note: 'Easy for most adults. Around 7th-grade level.' };
  if (score >= 60) return { label: 'Plain English', note: 'Clear for most readers. Around 8th to 9th-grade level.' };
  if (score >= 50) return { label: 'Fairly difficult', note: 'Takes some effort. Around 10th to 12th-grade level.' };
  if (score >= 30) return { label: 'Difficult', note: 'College level. Many readers will struggle.' };
  if (score >= 0) return { label: 'Very difficult', note: 'Graduate level. Best for specialist readers.' };
  return { label: 'Extremely difficult', note: 'Even specialist readers will find this heavy going.' };
}

/* ---------- 4. Ranking sentences by difficulty ---------- */
// Difficulty is a 0–100 score made of four signals we can explain to anyone:
//   length (45)  +  share of long words (25)  +  syllables per word (20)  +  commas/clauses (10)
// Very short fragments are scaled down so "Supercalifragilistic." can't win.

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

function difficultyOf(s) {
  const length = Math.min(s.wordCount / 45, 1) * 45;
  const longWords = Math.min(s.complexWords.length / s.wordCount / 0.35, 1) * 25;
  const density = clamp((s.syllables / s.wordCount - 1.2) / 1.0, 0, 1) * 20;
  const clauses = Math.min(s.breaks / 5, 1) * 10;
  const shortPenalty = Math.min(s.wordCount / 10, 1);
  return (length + longWords + density + clauses) * shortPenalty;
}

function reasonsFor(s, averageWords) {
  const reasons = [];
  if (s.wordCount >= 20) {
    reasons.push(`Long: ${s.wordCount} words (your average is ${Math.round(averageWords)})`);
  }
  if (s.complexWords.length >= 2) {
    const examples = [...new Set(s.complexWords.map((w) => w.toLowerCase()))].slice(0, 3);
    reasons.push(`${s.complexWords.length} long words, like ${examples.map((w) => `“${w}”`).join(', ')}`);
  }
  if (s.breaks >= 3) {
    reasons.push(`${s.breaks} commas, brackets or dashes make it hard to follow`);
  }
  if (s.syllables / s.wordCount >= 1.8 && s.complexWords.length < 2) {
    reasons.push('Dense vocabulary');
  }
  if (reasons.length === 0) {
    reasons.push('A bit longer or denser than your other sentences');
  }
  return reasons;
}

/* ---------- 5. Putting it all together ---------- */

function analyse(text) {
  const sentences = splitSentences(text)
    .map((pos) => {
      const raw = text.slice(pos.start, pos.end);
      const words = getWords(raw);
      const syllablesPerWord = words.map(countSyllables);
      return {
        start: pos.start,
        end: pos.end,
        text: raw,
        wordCount: words.length,
        syllables: syllablesPerWord.reduce((a, b) => a + b, 0),
        complexWords: words.filter((w, i) => syllablesPerWord[i] >= 3),
        breaks: (raw.match(/[,;:(—–]|\s-\s/g) || []).length
      };
    })
    .filter((s) => s.wordCount > 0);

  const wordCount = sentences.reduce((n, s) => n + s.wordCount, 0);
  if (wordCount === 0) return { ok: false, error: 'no-words' };

  const sentenceCount = sentences.length;
  const syllableCount = sentences.reduce((n, s) => n + s.syllables, 0);
  const flesch = fleschReadingEase(wordCount, sentenceCount, syllableCount);
  const grade = fleschKincaidGrade(wordCount, sentenceCount, syllableCount);
  const averageWords = wordCount / sentenceCount;

  const top = sentences
    .map((s) => ({ ...s, difficulty: difficultyOf(s) }))
    .sort((a, b) => b.difficulty - a.difficulty)
    .slice(0, 5)
    .map((s, i) => ({
      rank: i + 1,
      start: s.start,
      end: s.end,
      text: s.text,
      difficulty: Math.round(s.difficulty),
      reasons: reasonsFor(s, averageWords)
    }));

  return {
    ok: true,
    wordCount,
    sentenceCount,
    syllableCount,
    averageWords,
    syllablesPerWord: syllableCount / wordCount,
    flesch,
    grade,
    band: describeScore(flesch),
    shortText: wordCount < 100,
    top
  };
}

// This lets Node load the file for testing. In the browser it does nothing.
if (typeof module !== 'undefined') {
  module.exports = { analyse, countSyllables, splitSentences, getWords, describeScore, fleschReadingEase };
}
