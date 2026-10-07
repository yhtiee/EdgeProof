# Landing page critique

Round 1, self-scored. No separate critic agent was spawned, so these are scored harder than feels fair.

| # | Line | Score | Evidence |
|---|---|---|---|
| 1 | Concept on the page | 4 | The hero is a lab-style result with its reference range; the range bar repeats in the logo and the gates. |
| 2 | Not the category average | 5 | No candles, gold, income claims or timers. The hero shows a strategy *failing*. |
| 3 | Not a slop face | 4 | No pill, italic word, stats strip, logos, bento or pricing. The verdict panel is the one card-like element, and it is real, readable output. |
| 4 | First screen | 5 | The headline, the action and the verdict are all visible at 390, 320 and 1440 px. |
| 5 | Typography | 4 | Plex Sans and Plex Mono per DESIGN.md, mono only for figures, tabular numbers. The H2s are modest next to the display size. |
| 6 | Colour | 4 | Amber appears only on the action, the estimate dot and the "you start here" gate. Dark mode comes from the tokens. |
| 7 | Richness | 4 | Live computed data (10,000 resamples) plus a working simulator. No photography. |
| 8 | Structure and rhythm | 4 | Six sections, each answering one question. Section 2's left column is a deliberate rest. |
| 9 | Craft | 4 | Scan: 0 FAIL. The two warnings are inline citation links in a sentence (WCAG 2.2 inline exception). |
| 10 | Responsive | 4 | The phone layout is designed; the simulator stacks under its explanation. |
| 11 | Everyone's computer | 3 | Not verified. The skill's matrix script isn't in the bundle, so there were no Windows scaling, High Contrast, Firefox or Safari passes. |
| 12 | Signature | 4 | The resampling explains where the range comes from and can be replayed. Reduced motion shows the final state. |
| 13 | Screenshot test | 4 | "A landing page whose hero says No edge found yet" is the thing people would repost. |

## Open items

- Run the cross-browser and Windows checks once the full web-designer bundle (with matrix.mjs) is installed.
- DESIGN.md §6 says "no entrance animations". The signature animates once inside the verdict panel. It's flagged in DIRECTION.md for a decision.
- Proposed DESIGN.md addition: a "specimen" usage of the verdict panel for marketing pages, always labelled "Example verdict".
