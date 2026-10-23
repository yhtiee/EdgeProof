"""
Scoring runs, weekly snapshots, the historical replay and the evidence report
(spec "Scoring methodology", "Snapshots", "Validating the scoring").

A run scores everything as of one date using only observations that were
available by then, so live runs and the 3-year replay share one code path.
"""

import bisect
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from datetime import timezone as dt_timezone

from django.db import transaction
from django.utils import timezone

from . import scoreboard, scoring
from .models import (
    CentralBankOutlook,
    Currency,
    CurrencyScore,
    FactorConfig,
    FactorScore,
    Pair,
    PairScore,
    RawObservation,
    Release,
    ScoringRun,
)
from .reference import (
    BOARD_CONFIG,
    BOARD_MACRO,
    FACTORS_CURRENCY,
    MERGE,
    METALS,
    NO_FREE_SOURCE,
    ORDER,
    QUARTERLY_WINDOW,
    RELEASE_MAX_AGE,
    RELEASE_TITLES,
    SURVEY_SERIES,
    US_ONLY,
    release_freq,
)

METAL_CODES = {code for code, *_ in METALS}

SNAPSHOT_WEEKDAY = 5  # Saturday, after Friday's COT release


class Data:
    """Every observation, grouped by (factor, subject) and sorted, with availability dates for fast as-of lookups."""

    def __init__(self):
        self.series: dict[tuple[str, str], list[scoring.Obs]] = defaultdict(list)
        rows = RawObservation.objects.select_related("currency", "pair").order_by("period_date")
        latest_series: dict[tuple[str, str], tuple[date, str]] = {}
        grouped: dict[tuple[str, str, str], list[scoring.Obs]] = defaultdict(list)
        for o in rows:
            subject = o.currency.code if o.currency_id else o.pair.symbol
            grouped[(o.factor, subject, o.series)].append(
                scoring.Obs(o.period_date, o.value, (o.extra or {}).get("freq", "M"), o.released_at, o.extra or {})
            )
        # If a factor has more than one series for a subject, the freshest one wins.
        for (factor, subject, series), obs in grouped.items():
            last = obs[-1].period
            if (factor, subject) not in latest_series or last > latest_series[(factor, subject)][0]:
                latest_series[(factor, subject)] = (last, series)
        for (factor, subject), (_, series) in latest_series.items():
            obs = sorted(grouped[(factor, subject, series)], key=lambda o: o.available(factor))
            self.series[(factor, subject)] = obs
        self._avail = {k: [o.available(k[0]) for o in v] for k, v in self.series.items()}
        # Scoreboard inputs: releases by (currency, indicator) and any house view of each central bank.
        self.releases: dict[tuple[str, str], list[dict]] = defaultdict(list)
        for r in Release.objects.select_related("currency"):
            self.releases[(r.currency.code, r.indicator)].append({
                "title": r.title, "at": r.at, "actual": r.actual, "forecast": r.forecast, "forecast_text": r.forecast_text,
                "previous": r.previous, "actual_source": r.actual_source,
            })
        self.outlooks = {o.currency.code: {"direction": o.direction, "note": o.note, "set_on": o.set_on}
                         for o in CentralBankOutlook.objects.select_related("currency")}

    def upto(self, factor: str, subject: str, as_of: date) -> list[scoring.Obs]:
        obs = self.series.get((factor, subject), [])
        n = bisect.bisect_right(self._avail.get((factor, subject), []), as_of)
        return sorted(obs[:n], key=lambda o: o.period)


def config(version: int | None = None) -> tuple[int, dict]:
    rows = FactorConfig.objects.filter(active=True)
    version = version or (rows.order_by("-version").values_list("version", flat=True).first() or 1)
    return version, {r.factor: r for r in rows.filter(version=version)}


def _stale(factor: str, obs: list[scoring.Obs], as_of: date, window: int, replay: bool) -> bool:
    if not obs:
        return False
    if factor == "rates" and replay:
        return False  # a policy rate holds until it changes; history is continuous
    last = obs[-1]
    limit = QUARTERLY_WINDOW if last.freq == "Q" and factor in ("inflation", "labour") else window
    return (as_of - last.period_end()).days > limit


def compute(as_of: date, data: Data, cfg: dict, *, replay: bool = False) -> dict:
    """Scores for every currency and pair as of `as_of` (no database writes)."""
    currencies = {c.code: c for c in Currency.objects.all()}
    weights = {f: cfg[f].weight for f in FACTORS_CURRENCY if f in cfg}
    th = {f: c.thresholds for f, c in cfg.items()}
    factor_results: dict[str, dict[str, scoring.FactorResult]] = {}
    for code, c in currencies.items():
        if code in METAL_CODES:  # gold has no economy: positioning only
            res = {"cot": scoring.score_cot(data.upto("cot", code, as_of), th["cot"])}
            obs = data.upto("cot", code, as_of)
            res["cot"].stale = _stale("cot", obs, as_of, cfg["cot"].refresh_window_days, replay)
            factor_results[code] = res
            continue
        res = {
            "cot": scoring.score_cot(data.upto("cot", code, as_of), th["cot"]),
            "rates": scoring.score_rates(data.upto("rates", code, as_of), th["rates"], as_of),
            "inflation": scoring.score_inflation(data.upto("inflation", code, as_of), th["inflation"], c.inflation_target),
            "growth": scoring.score_growth(data.upto("growth", code, as_of), th["growth"]),
            "labour": scoring.score_labour(data.upto("labour", code, as_of), th["labour"]),
            "business": scoring.score_business(data.upto("business", code, as_of), th["business"]),
        }
        for f, r in res.items():
            obs = data.upto(f, code, as_of)
            r.stale = _stale(f, obs, as_of, cfg[f].refresh_window_days, replay)
            if obs:
                r.detail.setdefault("period", obs[-1].period.isoformat())
                r.detail["freq"] = obs[-1].freq
                r.detail["age_days"] = (as_of - obs[-1].period_end()).days
        factor_results[code] = res
    currency_scores = {
        code: scoring.currency_score(res, {"cot": weights["cot"]}, max_missing=0, factors=["cot"]) if code in METAL_CODES
        else scoring.currency_score(res, weights)
        for code, res in factor_results.items()
    }

    pairs = {}
    board = compute_board(as_of, data, cfg)
    for p in Pair.objects.select_related("base", "quote"):
        closes = data.upto("trend", p.symbol, as_of)
        trend = scoring.score_trend(closes, th["trend"])
        trend.stale = _stale("trend", closes, as_of, cfg["trend"].refresh_window_days, replay)
        sentiment = data.upto("retail", p.symbol, as_of)
        retail = scoring.score_retail(sentiment[-1] if sentiment else None, th["retail"])
        retail.stale = _stale("retail", sentiment, as_of, cfg["retail"].refresh_window_days, replay)
        cb, cq = currency_scores[p.base.code][0], currency_scores[p.quote.code][0]
        score, detail = scoring.pair_score(cb, cq, trend, retail)
        detail["agreement"] = scoring.agreement(score, factor_results[p.base.code], factor_results[p.quote.code], trend, retail)
        row = board["pairs"][p.symbol]
        mom = scoreboard.momentum(row)
        final, mixed = scoreboard.final_bias(score, mom, _merge_weights(cfg))
        detail["board"] = row["columns"]
        pairs[p.symbol] = {"pair": p, "score": score, "trend": trend, "retail": retail, "detail": detail, "close": closes[-1].value if closes else None,
                           "board_score": row["score"], "board_label": row["label"], "momentum": mom, "final": final, "mixed": mixed}
    return {"factors": factor_results, "currencies": currency_scores, "pairs": pairs, "currency_objs": currencies, "board": board}


def _merge_weights(cfg: dict) -> dict:
    """The regime/momentum blend; a FactorConfig row named "momentum" overrides the default weight."""
    m = cfg.get("momentum")
    if m is None:
        return MERGE
    return {**MERGE, "momentum": m.weight, "regime": 1 - m.weight}


# --- Scoreboard (docs/scanner/scoreboard.md) ----------------------------------------------------


def _latest(obs: list[scoring.Obs], as_of: date, max_days: int) -> scoring.Obs | None:
    return obs[-1] if obs and (as_of - obs[-1].period_end()).days <= max_days else None


def _rate_cell(code: str, as_of: date, end: datetime, data: Data) -> scoreboard.Cell:
    cfg = BOARD_CONFIG["rates"]
    outlook = data.outlooks.get(code)
    if outlook and (as_of - outlook["set_on"]).days > cfg["outlook_days"]:
        outlook = None
    if outlook:
        outlook = {**outlook, "set_on": outlook["set_on"].isoformat()}
    upcoming = next((r for r in sorted(data.releases.get((code, "rates"), []), key=lambda r: r["at"])
                     if end < r["at"] <= end + timedelta(days=14) and r["forecast"] is not None), None)
    if upcoming:  # the calendar's own "previous" is the current rate in the same convention as its forecast
        upcoming = {"title": upcoming["title"], "at": upcoming["at"].isoformat(), "forecast": upcoming["forecast"], "previous": upcoming["previous"]}
    policy = _latest(data.upto("rates", code, as_of), as_of, 30)
    market = _latest(data.upto("rate3m", code, as_of), as_of, cfg["proxy_days"])
    current = upcoming["previous"] if upcoming and upcoming.get("previous") is not None else (policy.value if policy else None)
    return scoreboard.rate_outlook(outlook, upcoming, current, market.value if market else None, cfg)


def compute_board(as_of: date, data: Data, cfg: dict) -> dict:
    """Every currency's macro cells and every pair's 18 columns, as of the end of `as_of` (UTC)."""
    end = datetime.combine(as_of, time.max, tzinfo=dt_timezone.utc)
    macro: dict[str, dict[str, scoreboard.Cell]] = {}
    for code in ORDER:
        cells = {}
        for ind in BOARD_MACRO:
            if ind == "rates":
                cells[ind] = _rate_cell(code, as_of, end, data)
            elif code != "USD" and ind in US_ONLY:
                continue
            elif (code, ind) in NO_FREE_SOURCE:
                cells[ind] = scoreboard.Cell(None, "none", {"reason": "Only a licensed PMI exists; no free source."})
            elif ind not in RELEASE_TITLES.get(code, {}) and (code, ind) not in SURVEY_SERIES:
                cells[ind] = scoreboard.Cell(None, "none", {"reason": "No free release mapped for this currency."})
            else:
                cells[ind] = scoreboard.macro_cell(ind, data.releases.get((code, ind), []), end, RELEASE_MAX_AGE[release_freq(code, ind)])
        macro[code] = cells

    def reports(code):
        return [{"period": o.period, "long": o.extra.get("long"), "short": o.extra.get("short")} for o in data.upto("cot", code, as_of)[-2:]]

    cot = {code: scoreboard.cot_change(reports(code)) for code in ORDER}
    retail_window = cfg["retail"].refresh_window_days if "retail" in cfg else 3
    rows = {}
    for p in Pair.objects.select_related("base", "quote"):
        sym, b, q = p.symbol, p.base.code, p.quote.code
        closes = [o.value for o in data.upto("trend", sym, as_of)]
        monthly = [(o.period, o.extra.get("open"), o.value) for o in data.upto("monthly", sym, as_of)]
        sentiment = _latest(data.upto("retail", sym, as_of), as_of, retail_window)
        tech = {
            "trend": scoreboard.trend(closes, BOARD_CONFIG["trend"]),
            "seasonality": scoreboard.seasonality(monthly, as_of.month, as_of, BOARD_CONFIG["seasonality"]),
            "crowd": scoreboard.crowd(sentiment.value if sentiment else None, BOARD_CONFIG["crowd"]),
        }
        gold_rate = None
        if b in METAL_CODES:
            tech["cot"] = scoreboard.cot_gold(reports(b))
            yields = [o.value for o in data.upto("yield2y", "USD", as_of) if (as_of - o.period).days <= 30]
            gold_rate = scoreboard.gold_rates(yields, BOARD_CONFIG["gold_rates"])
        else:
            cb, cq = cot[b], cot[q]
            tech["cot"] = (scoreboard.Cell(cb.score - cq.score, detail={"base": cb.detail, "quote": cq.detail})
                           if cb.score is not None and cq.score is not None else scoreboard.Cell(None, "missing"))
        rows[sym] = scoreboard.pair_row(b, q, tech, macro, gold_rate)
    ranks = scoreboard.board_rank({s: r["score"] for s, r in rows.items()})
    for s, r in rows.items():
        r["rank"] = ranks.get(s)
    return {"pairs": rows, "currencies": macro, "cot": cot}


def previous_snapshot(as_of: date) -> ScoringRun | None:
    return ScoringRun.objects.filter(is_weekly_snapshot=True, as_of__lt=as_of).order_by("-as_of").first()


@transaction.atomic
def save_run(as_of: date, result: dict, *, snapshot: bool, replay: bool, version: int) -> ScoringRun:
    if snapshot:
        ScoringRun.objects.filter(is_weekly_snapshot=True, as_of=as_of).delete()  # idempotent
    run = ScoringRun.objects.create(started_at=timezone.now(), as_of=as_of, is_weekly_snapshot=snapshot, is_replay=replay, config_version=version)
    prev = previous_snapshot(as_of)
    prev_scores = dict(PairScore.objects.filter(run=prev).values_list("pair__symbol", "score")) if prev else {}

    factor_rows, currency_rows, pair_rows = [], [], []
    for code, res in result["factors"].items():
        ccy = result["currency_objs"][code]
        for f, r in res.items():
            factor_rows.append(FactorScore(run=run, factor=f, currency=ccy, raw_value=r.raw, score=r.score, is_stale=r.stale, detail=r.detail))
        score, used = result["currencies"][code]
        currency_rows.append(CurrencyScore(run=run, currency=ccy, score=score, label=scoring.label_for(score), factors_used=used))
    changes = {}
    for sym, p in result["pairs"].items():
        before = prev_scores.get(sym)
        changes[sym] = round(p["score"] - before, 2) if p["score"] is not None and before is not None else None
    ranks = scoring.rank({sym: (p["score"], changes[sym]) for sym, p in result["pairs"].items()})
    # Final bias ranks like the board: most bullish first (signed, not by size).
    final_ranks = scoreboard.board_rank({sym: p["final"] for sym, p in result["pairs"].items()})
    board_ranks = scoreboard.board_rank({sym: p["board_score"] for sym, p in result["pairs"].items()})
    yesterday = (ScoringRun.objects.filter(is_replay=False, as_of__lt=as_of, finished_at__isnull=False).order_by("-as_of", "-finished_at").first()
                 if not replay else None)
    before_board = dict(PairScore.objects.filter(run=yesterday).values_list("pair__symbol", "board_score")) if yesterday else {}
    for sym, p in result["pairs"].items():
        for r in (p["trend"], p["retail"]):
            factor_rows.append(FactorScore(run=run, factor=r.factor, pair=p["pair"], raw_value=r.raw, score=r.score, is_stale=r.stale, detail=r.detail))
        prev_board = before_board.get(sym)
        pair_rows.append(PairScore(
            run=run, pair=p["pair"], score=p["score"], label=scoring.label_for(p["score"]), rank=ranks.get(sym),
            change_wow=changes[sym], close=p["close"], detail=p["detail"],
            board_score=p["board_score"], board_label=p["board_label"], board_rank=board_ranks.get(sym),
            change_1d=p["board_score"] - prev_board if prev_board is not None and p["board_score"] is not None else None,
            momentum=p["momentum"], final_score=p["final"], final_label=scoring.label_for(p["final"]), final_rank=final_ranks.get(sym),
            mixed=p["mixed"],
        ))
    for code, cells in result["board"]["currencies"].items():
        ccy = result["currency_objs"][code]
        for ind, cell in cells.items():
            factor_rows.append(FactorScore(run=run, factor=f"m_{ind}", currency=ccy, score=cell.score, raw_value=cell.detail.get("actual"),
                                           is_stale=cell.status == "stale", detail={"status": cell.status, **_jsonable(cell.detail)}))
    FactorScore.objects.bulk_create(factor_rows)
    CurrencyScore.objects.bulk_create(currency_rows)
    PairScore.objects.bulk_create(pair_rows)
    stale = sorted({f"{fs.currency.code if fs.currency else fs.pair.symbol}:{fs.factor}" for fs in factor_rows
                    if fs.is_stale and not fs.factor.startswith("m_")})  # scoreboard cells carry their own status
    run.notes = {"stale": stale, "insufficient": [c.currency.code for c in currency_rows if c.score is None]}
    run.finished_at = timezone.now()
    run.save(update_fields=["notes", "finished_at", "updated_at"])
    return run


def _jsonable(d: dict) -> dict:
    return {k: v.isoformat() if isinstance(v, (date, datetime)) else v for k, v in d.items()}


def run_scoring(as_of: date | None = None, *, snapshot: bool | None = None) -> ScoringRun:
    as_of = as_of or timezone.localdate()
    snapshot = as_of.weekday() == SNAPSHOT_WEEKDAY if snapshot is None else snapshot
    version, cfg = config()
    run = save_run(as_of, compute(as_of, Data(), cfg), snapshot=snapshot, replay=False, version=version)
    # Live (non-snapshot) runs only feed the current view; keep a week of them.
    ScoringRun.objects.filter(is_weekly_snapshot=False, as_of__lt=as_of - timedelta(days=7)).delete()
    return run


def replay(weeks: int = 156) -> int:
    """Weekly snapshots for the past `weeks` Saturdays, from stored history (spec validation step 1)."""
    version, cfg = config()
    data = Data()
    today = timezone.localdate()
    last_saturday = today - timedelta(days=(today.weekday() - SNAPSHOT_WEEKDAY) % 7)
    ScoringRun.objects.filter(is_replay=True).delete()
    live = set(ScoringRun.objects.filter(is_weekly_snapshot=True).values_list("as_of", flat=True))
    made = 0
    for k in range(weeks, 0, -1):
        as_of = last_saturday - timedelta(weeks=k)
        if as_of in live:
            continue
        save_run(as_of, compute(as_of, data, cfg, replay=True), snapshot=True, replay=True, version=version)
        made += 1
    return made


# --- Evidence (spec "Validating the scoring") ---------------------------------------------------


def evidence() -> dict:
    """Direction hit rate and average directional return by label over the next 1, 4 and 12 weeks."""
    rows = PairScore.objects.filter(run__is_weekly_snapshot=True, score__isnull=False, close__isnull=False).values_list(
        "pair__symbol", "run__as_of", "score", "label", "close"
    )
    by_pair: dict[str, dict[date, tuple]] = defaultdict(dict)
    for sym, as_of, score, label, close in rows:
        by_pair[sym][as_of] = (score, label, close)
    labels = ["very_bullish", "bullish", "neutral", "bearish", "very_bearish"]
    out = {"horizons": {}, "snapshots": 0, "first": None, "last": None}
    dates = sorted({d for p in by_pair.values() for d in p})
    if dates:
        out.update(snapshots=len(dates), first=dates[0].isoformat(), last=dates[-1].isoformat())
    for h in (1, 4, 12):
        stats = {lab: {"n": 0, "hits": 0, "ret": 0.0} for lab in labels}
        for points in by_pair.values():
            for as_of, (score, label, close) in points.items():
                later = points.get(as_of + timedelta(weeks=h))
                if not later or not score:
                    continue
                ret = later[2] / close - 1
                direction = 1 if score > 0 else -1
                s = stats[label]
                s["n"] += 1
                s["hits"] += 1 if ret * direction > 0 else 0
                s["ret"] += ret * direction * 100
        table = {lab: {"n": s["n"], "hit_rate": round(s["hits"] / s["n"], 3) if s["n"] else None,
                       "avg_return_pct": round(s["ret"] / s["n"], 3) if s["n"] else None} for lab, s in stats.items()}
        strong_n = table["very_bullish"]["n"] + table["very_bearish"]["n"]
        strong_hits = stats["very_bullish"]["hits"] + stats["very_bearish"]["hits"]
        strong = round(strong_hits / strong_n, 3) if strong_n else None
        neutral = table["neutral"]["hit_rate"]
        table["strong_vs_neutral"] = {"strong_hit_rate": strong, "strong_n": strong_n, "neutral_hit_rate": neutral,
                                      "passes": strong is not None and neutral is not None and strong > neutral}
        out["horizons"][str(h)] = table
    return out
