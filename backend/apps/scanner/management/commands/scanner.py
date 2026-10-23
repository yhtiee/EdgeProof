"""
Scanner jobs (spec "Scheduled jobs"), runnable locally:

  manage.py scanner fetch_macro|fetch_cot|fetch_prices|fetch_sentiment [--backfill]
  manage.py scanner run_scoring [--date YYYY-MM-DD] [--snapshot]
  manage.py scanner replay [--weeks 156]
  manage.py scanner backfill      # all sources, 3 years, then replay and score today
  manage.py scanner check_health
  manage.py scanner compare --csv tests/fixtures/scoreboard_benchmark_2026-10-23.csv   # scoreboard vs a benchmark table
"""

import csv
from datetime import date

from django.core.management.base import BaseCommand, CommandError

from apps.scanner import ingest, scoreboard, services
from apps.scanner.health import health
from apps.scanner.models import PairScore, ScoringRun
from apps.scanner.reference import BOARD_COLUMNS
from apps.scanner.sources.providers import JOBS


def load_benchmark(path: str) -> dict[str, dict]:
    """A benchmark board as CSV: symbol, score and one column per board column. "GOLD" means XAUUSD."""
    with open(path, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    return {("XAUUSD" if r["symbol"] == "GOLD" else r["symbol"]): {k: int(v) for k, v in r.items() if k != "symbol"} for r in rows}


def our_board(run: ScoringRun) -> dict[str, dict]:
    return {p.pair.symbol: {"columns": (p.detail or {}).get("board", {}), "score": p.board_score, "label": p.board_label}
            for p in PairScore.objects.filter(run=run, board_score__isnull=False).select_related("pair")}


class Command(BaseCommand):
    help = "Run a Fundamental Bias Scanner job."

    def add_arguments(self, parser):
        parser.add_argument("job", choices=[*JOBS, "run_scoring", "replay", "backfill", "check_health", "compare"])
        parser.add_argument("--backfill", action="store_true")
        parser.add_argument("--date")
        parser.add_argument("--snapshot", action="store_true")
        parser.add_argument("--weeks", type=int, default=156)
        parser.add_argument("--csv", dest="benchmark", help="compare: the benchmark board to check against")

    def handle(self, *args, job, backfill, date: str | None, snapshot, weeks, benchmark: str | None, **opts):
        if job == "compare":
            return self.compare(benchmark, date)
        if job in JOBS:
            for r in ingest.run_job(job, backfill=backfill):
                self.stdout.write(str(r))
            run = services.run_scoring()
            self.stdout.write(f"Scored run {run.id} as of {run.as_of} (snapshot={run.is_weekly_snapshot})")
        elif job == "run_scoring":
            as_of = _parse(date) if date else None
            run = services.run_scoring(as_of, snapshot=True if snapshot else None)
            self.stdout.write(f"Scored run {run.id} as of {run.as_of}; stale: {run.notes.get('stale')}")
        elif job == "replay":
            self.stdout.write(f"Replayed {services.replay(weeks)} weekly snapshots")
        elif job == "backfill":
            for name in ["cftc", "bis", "oecd", "eurostat", "fred", "fred_us", "snb", "dbnomics", "myfxbook", "twelvedata",
                         "twelvedata_monthly", "news", "calendar", "releases"]:
                self.stdout.write(str(ingest.run_source(name, backfill=True)))
            self.stdout.write(f"Replayed {services.replay(weeks)} weekly snapshots")
            run = services.run_scoring()
            self.stdout.write(f"Scored today: run {run.id}; stale: {run.notes.get('stale')}")
        elif job == "check_health":
            report = health()
            for s in report["sources"]:
                self.stdout.write(f"{s['name']:11} ok={s['ok']} last_success={s['last_success_at']} error={s['last_error'][:80]}")
            self.stdout.write(f"stale factors: {report['stale']}")

    def compare(self, path: str | None, as_of: str | None):
        if not path:
            raise CommandError("Use --csv path/to/benchmark.csv")
        runs = ScoringRun.objects.filter(is_replay=False, finished_at__isnull=False)
        run = (runs.filter(as_of=_parse(as_of)) if as_of else runs).order_by("-as_of", "-finished_at").first()
        if run is None:
            raise CommandError("No scoring run to compare.")
        r = scoreboard.compare(our_board(run), load_benchmark(path))
        pct = lambda v: "-" if v is None else f"{v * 100:.0f}%"
        self.stdout.write(f"Run as of {run.as_of}: {r['pairs']} instruments compared")
        self.stdout.write(f"  cells agreeing (where we have data): {pct(r['cell_rate'])}   labels: {pct(r['label_rate'])}")
        self.stdout.write(f"  rank correlation (Spearman): {r['spearman']}   top 5 overlap: {r['top5_overlap']}/5   bottom 5: {r['bottom5_overlap']}/5")
        for c in BOARD_COLUMNS:
            v = r["columns"][c]
            self.stdout.write(f"  {c:12} {v['agree']:>2}/{v['compared']:<2} {pct(v['rate']):>5}  {'; '.join(v['misses'][:4])}")
        worst = sorted(r["score_diffs"].items(), key=lambda t: -abs(t[1]))[:6]
        self.stdout.write("  largest score gaps (ours - benchmark): " + ", ".join(f"{s} {d:+d}" for s, d in worst))


def _parse(text: str) -> date:
    try:
        return date.fromisoformat(text)
    except ValueError as exc:
        raise CommandError("Use --date YYYY-MM-DD") from exc
