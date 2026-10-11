# Writing lessons

Lessons are Markdown files in `content/lessons/`. They're compiled to static JSON by `scripts/compile-lessons.mjs`, so they load from Vercel even while the API is asleep (spec §5).

- `curriculum.json`: levels and modules, in order. A lesson's `module` must be a slug from here.
- `glossary.json`: terms that `[[term]]` links can open. Unknown terms fail the build.
- `lessons/level-N/*.md`: one file per lesson.

## A lesson file

```markdown
---
id: l1-what-a-pip-is-worth        # unique slug, used in the URL and for progress
level: 1
module: pips-lots-leverage-margin
order: 1                          # position within the module
title: What a pip is worth
status: draft                     # draft | published
minutes: 5                        # estimate shown on the Learn page
---

First screen. Keep it to three short paragraphs at most.

---

A line with only three dashes starts a new screen.
```

## Blocks

| Write | You get |
|---|---|
| Plain paragraphs, `- ` lists | Text |
| `**bold**`, `[label](https://…)`, `[[pip]]` or `[[pip\|pips]]` | Emphasis, an external link, a glossary term |
| `::simulator{kind="position-size"}` | A simulator: `position-size`, `expectancy`, `drawdown`. On wide screens it sits beside the text on the same screen. |
| `::diagram{src="/lessons/img/x.svg" alt="What it shows"}` | An image. Put files in `public/lessons/img/`. |
| `::takeaway` … `::` | The key takeaway, repeated on the completion screen |
| `::question{type="mc"}` … `::` | Multiple choice: options as `- [ ]` and one `- [x]`, then `? Explanation.` |
| `::question{type="numeric" answer="0.05" tolerance="0.005" unit="lots"}` … `::` | Numeric, right within the tolerance |

Put each question on its own screen. Every question needs a `? explanation`: it's shown after "Check", whether the answer was right or not. These are practice questions; their answers ship to the browser. Exam questions live on the server (Django admin) and never do.

Follow DESIGN.md §2 for wording: plain words, a reading age of about 12, describe rather than instruct, no hype words.

## Commands

```bash
npm run dev            # compiles drafts too, then starts Vite
npm run lessons        # compile including drafts
npm run build          # compiles published lessons only
```

After compiling, mirror the curriculum into the database so progress can be saved:

```bash
cd ../backend
python manage.py sync_curriculum ../frontend/public/lessons/index.json
```

Run it on every deploy after the frontend build. Lessons removed from the index are set back to draft; progress already recorded is kept.

## Publishing

Change `status: draft` to `status: published`. Spec §5: Level 1 is tested with 3 to 5 outside beginners before Level 2 is written.

## Citing sources

`content/sources.json` is the only place a lesson can cite. Each entry has an id, author, title, year, link, a one-line "about" and, for data sources, the exact `facts` a lesson may state.

- Cite inline with `[@source-id]`, after the idea you took from it. It shows as "(Douglas, 2000)" and opens the full reference. Each lesson's completion screen lists its sources.
- Quotes: `::quote{source="douglas-trading-in-the-zone" page="57"}` … `::`, at most 40 words, checked against the book by a person. Paraphrase where you can (spec §17).
- Unknown ids fail the build. Run `npm run sources:check` after adding a source to confirm its link is live.

## Drafting with AI (Gemini)

`scripts/ai/draft.mjs` drafts outlines and lessons with Gemini. The key comes from `GEMINI_API_KEY` in the environment or `backend/.env`. Model: `GEMINI_MODEL`, default `gemini-3.5-flash`.

```bash
npm run draft -- outline pairs-and-quotes          # proposes 2–4 lessons -> content/outlines/<module>.json
npm run draft -- lesson pairs-and-quotes 2         # drafts lesson 2 of that outline
npm run draft -- module pairs-and-quotes           # outline, then every lesson
# --force redrafts existing files; --grounded tries Google Search grounding
```

What the tool enforces:

- Citations only by id from `sources.json`, at most one per screen; figures only from a source's `facts`.
- No quotes, no banned words, a true minus sign, 4–7 screens, at least one practice question, a takeaway, at least one citation. A draft that breaks a rule gets one automatic retry; if it still fails it's saved to `content/drafts/` and not used.
- New glossary terms are proposed in `content/glossary.suggested.json`; copy the ones you accept into `glossary.json`.
- With `--grounded`, web pages the model used are saved to `content/drafts/<slug>.web-sources.json` for you to check. They're never added to `sources.json` automatically. Grounding needs a key with billing enabled; without it the tool says so and continues.

Every draft is saved as `status: draft` with `review: pending`. **The build refuses to publish an AI draft until you set `review: done`.** Before that, check every fact, every calculation in the question explanations, every citation against its source, and the wording against DESIGN.md §2. The model is good at structure and plain language; it's not a source of truth.
