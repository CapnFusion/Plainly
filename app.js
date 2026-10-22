/*
  app.js — the "face" of Plainly.
  It reads what the user typed, asks analyzer.js (the brain) for numbers,
  then draws the results on the page.
*/

const MAX_CHARS = 100000;
const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five'];

const SAMPLE_TEXT =
`Our team met on Tuesday. The results were clear. Sales rose in March, and nobody was surprised.

However, notwithstanding the preliminary nature of the quarterly figures, which were compiled hastily by an understaffed department without the benefit of independent verification, the leadership team nevertheless proceeded to authorise a comprehensive restructuring of the organisation's regional distribution infrastructure. Why? Nobody really knows.

The committee's recommendation, drafted in collaboration with external consultants whose methodologies have occasionally been criticised for oversimplifying multidimensional operational considerations, emphasised the desirability of consolidating warehouses. We went home early that day. Dr. Rao later noted that the decision, although controversial, was consistent with the company's long-term strategic objectives (see Fig. 2 in the appendix).`;

const els = {
  input: document.getElementById('text-input'),
  error: document.getElementById('error'),
  wordCount: document.getElementById('word-count'),
  analyseBtn: document.getElementById('analyse-btn'),
  sampleBtn: document.getElementById('sample-btn'),
  clearBtn: document.getElementById('clear-btn'),
  resetBtn: document.getElementById('reset-btn'),
  results: document.getElementById('results'),
  resultsHeading: document.getElementById('results-heading'),
  scoreNumber: document.getElementById('score-number'),
  scoreLabel: document.getElementById('score-label'),
  scoreNote: document.getElementById('score-note'),
  meterMarker: document.getElementById('meter-marker'),
  statWords: document.getElementById('stat-words'),
  statSentences: document.getElementById('stat-sentences'),
  statWps: document.getElementById('stat-wps'),
  statSpw: document.getElementById('stat-spw'),
  statGrade: document.getElementById('stat-grade'),
  shortNote: document.getElementById('short-note'),
  markedText: document.getElementById('marked-text'),
  listHeading: document.getElementById('list-heading'),
  rankingNote: document.getElementById('ranking-note'),
  hardList: document.getElementById('hard-list')
};

/* ---------- Small helpers ---------- */

// Builds an element. We always use textContent (never innerHTML), so
// pasted text can't inject HTML into the page.
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function showError(message) {
  els.error.textContent = message;
  els.error.hidden = false;
}

function hideError() {
  els.error.hidden = true;
  els.error.textContent = '';
}

function updateWordCount() {
  const n = getWords(els.input.value).length;
  els.wordCount.textContent = n + (n === 1 ? ' word' : ' words');
}

function describeGrade(grade) {
  if (grade < 1) return 'Below grade 1';
  if (grade > 18) return 'Graduate level';
  return 'Grade ' + Math.round(grade);
}

/* ---------- Main flow ---------- */

function run() {
  const text = els.input.value;

  if (!text.trim()) {
    els.results.hidden = true;
    showError('Paste some text first, then press Check readability.');
    els.input.focus();
    return;
  }
  if (text.length > MAX_CHARS) {
    showError('That is a lot of text (over 100,000 characters). Paste a section of up to about 15,000 words.');
    return;
  }

  const result = analyse(text);
  if (!result.ok) {
    els.results.hidden = true;
    showError('Plainly could not find any words in that text. Try pasting normal sentences.');
    return;
  }

  hideError();
  render(text, result);
}

function render(text, r) {
  // Score
  els.scoreNumber.textContent = r.flesch.toFixed(1);
  els.scoreLabel.textContent = r.band.label;
  els.scoreNote.textContent = r.band.note;
  els.meterMarker.style.left = Math.min(100, Math.max(0, r.flesch)) + '%';

  // Stats
  els.statWords.textContent = r.wordCount.toLocaleString();
  els.statSentences.textContent = r.sentenceCount.toLocaleString();
  els.statWps.textContent = r.averageWords.toFixed(1);
  els.statSpw.textContent = r.syllablesPerWord.toFixed(2);
  els.statGrade.textContent = describeGrade(r.grade);
  els.shortNote.hidden = !r.shortText;

  renderMarkedText(text, r.top);
  renderList(r);

  els.results.hidden = false;
  els.resultsHeading.focus({ preventScroll: true });
  els.results.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
}

// Rebuilds the user's original text, wrapping the hard sentences in <mark>.
function renderMarkedText(text, top) {
  const inOrder = top.slice().sort((a, b) => a.start - b.start);
  const fragment = document.createDocumentFragment();
  let position = 0;

  for (const s of inOrder) {
    if (s.start > position) fragment.append(text.slice(position, s.start));

    const mark = el('mark', 'rank-' + s.rank);
    mark.id = 'hl-' + s.rank;
    mark.append(text.slice(s.start, s.end));
    const badge = el('sup', 'badge', String(s.rank));
    badge.setAttribute('aria-label', 'hardest sentence number ' + s.rank);
    mark.append(badge);

    fragment.append(mark);
    position = s.end;
  }
  if (position < text.length) fragment.append(text.slice(position));

  els.markedText.replaceChildren(fragment);
}

function renderList(r) {
  const count = r.top.length;

  els.listHeading.textContent =
    count === 1 ? 'The hardest sentence' : 'The ' + COUNT_WORDS[count] + ' hardest sentences';

  // A short note when the situation is unusual.
  let note = '';
  if (r.sentenceCount <= 5) {
    note = 'Your text has ' + r.sentenceCount + (r.sentenceCount === 1 ? ' sentence' : ' sentences') +
      ', so ' + (r.sentenceCount === 1 ? 'that is the only one' : 'all of them are') + ' shown here.';
  } else if (r.top[0].difficulty < 30) {
    note = 'Even your hardest sentences are fairly easy to read.';
  }
  els.rankingNote.textContent = note;
  els.rankingNote.hidden = note === '';

  const items = r.top.map((s) => {
    const item = el('li', 'hard-item rank-' + s.rank);

    const head = el('div', 'hard-head');
    head.append(el('span', '', '#' + s.rank));
    head.append(el('span', 'rating', 'Difficulty ' + s.difficulty + ' out of 100'));
    item.append(head);

    item.append(el('p', 'hard-sentence', s.text));

    const reasons = el('ul', 'reasons');
    for (const reason of s.reasons) reasons.append(el('li', '', reason));
    item.append(reasons);

    const show = el('button', 'link-button', 'Show in text');
    show.type = 'button';
    show.addEventListener('click', () => jumpToHighlight(s.rank));
    item.append(show);

    return item;
  });

  els.hardList.replaceChildren(...items);
}

function jumpToHighlight(rank) {
  const mark = document.getElementById('hl-' + rank);
  if (!mark) return;
  mark.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
  mark.classList.add('flash');
  setTimeout(() => mark.classList.remove('flash'), 1500);
}

function resetAll() {
  els.input.value = '';
  els.results.hidden = true;
  hideError();
  updateWordCount();
  els.input.focus();
}

/* ---------- Wire up the page ---------- */

els.input.addEventListener('input', () => {
  hideError();
  updateWordCount();
});

els.input.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') run();
});

els.analyseBtn.addEventListener('click', run);

els.sampleBtn.addEventListener('click', () => {
  els.input.value = SAMPLE_TEXT;
  updateWordCount();
  run();
});

els.clearBtn.addEventListener('click', resetAll);
els.resetBtn.addEventListener('click', resetAll);

updateWordCount();
