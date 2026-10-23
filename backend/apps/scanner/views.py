"""
Scanner API (spec "API endpoints", read-only). Signed-in users only, no gate
(founder decision). Responses are cached until the next scoring run.
"""

import json
import threading

from django.conf import settings
from django.core.cache import cache
from django.http import StreamingHttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import permissions, serializers
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
    throttle_classes,
)
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.ai import providers as ai_providers
from apps.ai import tutor
from apps.ai.views import EventStreamRenderer, ai_settings
from apps.core.models import Job
from apps.core.views import verify_sweep_signature

from . import evidence, explain, ingest, services
from .evidence import SOURCE_LABEL
from .health import health
from .models import (
    CurrencyScore,
    DataSource,
    Explanation,
    FactorScore,
    Pair,
    PairScore,
    RawObservation,
    ScoringRun,
)
from .reference import (
    BOARD_MACRO,
    BOARD_TECH,
    BOARD_TEXT,
    CALENDAR_LINK,
    CURRENCIES,
    DISCLAIMER,
    FACTOR_LESSON,
    FACTOR_TEXT,
    FACTORS_CURRENCY,
    FACTORS_PAIR,
    LABEL_TEXT,
    MERGE,
    ORDER,
)
from .sources.providers import JOBS


def latest_run() -> ScoringRun:
    run = ScoringRun.objects.filter(is_replay=False, finished_at__isnull=False).order_by("-as_of", "-finished_at").first()
    if not run:
        raise NotFound("The scanner hasn't run yet.")
    return run


# Bump when a response's shape or wording changes, so cached copies built by older code are ignored.
CACHE_VERSION = 3


def cached(request, run: ScoringRun, build):
    key = f"scanner:v{CACHE_VERSION}:{run.id}:{request.get_full_path()}"
    data = cache.get(key)
    if data is None:
        data = build()
        cache.set(key, data, 60 * 60 * 6)
    return Response(data)


def run_meta(run: ScoringRun) -> dict:
    return {
        "as_of": run.as_of.isoformat(),
        "updated_at": run.finished_at.isoformat() if run.finished_at else None,
        "is_weekly_snapshot": run.is_weekly_snapshot,
        "stale": (run.notes or {}).get("stale", []),
        "disclaimer": DISCLAIMER,
    }


def _label(label: str) -> dict:
    return {"label": label, "label_text": LABEL_TEXT.get(label, label)}


class PairsView(APIView):
    """GET /scanner/pairs?label=&currency=&strong=1: ranked pairs from the latest run."""

    def get(self, request):
        run = latest_run()

        def build():
            rows = PairScore.objects.filter(run=run).select_related("pair__base", "pair__quote")
            stale = (run.notes or {}).get("stale", [])
            out = []
            for p in rows:
                sym = p.pair.symbol
                out.append({
                    "symbol": sym, "base": p.pair.base.code, "quote": p.pair.quote.code, "score": p.score, **_label(p.label),
                    "rank": p.rank, "change_wow": p.change_wow, "agreement": (p.detail or {}).get("agreement"),
                    "stale_factors": [s.split(":")[1] for s in stale if s.split(":")[0] in (sym, p.pair.base.code, p.pair.quote.code)],
                    # Final bias: regime (`score`) blended with momentum (docs/scanner/scoreboard.md).
                    # A run from before the scoreboard has no final bias: fall back to the regime score.
                    "final_score": p.final_score if p.final_label else p.score,
                    "final_label": p.final_label or p.label, "final_rank": p.final_rank if p.final_label else None,
                    "momentum": p.momentum, "mixed": p.mixed, "board_score": p.board_score,
                })
            out.sort(key=lambda r: (r["final_score"] is None, -(r["final_score"] or 0), r["symbol"]))
            return {**run_meta(run), "pairs": out}

        response = cached(request, run, build)
        label, currency, strong = request.query_params.get("label"), request.query_params.get("currency", "").upper(), request.query_params.get("strong")
        pairs = response.data["pairs"]
        if label:
            pairs = [p for p in pairs if p["label"] == label]
        if currency:
            pairs = [p for p in pairs if currency in (p["base"], p["quote"])]
        if strong in ("1", "true"):
            pairs = [p for p in pairs if p["label"] in ("very_bullish", "very_bearish")]
        return Response({**response.data, "pairs": pairs})


def _currency_block(run: ScoringRun, code: str, sources: dict) -> dict:
    cs = CurrencyScore.objects.select_related("currency").get(run=run, currency__code=code)
    factors = FactorScore.objects.filter(run=run, currency__code=code).exclude(factor__startswith="m_")  # scoreboard cells are served separately
    return {
        "code": code, "name": cs.currency.name, "central_bank": cs.currency.central_bank, "score": cs.score, **_label(cs.label),
        "factors_used": cs.factors_used,
        "factors": {f.factor: {"score": f.score, "raw": f.raw_value, "stale": f.is_stale, "detail": f.detail,
                               "source": SOURCE_LABEL.get(sources.get((f.factor, code), ""), "")} for f in factors},
    }


def _sources() -> dict:
    out = {}
    for factor, ccy, pair, name in RawObservation.objects.values_list("factor", "currency__code", "pair__symbol", "source__name").distinct():
        out[(factor, ccy or pair)] = name
    return out


class CurrenciesView(APIView):
    """GET /scanner/currencies: the currency strength board."""

    def get(self, request):
        run = latest_run()

        def build():
            sources = _sources()
            codes = list(CurrencyScore.objects.filter(run=run, currency__code__in=ORDER).values_list("currency__code", flat=True))  # gold isn't a currency
            blocks = [_currency_block(run, c, sources) for c in codes]
            blocks.sort(key=lambda b: (b["score"] is None, -(b["score"] or 0)))
            return {**run_meta(run), "currencies": blocks, "factor_text": _factor_text()}

        return cached(request, run, build)


def _factor_text() -> dict:
    return {f: {"name": FACTOR_TEXT[f][0], "about": FACTOR_TEXT[f][1], "lesson": FACTOR_LESSON[f]} for f in FACTOR_TEXT}


def _signed(v: float) -> str:
    return f"{v:+.1f}".replace("-", "−")


def _summary(sym: str, ps: PairScore, base: dict, quote: dict, trend: dict, retail: dict, contributions: dict) -> str:
    if ps.score is None:
        return f"{sym[:3]}/{sym[3:]} has no score this week: one of its currencies has too little fresh data."
    drivers = sorted(((v, k) for k, v in contributions.items() if v), key=lambda t: -abs(t[0]))[:2]
    names = {f: FACTOR_TEXT[f][0].split(" (")[0].lower() for f in FACTOR_TEXT}
    driver_text = " and ".join(f"{names.get(k, k)} ({_signed(v)})" for v, k in drivers)
    parts = [f"{sym[:3]}/{sym[3:]} is {LABEL_TEXT[ps.label]} at {_signed(ps.score)}."]
    if base["score"] is not None and quote["score"] is not None:
        parts.append(f"The {base['name']} scores {_signed(base['score'])} and the {quote['name']} {_signed(quote['score'])}.")
    if driver_text:
        parts.append(f"The biggest contributions come from {driver_text}.")
    if retail.get("raw") is not None:
        parts.append(f"{retail['raw']:.0f}% of retail traders are long, read contrarian.")
    return " ".join(parts)


class PairDetailView(APIView):
    """GET /scanner/pairs/{symbol}: the scorecard, factor by factor, with sources and dates."""

    def get(self, request, symbol):
        run = latest_run()
        pair = get_object_or_404(Pair.objects.select_related("base", "quote"), symbol=symbol.upper())

        def build():
            ps = PairScore.objects.get(run=run, pair=pair)
            sources = _sources()
            base, quote = _currency_block(run, pair.base.code, sources), _currency_block(run, pair.quote.code, sources)
            pf = {f.factor: {"score": f.score, "raw": f.raw_value, "stale": f.is_stale, "detail": f.detail,
                             "source": SOURCE_LABEL.get(sources.get((f.factor, pair.symbol), ""), "")}
                  for f in FactorScore.objects.filter(run=run, pair=pair)}
            detail = ps.detail or {}
            weights_used = detail.get("weights_used") or 1
            _, cfg = services.config(run.config_version)
            contributions = {}

            def used_weight(block):
                return sum(cfg[f].weight for f, v in block["factors"].items() if f in FACTORS_CURRENCY and v["score"] is not None and not v["stale"])

            wb, wq = used_weight(base), used_weight(quote)
            for f in FACTORS_CURRENCY:
                fb, fq = base["factors"].get(f, {}), quote["factors"].get(f, {})
                cb = cfg[f].weight * fb["score"] / (2 * wb) * 10 if wb and fb.get("score") is not None and not fb.get("stale") else 0
                cq = cfg[f].weight * fq["score"] / (2 * wq) * 10 if wq and fq.get("score") is not None and not fq.get("stale") else 0
                contributions[f] = round(0.7 / weights_used * (cb - cq) / 2, 2) if ps.score is not None else None
            for f in ("trend", "retail"):
                contributions[f] = (detail.get("contributions") or {}).get(f)
            return {
                **run_meta(run), "symbol": pair.symbol, "score": ps.score, **_label(ps.label), "rank": ps.rank, "change_wow": ps.change_wow,
                "agreement": detail.get("agreement"), "components": detail.get("components"), "base": base, "quote": quote,
                "pair_factors": pf, "contributions": contributions, "factor_text": _factor_text(),
                "summary": _summary(pair.symbol, ps, base, quote, pf.get("trend", {}), pf.get("retail", {}), contributions),
            }

        return cached(request, run, build)


class ScoreboardView(APIView):
    """GET /scanner/scoreboard: the 18-column board for every pair and gold, most bullish first (docs/scanner/scoreboard.md)."""

    def get(self, request):
        run = latest_run()

        def build():
            rows = []
            for p in PairScore.objects.filter(run=run).select_related("pair__base", "pair__quote"):
                rows.append({
                    "symbol": p.pair.symbol, "base": p.pair.base.code, "quote": p.pair.quote.code,
                    "score": p.board_score, **_label(p.board_label or "insufficient"),
                    "rank": p.board_rank, "change_1d": p.change_1d, "columns": (p.detail or {}).get("board", {}),
                    "final_score": p.final_score, "final_label": p.final_label or "insufficient", "regime": p.score,
                    "momentum": p.momentum, "mixed": p.mixed,
                })
            rows.sort(key=lambda r: (r["rank"] is None, r["rank"] or 0))
            if all(r["score"] is None for r in rows):
                rows = []  # a run from before the scoreboard: the page says it appears after the next run
            return {**run_meta(run), "rows": rows, "groups": {"tech": BOARD_TECH, "macro": BOARD_MACRO},
                    "columns": {c: {"short": t[0], "name": t[1], "about": t[2]} for c, t in BOARD_TEXT.items()},
                    "merge": MERGE, "calendar_link": {"label": CALENDAR_LINK[0], "url": CALENDAR_LINK[1]}}

        return cached(request, run, build)


class PairHistoryView(APIView):
    """GET /scanner/pairs/{symbol}/history?weeks=52|all: weekly snapshot scores and closes."""

    def get(self, request, symbol):
        pair = get_object_or_404(Pair, symbol=symbol.upper())
        weeks = request.query_params.get("weeks", "52")
        if weeks != "all" and not weeks.isdigit():
            raise ValidationError({"weeks": ["Use a number of weeks or 'all'."]})
        rows = PairScore.objects.filter(pair=pair, run__is_weekly_snapshot=True).order_by("-run__as_of").values(
            "run__as_of", "score", "label", "close", "run__is_replay"
        )
        if weeks != "all":
            rows = rows[: int(weeks)]
        points = [{"as_of": r["run__as_of"].isoformat(), "score": r["score"], "label": r["label"], "close": r["close"], "replay": r["run__is_replay"]} for r in rows]
        return Response({"symbol": pair.symbol, "points": list(reversed(points)), "disclaimer": DISCLAIMER})


class StatusView(APIView):
    """GET /scanner/status: last run and any stale factors or failing sources."""

    def get(self, request):
        return Response(health())


class EvidenceView(APIView):
    """GET /scanner/evidence: how each label did over the following 1, 4 and 12 weeks."""

    def get(self, request):
        last = ScoringRun.objects.filter(is_weekly_snapshot=True).order_by("-created_at").values_list("id", flat=True).first()
        key = f"scanner:v{CACHE_VERSION}:evidence:{last}"
        data = cache.get(key)
        if data is None:
            data = {**services.evidence(), "disclaimer": DISCLAIMER}
            cache.set(key, data, 60 * 60 * 12)
        return Response(data)


# --- Scheduled jobs (deployed: GitHub Actions → this endpoint, HMAC like the sweep) ------------


def _run_job(job_id, name):
    job = Job.objects.get(pk=job_id)
    job.status = Job.Status.RUNNING
    job.save(update_fields=["status", "updated_at"])
    try:
        if name in JOBS:
            result = {"sources": ingest.run_job(name)}
            run = services.run_scoring()
            result["run"] = str(run.id)
        elif name == "run_scoring":
            result = {"run": str(services.run_scoring().id)}
        else:
            result = health()
        job.status, job.result, job.progress = Job.Status.DONE, result, 100
    except Exception as exc:  # noqa: BLE001 (recorded on the job; the sweep retries stuck jobs)
        job.status, job.error = Job.Status.FAILED, str(exc)[:1000]
    job.save()


@api_view(["POST"])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
@throttle_classes([])
def scheduled_job(request, name):
    """POST /internal/scanner/<job>: starts the job in a thread and returns at once (the free host may sleep)."""
    verify_sweep_signature(request)
    if name not in (*JOBS, "run_scoring", "check_health"):
        raise NotFound("Unknown job.")
    from apps.accounts.models import User

    owner = User.objects.filter(is_superuser=True).order_by("created_at").first() or User.objects.order_by("created_at").first()
    if owner is None:
        raise NotFound("No user to own the job record yet.")
    job = Job.objects.create(user=owner, kind="scanner", payload={"job": name})
    threading.Thread(target=_run_job, args=(job.id, name), daemon=True).start()
    return Response({"job": str(job.id), "started": name}, status=202)



# --- Evidence and "Explain it simply" (founder request, docs/scanner §7) ---------------------


def _subject(subject: str) -> str:
    s = subject.upper()
    if len(s) == 3 and s in {c for c, *_ in CURRENCIES}:
        return s
    if len(s) == 6 and Pair.objects.filter(symbol=s).exists():
        return s
    raise NotFound("Unknown pair or currency.")


class FactorEvidenceView(APIView):
    """GET /scanner/factor/{subject}/{factor}: recent prints, official release links and central bank publications."""

    def get(self, request, subject, factor):
        run = latest_run()
        subject = _subject(subject)
        if not evidence.valid_factor(subject, factor):
            raise NotFound("Unknown factor.")
        return cached(request, run, lambda: {**evidence.factor_evidence(run, subject, factor), "disclaimer": DISCLAIMER})


def _explain_blocker(user) -> tuple[int, dict] | None:
    if not ai_providers.enabled():
        return 503, {"code": "ai_off", "message": "AI explanations are switched off on this server."}
    if not ai_settings(user)["ai_enabled"]:
        return 409, {"code": "ai_disabled", "message": "AI features are off in your settings."}
    if tutor.breaker_tripped():
        return 503, {"code": "ai_paused", "message": "AI explanations are paused for the rest of the month while costs are reviewed."}
    return None


class ExplainStatusView(APIView):
    """GET /scanner/explain/status: whether explanations are available and how many new ones are left today."""

    def get(self, request):
        block = _explain_blocker(request.user)
        return Response({"available": block is None, "reason": block[1] if block else None, "remaining": explain.remaining(request.user),
                         "limit": settings.AI.get("scanner_daily_limit", 20)})


class ExplainView(APIView):
    """
    POST /scanner/explain {subject, factor?}: a streamed plain-language explanation
    (server-sent events: meta, text, reset, done | refused | error). Cached answers
    are free; a new one counts toward the daily limit.
    """

    renderer_classes = [JSONRenderer, EventStreamRenderer]

    class Body(serializers.Serializer):
        subject = serializers.RegexField(r"^[A-Za-z]{3}(?:[A-Za-z]{3})?$")
        factor = serializers.ChoiceField(choices=[*FACTORS_CURRENCY, *FACTORS_PAIR], required=False, allow_blank=True)

    def post(self, request):
        body = self.Body(data=request.data)
        body.is_valid(raise_exception=True)
        subject = _subject(body.validated_data["subject"])
        factor = body.validated_data.get("factor") or None
        if factor and not evidence.valid_factor(subject, factor):
            raise NotFound("Unknown factor.")
        run = latest_run()
        block = _explain_blocker(request.user)
        if block is None and explain.remaining(request.user) <= 0 and not Explanation.objects.filter(key=explain.cache_key(run, subject, factor)).exists():
            block = 429, {"code": "explain_limit", "message": "You've used today's new explanations. Ones others have already asked for still open, and the count resets at midnight your time."}
        if block:
            code, payload = block
            return Response({**payload, "fields": {}}, status=code, content_type="application/json")
        events = explain.answer_events(request.user, run, subject, factor)

        def sse():
            for event in events:
                yield f"data: {json.dumps(event)}\n\n"

        response = StreamingHttpResponse(sse(), content_type="text/event-stream")
        response["Cache-Control"] = "no-store"
        response["X-Accel-Buffering"] = "no"
        return response


class CalendarView(APIView):
    """GET /scanner/calendar/{subject}: upcoming releases for a currency or both sides of a pair (Forex Factory), next 10 days."""

    def get(self, request, subject):
        subject = _subject(subject)
        codes = [subject] if len(subject) == 3 else [subject[:3], subject[3:]]
        source = DataSource.objects.filter(name="calendar").first()
        return Response({"events": evidence.calendar(codes, back_days=0, ahead_days=10),
                         "fetched_at": source.last_success_at.isoformat() if source and source.last_success_at else None,
                         "link": {"label": CALENDAR_LINK[0], "url": CALENDAR_LINK[1]}})
