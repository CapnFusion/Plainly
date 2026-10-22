# Plainly

A free readability checker. Paste some writing and Plainly shows:

- a **readability score** (Flesch Reading Ease) with a plain-English reading level
- the **five hardest sentences**, highlighted in your original text
- a short reason for each one (too long, too many long words, too many commas)

No sign-up, no server, no tracking. Your text is analysed in your browser and is never uploaded.

**Live site:** _add your GitHub Pages link here once it is deployed and tested_

## How it works

| File | Job |
| --- | --- |
| `index.html` | The page structure |
| `style.css` | Layout, colours, mobile design |
| `analyzer.js` | The "brain": splits sentences, counts syllables, calculates scores. No page code in it |
| `app.js` | The "face": reads the text box, calls the brain, draws the results |
| `tests/analyzer.test.js` | Checks the brain from the command line |

### The score

```
Flesch Reading Ease = 206.835 − 1.015 × (words ÷ sentences) − 84.6 × (syllables ÷ words)
```

Higher means easier. 60–70 is plain English; below 30 is graduate-level writing.
Plainly also shows the Flesch–Kincaid Grade Level: `0.39 × (words ÷ sentences) + 11.8 × (syllables ÷ words) − 15.59`.

### Ranking the hardest sentences

Each sentence gets a difficulty rating out of 100:

| Signal | Points |
| --- | --- |
| Length (full marks at 45+ words) | 45 |
| Share of long words (3+ syllables; full marks at 35%) | 25 |
| Average syllables per word | 20 |
| Commas, semicolons, colons, brackets and dashes (full marks at 5) | 10 |

Sentences under 10 words are scaled down so a short fragment with one long word can't win.
The top five are highlighted. If the text has fewer than five sentences, all of them are shown.

## Known limitations

- Syllable counting uses rules of thumb, so some words are off by one.
- Sentences are split on `.`, `?` and `!`. Headings without punctuation, bullet lists and unusual abbreviations can confuse it.
- Built for English only.
- The score estimates how hard text is to read. It does not measure comprehension or quality.
- The sentence ranking is a heuristic. It does not understand meaning.

## Run it locally

Open `index.html` in a browser. No build step needed.

Run the tests (needs [Node.js](https://nodejs.org)):

```
node tests/analyzer.test.js
```

## Deploy on GitHub Pages

1. Create a public repository on GitHub and upload all files in this folder (keep `tests/` as a folder).
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to *Deploy from a branch*, choose branch `main` and folder `/ (root)`, then save.
4. After a minute or two, the site appears at `https://<your-username>.github.io/<repository-name>/`.

## Manual test checklist

- [ ] Empty input shows a message instead of a result
- [ ] One short sentence works
- [ ] A long paragraph with mixed sentence lengths highlights five sentences
- [ ] Difficult vocabulary ranks near the top
- [ ] Abbreviations (Dr., e.g., Fig. 2), decimals and several paragraphs behave
- [ ] Fewer than five sentences shows only what exists
- [ ] Analysing twice, then **Clear** and **Check another text**, works
- [ ] Layout and highlights are readable on a phone
