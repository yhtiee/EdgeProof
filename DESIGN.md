# EdgeProof — Brand and Design System

> **For Claude Code:** this file is the source of truth for every screen, component and line of interface copy in EdgeProof. Read it before building or changing UI. If a request conflicts with this file, follow the request and mention the conflict. If something isn't covered here, choose the option most consistent with the principles in §1, and don't invent new colours, type sizes, radii or shadows: use the tokens in §3–§6.

EdgeProof (working name) is a free web app that takes forex traders from zero to an evidence-tested edge: a mandatory interactive Academy, a strategy rulebook, a trade journal, a code-computed verdict, then slow, data-backed progression. Stack: Vite + React + TypeScript + Tailwind CSS, installable PWA, served from Vercel. Product spec: *EdgeProof — Product & Technical Specification*.

---

## 1. Brand principles

These five principles decide every design question. When two options are equally good, pick the one that serves the higher principle.

1. **Evidence, not hype.** Every important number is shown with its range and sample size. We never show a single flattering figure when an honest range exists.
2. **Calm, not casino.** Trading apps are built to excite. We are built to steady. No flashing tickers, no confetti for profit, no countdown pressure, no red badges demanding attention.
3. **Process is the hero.** Discipline, rule-following and learning are celebrated. Profit and loss are reported plainly, never celebrated or mourned.
4. **Respect the learner.** Plain words, one idea per screen, feedback that explains why. Users are adults on a long journey; the interface never talks down and never flatters.
5. **Works anywhere.** A 360 px phone on a slow, expensive mobile connection in Lagos is the baseline device, not an edge case.

### The signature element: the range bar

EdgeProof's one memorable visual is the **range bar**: a number shown with a horizontal whisker for its range, a dot for the estimate and a marked zero line. It appears wherever we show expectancy, drawdown, pass probability or any estimate. It is the brand made visible: *we show you the uncertainty*.

```
Expectancy      +0.21R
  ├──────────●──────────┤
 -0.04      0│        +0.46
             zero
```

Spend boldness here and keep everything around it quiet. Don't add other decorative motifs.

---

## 2. Voice and copy

### Tone
Plain, direct, warm, honest. Like a good coach who has also blown accounts: no jargon without explanation, no hype, no drama.

### Rules
- **Sentence case** everywhere: buttons, headings, labels, menu items. Never all caps for labels.
- **Name actions by what happens.** "Log trade", "Start exam", "Save version". The same verb follows through the flow: the button "Log trade" produces the toast "Trade logged".
- **Describe the user's data; don't instruct.** Say "Your rule allows 1% per trade. This trade risked 2.4%." Never "You should reduce your size" or "We recommend". This is a legal requirement (education, not advice).
- **Never use:** "proven", "guaranteed", "profitable strategy", "signal", "winning", "beat the market", "financial freedom", "to the moon", or any income claim.
- **Errors explain what happened and what to do.** No apologies, no vagueness. "Couldn't import 3 rows: the close time is missing. Fix them in the file or skip them."
- **Empty screens invite one action.** "No trades yet. Log your first practice trade to start building your record."
- **Numbers always carry units and signs:** `+0.21R`, `−1.0R`, `2.4%`, `₦25,000`, `$150`. Use a true minus sign (−), not a hyphen.
- **Verdict names are fixed:** "Not enough data", "No edge found yet", "Passed out-of-sample test", "Passed forward test". Never shorten to "Profitable" or "Validated".
- **Write for a reading age of about 12** in lessons and the interface. Explain every term the first time it appears and link it to the glossary.

### Microcopy examples

| Situation | Write | Don't write |
|---|---|---|
| Wrong exam answer | "Not quite. Position size depends on stop distance, not account size alone." | "Wrong!" / "Oops!" |
| Verdict: no edge | "No edge found yet. Validation expectancy was −0.08R across 54 trades. That's a useful result: it saved you real money." | "Your strategy failed." |
| Tilt flag | "This trade opened 12 minutes after two losses. It's tagged as a tilt-window trade." | "Stop revenge trading!" |
| Streak broken | "Your journaling streak reset. Your 41 logged trades are all still here." | "You lost your streak 😢" |
| Backend waking | "Waking up the server. This can take up to a minute on our free plan. Your work is saved." | "Loading…" (for 30 seconds) |

---

## 3. Colour

The palette comes from the trading desk at night and the ledger by day: deep navy ink, cool chart-paper greys, and one amber signal colour reserved for moments that matter. Gain and loss colours are muted and always paired with a sign and a word.

### Core palette

| Name | Hex | Role |
|---|---|---|
| Ink | `#0E1A24` | Primary text (light), dark background |
| Chart paper | `#EEF1F2` | Light background |
| Ledger | `#F8FAFA` | Light surface (cards, panels) |
| Signal amber | `#F2A93B` | Brand accent: primary actions, focus (dark), the range-bar estimate, gate passes |
| Amber ink | `#8A4F06` | Accent text on light backgrounds |
| Slate | `#4C6A82` | Secondary accent, chart axes, neutral data |

### Semantic tokens

Every value below is checked: text pairs meet WCAG AA (4.5:1 or more on all three surfaces of their theme); control borders meet 3:1.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#EEF1F2` | `#0E1A24` | Page background |
| `--surface` | `#F8FAFA` | `#152534` | Cards, panels, sheets |
| `--raised` | `#FFFFFF` | `#1C3043` | Menus, popovers, inputs |
| `--text` | `#0E1A24` | `#EEF1F2` | Primary text |
| `--text-muted` | `#46535E` | `#B7C4CE` | Secondary text, descriptions |
| `--text-subtle` | `#5A6773` | `#8D9DA9` | Captions, timestamps, helper text |
| `--border` | `#C9D1D6` | `#2C4253` | Decorative dividers, card outlines |
| `--border-control` | `#7A8893` | `#6A8499` | Input, checkbox and toggle borders (3:1) |
| `--accent` | `#F2A93B` | `#F2A93B` | Primary button fill, selected state fill |
| `--on-accent` | `#0E1A24` | `#0E1A24` | Text on accent (8.8:1) |
| `--accent-text` | `#8A4F06` | `#F2A93B` | Links, accent text |
| `--focus` | `#2C62A0` | `#F2A93B` | Focus ring |
| `--gain` | `#16704F` | `#4CC38A` | Positive R or P&L (with + sign) |
| `--loss` | `#AE3424` | `#F08068` | Negative R or P&L (with − sign) |
| `--info` | `#2C62A0` | `#79AEEA` | Informational notices, links in data |
| `--warning` | `#8A4F06` | `#F2A93B` | Warnings (with an icon and a word) |
| `--danger` | `#AE3424` | `#F08068` | Destructive actions, errors |
| `--neutral-data` | `#4C6A82` | `#8FA9BE` | Chart lines, range bars, axes |

### Colour-blind mode
A setting swaps gain and loss for a blue and orange pair: light `--gain #2C62A0`, `--loss #8A4F06`; dark `--gain #79AEEA`, `--loss #F2A93B`.

### Rules
- **Colour never carries meaning alone.** Gains show `+` and losses show `−`; statuses show a word and an icon; chart series have labels.
- **Amber is rare.** At most one amber-filled element per screen (usually the primary action). Amber is never used for profit.
- **No gradients, glows or neon.** Flat fills only. Depth comes from surface steps (`--bg` → `--surface` → `--raised`), not shadows.
- **Theme:** follow the system setting by default, with a manual toggle in Settings. Charts get a matching dark theme.
- Tokens live as CSS variables (§13); never hard-code a hex value in a component.

---

## 4. Typography

One superfamily, engineered and honest: **IBM Plex Sans** for everything written, **IBM Plex Mono** for figures in data contexts (prices, R values, percentages in tables and charts) so columns of numbers line up like a ledger.

| Role | Font | Size / line height | Weight | Tracking |
|---|---|---|---|---|
| Display (marketing hero only) | Plex Sans | 48 / 52 (32 / 36 mobile) | 600 | −0.02em |
| H1 page title | Plex Sans | 32 / 40 (26 / 32 mobile) | 600 | −0.01em |
| H2 section | Plex Sans | 24 / 32 (21 / 28 mobile) | 600 | 0 |
| H3 card or block title | Plex Sans | 18 / 26 | 600 | 0 |
| Body | Plex Sans | 16 / 26 | 400 | 0 |
| Lesson body (lesson screens only) | Plex Sans | 18 / 30 | 400 | 0 |
| Body small | Plex Sans | 14 / 22 | 400 | 0 |
| Caption | Plex Sans | 13 / 18 | 400 | 0 |
| Figure large (stat) | Plex Mono | 32 / 36 | 500 | −0.01em |
| Figure (tables, inline) | Plex Mono | 14–16 | 400 | 0 |

### Rules
- Body text never smaller than 16 px on mobile; captions never below 13 px.
- Lesson text: max line length 68 characters (`max-width: 68ch`).
- Use `font-variant-numeric: tabular-nums` on all numbers, including in Plex Sans.
- Emphasis by weight (600) only. No italics for emphasis in the UI; no coloured single words in headings.
- Don't use the mono face for labels or headings. It is for figures only.
- **Loading:** self-host WOFF2 files, subset to Latin plus the `₦` and `−` characters, two weights per family (400 and 600 for Sans; 400 and 500 for Mono), `font-display: swap`, preload only Plex Sans 400. In data-saver mode, fall back to the system font stack (`system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`).

---

## 5. Space, layout and shape

### Spacing
A 4 px base. Allowed steps: `4, 8, 12, 16, 24, 32, 48, 64, 96`. Use Tailwind's default scale (`1, 2, 3, 4, 6, 8, 12, 16, 24`) and nothing between.

### Layout
- **Mobile first.** Design at 360 px, then 768 px and 1280 px. Gutters: 16 px mobile, 24 px tablet, 32 px desktop.
- **App shell:** bottom tab bar on mobile (Learn, Journal, Lab, Progress, More); left sidebar on desktop (≥1024 px). Five destinations maximum.
- **App header:** a sticky bar across the top of the content area, 56 px on mobile and 64 px on desktop, on `--surface` with a bottom `--border`. Left: the logo on mobile; on desktop, the current section as a quiet label (Body small, 600, `--text-muted`), because the sidebar already carries the logo and the page carries its own H1. Right: a secondary "Log trade" button (tablet and up), notifications and the account menu as 44 px icon buttons with `aria-label`s. The header never uses amber, never shows a red badge and never repeats the page title at H1 size.
- **Content width: fill the space, don't centre a column.** App screens use the full width of the content area, left-aligned, inside the standard gutters. Never wrap a screen in a centred `max-width` container with empty space on both sides: on desktop that pushes everything into one long column and causes needless scrolling. Use the width instead: at ≥1024 px, put related parts side by side in a two-column grid (for example a lesson's explanation beside its simulator, a progress path beside the current gate's criteria, or a form beside its live preview).
- **Measure still applies to text, not to containers.** Paragraphs keep `max-width: 68ch` (lessons) or about 60ch (descriptions) on the text element itself, so lines stay readable while the layout uses the full width.
- **Auth and onboarding: split screen.** These screens follow the same rule. At ≥1024 px the screen is two equal columns that fill the width. Left, on `--bg`: the logo, then the H1, description and form, left-aligned (sign-in and sign-up forms max 420 px, onboarding steps max 560 px). Right, on `--surface` with a left `--border`: context that would otherwise need scrolling to find. Sign-up shows the steps that follow; sign-in shows a range-bar example; onboarding shows the step list (current step in amber, done steps ticked) and the answers saved so far. Below 1024 px the right panel is hidden and onboarding shows "Step N of 4" with a four-segment progress bar instead. Each onboarding step's actions (Back as a text button, then the one primary action) are inline on desktop and a full-width sticky bar at the bottom on phones.
- **Profile and settings sections** use a two-column row per section at ≥1024 px: the section title and a one-line description on the left (one third), the form on the right (two thirds, max 720 px). Each section saves on its own with a secondary "Save changes" button and an inline "Changes saved" confirmation.
- **Exceptions:** the public marketing pages use a 1200 px page grid. **Lesson screens use one centred column, 680 px wide**, for text, simulators, questions, the action bar and the answer feedback alike. A lesson is read top to bottom, one screen at a time, so the eye should move down, never across: don't put lesson text at the far left and the interactive part at the far right.
- **Alignment:** text is left-aligned everywhere, empty states included, except the exam result moment.
- **One primary action per screen**, placed bottom-right on desktop and as a full-width sticky button above the tab bar on mobile.

### Shape
| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 6 px | Inputs, chips, small buttons |
| `--radius-md` | 10 px | Buttons, cards |
| `--radius-lg` | 16 px | Sheets, modals, lesson panels |
| `--radius-full` | 999 px | Pills, avatars, toggles |

Radius signals hierarchy: larger containers get larger radii. Don't put every element in a card; use spacing and dividers first, and a card only when content is a distinct, movable unit (a trade, a lesson, a strategy).

### Elevation
Two shadows only, used for floating layers: `--shadow-pop: 0 8px 24px rgb(14 26 36 / 0.12)` (menus, popovers) and `--shadow-sheet: 0 -8px 32px rgb(14 26 36 / 0.16)` (bottom sheets, modals). In dark mode, elevation comes from the lighter surface colour; shadows are optional.

### Touch targets
Minimum 44 × 44 px for anything tappable; 8 px minimum between adjacent targets.

---

## 6. Motion

Motion explains what changed. It never decorates and never celebrates money.

| Token | Duration | Easing | Use |
|---|---|---|---|
| `--motion-fast` | 120 ms | `cubic-bezier(0.2, 0, 0, 1)` | Hover, press, toggle, checkbox |
| `--motion-base` | 200 ms | `cubic-bezier(0.2, 0, 0, 1)` | Expand, collapse, tab switch, toast |
| `--motion-slow` | 320 ms | `cubic-bezier(0.3, 0, 0, 1)` | Sheets, modals, page transitions |

### Rules
- **Answer feedback** (exam and lesson questions) slides up a feedback panel in 200 ms. This is the most repeated interaction in the app; make it feel immediate.
- **One earned moment per milestone:** passing a level exam or a gate gets a single 600 ms animation of the progress path filling and the gate opening. No confetti, no sound by default, never for P&L.
- **Simulators respond in real time** as sliders move (target 60 fps; throttle heavy maths to `requestAnimationFrame`).
- **No entrance animations** on page sections or cards. Content appears; it doesn't fly in.
- **Skeletons, not spinners,** for loads under 2 seconds; the waking-server state (§2) after that.
- **Respect `prefers-reduced-motion`:** replace movement with an opacity change of 120 ms or less.

---

## 7. Components

Build these once in `src/components/ui/` and reuse them. Every component needs default, hover, focus-visible, active, disabled, loading and error states where they apply, and must work with keyboard and screen readers.

### Core inventory

| Component | Notes |
|---|---|
| Button | Variants: primary (amber fill, ink text), secondary (outline with `--border-control`), ghost, danger. Sizes: 36 px desktop, 44 px mobile. Loading state keeps the width and shows a small spinner plus the verb ("Saving…"). |
| Input, Select, Textarea | Label always visible above the field (never placeholder-only); helper text below; inline error under the field in `--danger` with an icon. Numeric inputs use the mono face and `inputmode="decimal"`. |
| Segmented control | For 2–4 options (Buy/Sell, Win/Loss/Breakeven). |
| Checkbox list | The rule check on every trade; large tap rows, not tiny boxes. |
| Card | For trades, lessons, strategies. Whole card is the tap target. |
| Bottom sheet | Mobile replacement for modals and dropdowns with many options. |
| Toast | Confirms an action in its own verb; includes "Undo" for reversible actions; 4 seconds; never for errors that need action. |
| Banner | Persistent notices: risk warnings, waking server, offline mode, AI off. |
| Stat | Label, large figure (mono), and optionally a range bar and sample size: "Expectancy · +0.21R · 54 trades". |
| Range bar | The signature element (§1). Props: estimate, low, high, zero line, unit, label. Accessible text: "Expectancy +0.21R, range −0.04R to +0.46R". |
| Progress path | Vertical path of levels and gates on Learn and Progress; current position marked with amber. |
| Gate card | Shows a gate's criteria as a checklist with each item met or not, like CI checks (§8). |
| Verdict panel | Verdict name, plain-language summary, range bars, conditions checklist, "what this means" and next step. |
| Empty state | One sentence, one action, optional small illustration in line style. Left-aligned in a dashed `--border-control` outline with `--radius-md`, 32 px vertical padding; never a tall centred block. |
| App header | Sticky top bar of the app shell (§5): section label, "Log trade" (secondary), notifications and account menu (Radix Popover). |
| Command palette | Desktop only (`Ctrl/⌘ + K`): log trade, open strategy, search lessons, go to any page. |
| Step rail | Strategy Lab builder (desktop): numbered steps with a status icon (passes ✓ / fails !), the current step on `--raised`. On mobile it becomes a "Step 3 of 11 · Setup" button that opens the list in a bottom sheet. |
| Condition card | One rule: its plain-language sentence as the title (live), the chart select, then parameters in a 2-column grid (1 column at 360 px). Border turns `--danger` only while a check on it fails. |
| Annotation overlay | Arrows and boxes in `--accent` over an example screenshot, stored in 0–1 coordinates. Optional and decorative; the required note carries the meaning. |
| Dev gate note | Development builds only: a dashed `--border-control` note with an open-lock icon, "Open for development. When deployed, …", wherever a deployed build would lock. Compact form: "Locked when deployed" caption in rows. |

### Iconography
Use **Lucide** icons at 20 px (24 px on mobile tab bar), 1.75 stroke, `currentColor`. Never use icons alone for meaning: pair with a word, or give an `aria-label`.

### Illustration
Simple line drawings in `--neutral-data` with one amber detail, used only for empty states and the Academy. No stock photos, no 3D, no people holding phones full of money.

**Pip, the Academy mascot.** A rounded line-drawn figure whose antenna ends in an amber dot, the same dot as the range bar's estimate; that dot is the illustration's one amber detail. Pip appears in the lesson scene, a quiet `--surface` panel at the top of each lesson screen, standing beside **a line drawing of the current module's topic** (banknotes and arrows for exchange rates, candlesticks for candle lessons, a bank for central banks), so the picture always matches what's being taught. Poses follow the screen: wave (first screen), explain (reading), think (practice question), idea (takeaway), cheer (lesson complete; never confetti, never for money). Screens with a simulator or diagram leave the scene out so the interactive part has room. Every module needs a drawing (`src/features/academy/lesson/ModuleArt.tsx`; a test checks this). Scenes are decorative and hidden from screen readers.

---

## 8. Data visualisation

Charts are where trust is won or lost. Follow these rules for every chart.

- **Price charts:** TradingView Lightweight Charts, loaded only on routes that need them. Candles use `--gain` / `--loss`; background matches `--surface`; grid in `--border`.
- **Equity curves:** cumulative R as a line in `--neutral-data`, drawdown shaded below in `--loss` at 15% opacity, zero line always visible.
- **Always show the sample size** next to any statistic ("54 trades"), and the range where one exists (range bar).
- **Breakdowns** (by session, setup, weekday, emotion): horizontal bars sorted by value, labelled directly with figures, with a zero line; never pie charts.
- **Monte Carlo and bootstrap results:** show the 5th, 50th and 95th percentile as a fan or range bar with plain labels ("Worst 5% of outcomes", "Typical"). Never show only the median.
- **Axis labels and tooltips** use the mono face; units always written.
- **No 3D, no dual axes, no truncated y-axes** on bar charts.
- Every chart has a text summary for screen readers and a "View as table" option.

---

## 9. Accessibility checklist

Every screen must pass before it ships:

- [ ] WCAG 2.2 AA contrast (tokens above already comply; don't introduce new colours).
- [ ] Visible focus ring: 2 px `--focus` outline with 2 px offset on every interactive element.
- [ ] Full keyboard operation, logical tab order, `Esc` closes overlays and returns focus.
- [ ] Semantic HTML first (`button`, `label`, `nav`, `main`, headings in order); ARIA only where HTML can't express it.
- [ ] Simulators expose their values as text and work with arrow keys.
- [ ] Form errors announced via `aria-live="polite"`; the first invalid field receives focus on submit.
- [ ] Works at 200% zoom and with system font scaling without horizontal scroll.
- [ ] `prefers-reduced-motion` and `prefers-color-scheme` respected.

---

## 10. Performance and resilience

- First load under **300 KB of JavaScript (gzip)**; route-level code splitting; charts and simulators lazy-loaded.
- Lessons are static JSON from Vercel and cached by the service worker, so learning works offline and while the backend sleeps.
- Journal entries save locally first and sync when online; show a small "Saved on this device · Syncing" status, never a blocking error.
- Images compressed in the browser to WebP (~1600 px, ~200 KB) before upload; data-saver mode stops images loading automatically.
- Optimistic UI for logging, ticking rules and answering questions; roll back with a clear message if the server rejects.

---

## 11. Reference product flows

These are the best existing products to study for each part of EdgeProof. Borrow the interaction pattern, not the visual style. Each entry says what to take and what to leave.

### Onboarding and first run
| Product | Take | Leave |
|---|---|---|
| **Duolingo** | Let people try a lesson before creating an account; a short placement test so experienced users skip ahead; ask one question per screen with big tap targets. | Guilt-based notifications, cartoon pressure. |
| **Headspace** | A calm, paced set of questions that ends in a "your plan" reveal; gentle tone at the start of a long journey. | Overly soft visuals that would undercut a data product. |

### Interactive lessons and exams
| Product | Take | Leave |
|---|---|---|
| **Brilliant** | Learn by doing: one concept per screen, an interactive element before the explanation, immediate feedback that explains why the answer is right or wrong. This is the model for the Academy. | Paywalled progression. |
| **Khan Academy** | Mastery gating, hints that don't give the answer away, "you've mastered this" moments tied to evidence. | Dense dashboards for teachers. |
| **Duolingo** | The answer-check bar that slides up from the bottom with the result and a single "Continue" button; the visible path of units. | Hearts and lives that punish mistakes. |

### Strategy builder (structured forms)
| Product | Take | Leave |
|---|---|---|
| **Typeform** | One part of the rulebook at a time, progress visible, easy to go back. | Decorative transitions between questions. |
| **Stripe Dashboard** | Inline validation, clear helper text, previews of the result as you fill in (show the finished rulebook building beside the form on desktop). | — |
| **GitHub pull request checks** | The clarity checks and gate criteria shown as a checklist of passed and failed items with details on expand. | Developer jargon. |

### Fast logging and keyboard power
| Product | Take | Leave |
|---|---|---|
| **Linear** | Speed: command palette, keyboard shortcuts, optimistic updates, no loading spinners for small actions. Model the trade-log form and journal list on it. | — |
| **Things 3** | Quick entry that captures the minimum now and lets you add detail later. | — |

### Journal, streaks and reviews
| Product | Take | Leave |
|---|---|---|
| **Strava** | Activity log with a weekly summary, personal records framed as progress, a training-calendar view (use it for the journaling calendar). | Social comparison of results; kudos on P&L. |
| **Duolingo** | Streaks, plus a streak freeze so one missed day doesn't erase motivation. | Streak shame. |
| **Day One** | Calm, private journaling with prompts; reflection questions that feel personal. | — |

### Scores, analytics and verdicts
| Product | Take | Leave |
|---|---|---|
| **Oura / Whoop** | A single score (discipline score) with its contributors shown underneath, each explaining what moved it. This is the model for DE-3. | Vague wellness language. |
| **Google Lighthouse** | A report that shows a result, then each check with a pass or fail and a plain explanation of how to improve it. This is the model for the verdict screen. | Colour-only scoring. |
| **Stripe Dashboard** | Clean metric tiles with comparisons and drill-down; tables that stay readable on mobile. | — |

### Charts and replay
| Product | Take | Leave |
|---|---|---|
| **TradingView** | Familiar chart gestures (drag, pinch, crosshair) so users don't relearn; Lightweight Charts for rendering. | Indicator clutter and social "ideas" feeds. |

### Calm finance
| Product | Take | Leave |
|---|---|---|
| **Monzo** | Plain-language money copy and clear, unexcited presentation of amounts. | — |

### What to avoid
- **Gamified trading apps.** Robinhood removed its confetti animation in 2021 after criticism that it made trading feel like a game. That confetti is exactly what EdgeProof must never do.
- **Signal and course-seller sites:** countdown timers, Lamborghini imagery, income screenshots, "only 3 spots left".
- **Prop firm dashboards** that highlight targets and timers; ours highlights rules and evidence.

---

## 12. Screen recipes

Short blueprints for the core screens. Build them from §7 components.

**Lesson screen (mobile)**
```
┌──────────────────────────────┐
│ ← Position sizing     ●●●○○  │  progress dots for blocks
│                              │
│  Concept text, ≤ 3 short     │
│  paragraphs, 68ch max        │
│                              │
│  ┌ Interactive simulator ─┐  │  user acts before the
│  │ slider · live result   │  │  explanation
│  └────────────────────────┘  │
│                              │
│ [        Continue        ]   │  sticky, full width
└──────────────────────────────┘
```

**Answer feedback:** after "Check", a bottom panel slides up: result word with icon ("Correct" / "Not quite"), one-sentence explanation, "Continue". The question stays visible above it.

**Lesson screen (all widths):** the lesson hides the app shell. Top bar, aligned to the 680 px column: close (×), the level and module in caption size above the lesson title, and "2/5" in mono; under it, a thin full-width progress bar in `--accent`. Then the column: the lesson scene (Pip and the module drawing, §7), then the screen's blocks in the order they were written, lesson text at 18/30. Each new screen fades and lifts 8 px in 200 ms (opacity only with reduced motion). The action bar is fixed to the bottom and aligned to the same column: Back on the left, a "Press Enter to continue" hint on desktop, and the one primary action ("Check", "Continue" or "Finish lesson") on the right. Enter triggers the primary action. After a wrong answer the panel offers "Try again" (secondary) beside "Continue".

**Lesson complete:** in the same column: the lesson scene with Pip cheering, "Lesson complete" (H1), the first-try score in words ("You answered 1 of 2 practice questions right on the first try."), the lesson's key takeaways, the next lesson as the primary action, then the sources. No confetti and no sound (§6).

**Exam screen:** the same full-focus stage as a lesson (680 px column, top bar with context, title and "n/N", accent progress bar). Intro: Pip with the module drawing (Pip alone for level and placement exams), the scope in accent caption ("Module exam"), a three-fact strip (questions · pass mark · attempts or best score) and the rules in plain words; one primary action, "Start exam". Questions: one per screen, options styled like lesson answers, **no feedback until the end**; numbered squares under the question jump between questions (filled = answered); the action bar shows "n/N answered · saved on this device" and Next / "Submit answers". Submitting with blanks asks once. Result: Pip cheering or thinking, "3 of 4 correct · 75%" (H1), a score bar with the pass mark as a 2 px amber tick, "Lessons to review" as full-width rows, then each question with ✓/✗ and "Report this question". Correct answers are never shown (AC-5); say so in a caption. After a first miss: "Retake now, with different questions"; after a second: an info banner with when it reopens, in the learner's time.

**Learn page path:** each module's lessons are followed by a "Module exam" row (clipboard icon; "80% to pass", "Best 50%…", "Review time" or "Passed · 100%"), and each level ends with a "Level N exam" row. Locked rows use the lock icon and name what opens them. "Up next" can be an exam. Placement: experienced learners (any trading history) see a bordered offer under the level title ("Already know this? Test out of Level N" + secondary button); others see one quiet "Know this already? Take the placement exam" link. Offers appear only for the first unfinished level. A passed placement marks the level's lessons done; they stay open to read.

**Learn:** the curriculum path fills the left column (levels → modules → lessons; the current lesson's status dot in amber). Lessons open in order: a lesson unlocks when every earlier one is complete; locked lessons show a lock icon in `--text-subtle`, aren't links, and opening one by URL shows a locked screen pointing to the lesson to finish first. Modules without lessons yet collapse to one line marked "Being written"; levels not in the current phase show "Opens in phase N". The right column (sticky on desktop) holds "Up next" with the primary action, then progress per level as a thin bar with "3/12" in mono, then the level's reading list.

**Journal list:** tabs under the page title (Trades · Metrics · Reviews · Setup). Trades are grouped by day; each row shows pair, direction (coloured word), result in R (mono, signed, coloured; "≈" when R is estimated from prices; "Open" or "No stop" otherwise), the rule-followed icon with its label, an "After a loss" tag, and "On this device" or "Not saved · open to fix" for trades waiting to sync. Filters: search (notes, setup, pair, tag, broken rule), account, result, rules. The right column holds the journaling streak (days, best, trades logged) with a 12-week activity calendar, then "Export CSV". Floating "Log trade" button on mobile; `N` shortcut on desktop. The last page of trades is kept on the device so the list still shows offline.

**Log trade:** single scrolling form in this order: account and pair, direction, entered at, entry, initial stop, target, size (a "Use 0.10 lots (1% risk)" link when the account has a balance), then result (closed or still open, exit, closed at, "Closed in parts?"), commission and swap, rule checklist (tick each rule followed; unticked counts as broken) with the never-again list beside it, context (setup, feeling before and after as chips, confidence, sleep, distracted, tags), screenshots (paste or pick; before and after) and notes. Required fields first; everything after the rule checklist is optional. A summary panel (sticky on desktop; a one-line strip above the tab bar on phones) shows risk in money and % of balance, stop in pips, net P&L and R live, and warns above 1.25× planned risk. When the pair's quote currency differs from the account's, the form asks for risk and P&L in account currency; without them R is marked "≈ from prices". The initial stop is read-only once saved. Saving goes to the device first, then syncs; server errors reopen the form with the fields marked.

**Journal metrics:** stat tiles (expectancy with its range bar, win rate with wins/losses/breakevens, profit factor, total R), a "How sure is this?" panel with the bootstrap range and the no-edge line from 20 trades, the running total in R (line, zero line, "View as table"), drawdown (worst so far in R and %, longest losing run, Monte Carlo range "drawdown to expect"), discipline and costs (rule-following, cost of broken rules, costs share with warnings), then breakdowns as horizontal bars. Below 20 trades, an info banner explains why ranges wait.

**Reviews:** today's review (3 questions) and this week's (5) side by side, each with that period's facts above the questions (trades, rules followed, R); saved reviews show "Done"; earlier reviews below as read-only cards.

**Strategy Lab:** list of strategy cards (name, version, mechanical/discretionary, status chip "Draft · 3 checks left" or "Locked · Gate 3 passed"); archived ones fold under "Archived (n)". At 5 active, an info banner replaces the ability to start another. Before the strategy lessons (deployed builds), a locked card lists those lessons with done marks and links, and one primary action, "Go to Learn".

**Rulebook builder:** three columns on wide screens (step rail · step form up to 640 px · sticky live preview), one column on phones with "Step n of 11" and "Preview" buttons opening bottom sheets. Each step: caption "Step 3 of 11 · Version 1", H1, one "why this matters" line, then the fields. A fixed action bar holds Back, the save status in words ("Saved", "Saving…", "Saved on this device · Syncing") and the one primary action "Next: {step}". Check step: a GitHub-checks list by part (✓ passes / ! fails with each message and a "Fix" link that focuses the field; "Note" items for warnings), profile-fit notes, then the Gate card and "Lock version n". Locked versions render read-only with a banner pointing to "Edit rules". A device conflict opens a sheet: "Keep this device's version" / "Use the other version".

**Strategy page:** name, "Version n · Locked · Mechanical", "Edit rules" (opens "Save as new version" with a required reason) or "Continue editing", "Archive"; the rulebook as preview sentences; the Gate 3 card and the version history (number, date, status, trades, quoted reason) in the side column.

**Verdict:** verdict name and one-sentence summary at the top; range bars for expectancy and drawdown; the conditions as a pass/fail checklist; "What this means" in plain words; one next action ("Start forward test" or "Back to the Lab").

**Progress:** vertical progress path of levels and gates, current position in amber, each gate showing its criteria checklist.

---

## 13. Implementation notes for Claude Code

- Put tokens in `src/styles/tokens.css` as CSS variables for `:root` (light) and `[data-theme="dark"]` plus `@media (prefers-color-scheme: dark)` for `:root:not([data-theme="light"])`. Map them in `tailwind.config.ts` (`colors: { bg: 'var(--bg)', surface: 'var(--surface)', … }`) so components use `bg-surface`, `text-muted` and so on. No raw hex in components.
- Shared UI lives in `src/components/ui/`; feature components in `src/features/<feature>/`.
- Use **Radix UI primitives** (Dialog, Popover, Tabs, Toggle) for accessible behaviour, styled with these tokens. Don't add another component library.
- Format numbers with one helper (`formatR`, `formatPct`, `formatMoney`) that applies signs, true minus, units and tabular figures.
- Before marking any UI task done, check it against: §2 copy rules, §9 accessibility checklist, 360 px width, dark mode, reduced motion, offline or waking state, and empty and error states.
- If you need something this file doesn't define, propose an addition to this file in your summary rather than inventing it silently.
