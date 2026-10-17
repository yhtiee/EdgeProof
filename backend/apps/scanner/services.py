"""
Scoring runs, weekly snapshots, the historical replay and the evidence report
(spec "Scoring methodology", "Snapshots", "Validating the scoring").

A run scores everything as of one date using only observations that were
available by then, so live runs and the 3-year replay share one code path.
"""

import bisect
from collections import defaultdict
from datetime import date, timedelta

from django.db import transaction
from django.utils import timezone

from . import scoring
from .models import (
    Currency,
    CurrencyScore,
    FactorConfig,
    FactorScore,
    Pair,
    PairScore,
    RawObservation,
    ScoringRun,
)
from .reference import FACTORS_CURRENCY, QUARTERLY_WINDOW

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
    currency_scores = {code: scoring.currency_score(res, weights) for code, res in factor_results.items()}

    pairs = {}
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
        pairs[p.symbol] = {"pair": p, "score": score, "trend": trend, "retail": retail, "detail": detail, "close": closes[-1].value if closes else None}
    return {"factors": factor_results, "currencies": currency_scores, "pairs": pairs, "currency_objs": currencies}


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
    for sym, p in result["pairs"].items():
        for r in (p["trend"], p["retail"]):
            factor_rows.append(FactorScore(run=run, factor=r.factor, pair=p["pair"], raw_value=r.raw, score=r.score, is_stale=r.stale, detail=r.detail))
        pair_rows.append(PairScore(
            run=run, pair=p["pair"], score=p["score"], label=scoring.label_for(p["score"]), rank=ranks.get(sym),
            change_wow=changes[sym], close=p["close"], detail=p["detail"],
        ))
    FactorScore.objects.bulk_create(factor_rows)
    CurrencyScore.objects.bulk_create(currency_rows)
    PairScore.objects.bulk_create(pair_rows)
    stale = sorted({f"{fs.currency.code if fs.currency else fs.pair.symbol}:{fs.factor}" for fs in factor_rows if fs.is_stale})
    run.notes = {"stale": stale, "insufficient": [c.currency.code for c in currency_rows if c.score is None]}
    run.finished_at = timezone.now()
    run.save(update_fields=["notes", "finished_at", "updated_at"])
    return run


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
