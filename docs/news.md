# News: build notes

*Founder decisions, 20 Nov 2026: build the economic calendar and official headlines. News gets its own item in the sidebar and tab bar. Headlines come from official sources only, and the feature is open to every signed-in learner. It ships with the actuals we already have, and same-day national feeds come next. The format follows Forex Factory's and Myfxbook's calendars, but not their look or name.*

---

## 1. What's built

| Part | What a learner sees |
| --- | --- |
| **Calendar** (`/news`) | Last, this or next week, grouped by day in the learner's time zone, with an "Up next" line. Each event shows time, currency, impact (High, Medium, Low or Holiday, as a word plus bars, never colour alone), title, actual, forecast and previous. The actual carries an arrow for above or below the forecast, and a gain or loss tone when we know whether that's usually good for the currency. Filters: impact (default High and medium), currency, and "Pairs I trade" (the currencies in the learner's journaled pairs). Tapping an event opens a sheet with what it measures, a plain reading of the result, the scanner factor it feeds, the official source, the Forex Factory calendar and the Academy lesson. |
| **Headlines** (`/news/headlines`) | Newest first, 30 at a time with "Show older". Each shows currency, publisher, time, type (decision, minutes, speech, report, data release or press release), the summary and topic tags, and links to the original. Filters: publisher type, currency, topic and type. |

## 2. Data

- **Calendar:** the Forex Factory weekly feed the scanner already fetches. It now keeps every impact level for our 8 currencies; China and "ALL" events are left out. The scanner's evidence and "Coming up" lists still show only High and Medium. The feed has no actuals, so they're filled in this order:
  1. the official first print where the scoreboard fetches one (US series from FRED, on the day);
  2. otherwise, the "previous" figure on the next release of the same series, which can include a revision and arrives a week to a month later.

  An event with neither says so and links to the official source.
- **Reading a result:** compared with the forecast at the precision the forecast was printed. "Good for the currency" is only said where the direction is known: higher is better, except unemployment and jobless claims. Trade balances, housing and similar releases get no verdict.
- **Headlines:** the central bank feeds (housekeeping such as bank notes and appointments is dropped), plus speech feeds for the Fed, BoE and BoC, plus the statistics agencies with a readable feed: US BEA, UK ONS and ECB statistics. BLS and Statistics Canada block automated requests; ABS, Stats NZ, e-Stat and the Swiss FSO have no working feed. Kept for a year. The scanner's evidence still uses only bank items tagged with a factor.
- **Schedule:** the calendar is fetched four times on weekdays: 05:30 with the news, then 10:00, 14:00 (after the 08:30 New York releases) and 20:00 UTC. That's the `fetch_calendar` job. Forex Factory rate-limits repeated fetches, so don't fetch more often.

## 3. Engineering

- **Tables:** the scanner's own. `CalendarEvent` gains `actual`, `actual_source` and `indicator`. `Publication` gains `kind` and `publisher`. Migration `scanner.0009_news`.
- **App:** `apps/news` holds views and reading rules only, with no models.
- **API:**
  - `GET /api/v1/news/calendar?from=&to=` takes ISO times with the learner's offset, at most 15 days apart.
  - `GET /api/v1/news/headlines?currency=&topic=&kind=&publisher=&before=` pages with the previous page's `next`.
- **Ingest fix:** long fetches now reopen the database connection before writing. The Supabase pooler drops idle connections during Twelve Data's one-minute waits.

## 4. Next

1. **Same-day actuals** from the national statistics offices: ONS, Eurostat, StatCan, ABS, Stats NZ, e-Stat and FSO. One adapter each; the scanner's scoreboard gains from them too.
2. Reminders before high-impact events (in-app until there's an email provider), calendar export (roadmap RL-5), and "Explain this release" through the AI layer.
3. **Founder task:** check Forex Factory's terms before public launch. A full calendar page shows more of their feed than the scanner did.
