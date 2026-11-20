# Indices, stocks and crypto: build notes

*Founder decision, 19 Nov 2026: the scanner adds the top 10 stock indices, stocks and coins next to the 28 FX pairs and gold. This replaces the earlier "FX pairs and gold only" scope in [scoreboard.md](scoreboard.md). Choices made: index prices from ETF trackers, the stock-market reading of the economy, coins read as US risk assets, and one ranked list with a market filter.*

---

## 1. What's covered

The lists were ranked by market value, using stocks on 19 Nov 2026 and crypto on 8 Nov 2026. Stablecoins (USDT, USDC) are left out because they don't move. The lists live in `reference.INSTRUMENTS`, and a new ranking takes a code change plus a data migration.

| Market | Instruments (home economy) |
| --- | --- |
| Indices | S&P 500, Nasdaq 100, Dow Jones 30, Russell 2000 (US) · DAX 40, Euro Stoxx 50, CAC 40 (euro area) · FTSE 100 (UK) · Nikkei 225 (Japan) · ASX 200 (Australia) |
| Stocks | Apple, Microsoft, Nvidia, Alphabet, Amazon, SpaceX, Broadcom, Meta, Tesla, Eli Lilly (all US) |
| Crypto | Bitcoin, Ethereum, BNB, XRP, Solana, TRON, Zcash, Hyperliquid, Monero, Dogecoin (read as US risk assets) |

## 2. Data sources

| Input | Source | Gaps |
| --- | --- | --- |
| Prices (trend, seasonality, history) | Twelve Data free plan, in the same daily and monthly batches as FX | Index levels (SPX, NDX…) need a paid plan, so each index uses the ETF that tracks it: SPY, QQQ, DIA, IWM, EWG, FEZ, EWQ, EWU, EWJ, EWA. These are US-listed and priced in dollars, so the non-US ones include the currency move. Hyperliquid is quoted against USDT (no HYPE/USD listing). SpaceX listed recently, so its trend and seasonality stay empty until it has enough history. |
| Positioning (COT) | CFTC legacy futures report, same files as the currencies | S&P 500 (13874A), Nasdaq 100 (209742), Dow (124603), Russell 2000 (239742), Nikkei (240743), Bitcoin (133741), Ether (146021), XRP (176740), Solana (177741). The other indices, all stocks and the other coins have no contract, so positioning isn't scored for them. |
| Retail crowd | Myfxbook Community Outlook | Bitcoin, Ethereum, XRP, Solana and Zcash only. No free feed covers indices or single stocks. |
| Economy | The home currency's existing factors and releases | Nothing new to fetch. |

Daily credits go from 29 to 59 symbols, which is still well inside the free 800 a day. The price job now takes about 8 minutes. If a symbol fails, it's skipped and logged, and the others still update.

## 3. How they're scored

**The stock-market reading.** For a currency, hot inflation and rate hikes score bullish because they point to a tighter central bank. For stocks and risk assets the same news usually weighs on prices: borrowing costs more and cash pays more. So indices, stocks and coins take their home economy's factor scores with **inflation and rates flipped**. Growth, jobs and business confidence count as they are (`EQUITY_SIGN`). The scoreboard does the same per column: CPI, PPI, PCE and the rate outlook flip, and everything else counts as it is (`EQUITY_BOARD_SIGN`).

**Regime score.**
E = Σ w·sign·f / (2·Σ w) × 10 over the home economy's rates, inflation, growth, labour and business factors, plus the instrument's own COT where there's a contract. The currency's own COT isn't used, because dollar positioning says nothing about the S&P 500. More than two of the five economy factors missing makes the score insufficient.
P = 0.7·E + 0.15·5T + 0.15·5R, the same split as pairs, renormalised when trend or crowd is missing. The weights come from the live `FactorConfig`.

**Scoreboard and momentum.** These are single-sided like gold, so each macro column runs −1…+1. US-only columns (NFP, claims, ADP, JOLTS) count for US instruments and show "not part of this market" for the others. Momentum scales each row by its own range: a pair's macro column can reach ±2, an instrument's ±1. The final bias blends the two halves 50/50, as it does for pairs.

**Ranks** are global, so the list runs most bullish to most bearish across every market. Filtering by market keeps those ranks.

## 4. Known limits (say so on screen)

- **All 10 stocks share one economy.** Their regime scores differ only by trend, because nothing company-specific is scored. Free earnings data with consensus estimates would be the natural next factor.
- **Most indices and coins also share the US economy**, so the Evidence tab's hit rates overlap even more than they did for pairs. The caveat on that tab now says so.
- **The ETF proxies** carry dividends and, outside the US, the dollar move. A paid Twelve Data key would switch them to real index levels: change the price symbol in `INSTRUMENTS`.
- **The board labels** (±4, ±7) were calibrated on FX pairs and haven't been checked against a benchmark for these markets.

## 5. Gold momentum (for review)

Gold's scoreboard columns run −1…+1 like the new instruments, but its momentum is still scaled as if they ran to ±2, which halves it. This was left unchanged to keep gold's numbers stable. Setting `per_column: 1` on gold's row would make it consistent.
