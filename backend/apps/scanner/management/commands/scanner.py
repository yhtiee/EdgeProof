"""
Scanner jobs (spec "Scheduled jobs"), runnable locally:

  manage.py scanner fetch_macro|fetch_cot|fetch_prices|fetch_sentiment [--backfill]
  manage.py scanner run_scoring [--date YYYY-MM-DD] [--snapshot]
  manage.py scanner replay [--weeks 156]
  manage.py scanner backfill      # all sources, 3 years, then replay and score today
  manage.py scanner check_health
"""

from datetime import date

from django.core.management.base import BaseCommand, CommandError

from apps.scanner import ingest, services
from apps.scanner.health import health
from apps.scanner.sources.providers import JOBS


class Command(BaseCommand):
    help = "Run a Fundamental Bias Scanner job."

    def add_arguments(self, parser):
        parser.add_argument("job", choices=[*JOBS, "run_scoring", "replay", "backfill", "check_health"])
        parser.add_argument("--backfill", action="store_true")
        parser.add_argument("--date")
        parser.add_argument("--snapshot", action="store_true")
        parser.add_argument("--weeks", type=int, default=156)

    def handle(self, *args, job, backfill, date: str | None, snapshot, weeks, **opts):
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
            for name in ["cftc", "bis", "oecd", "eurostat", "fred", "snb", "dbnomics", "myfxbook", "twelvedata", "news", "calendar"]:
                self.stdout.write(str(ingest.run_source(name, backfill=True)))
            self.stdout.write(f"Replayed {services.replay(weeks)} weekly snapshots")
            run = services.run_scoring()
            self.stdout.write(f"Scored today: run {run.id}; stale: {run.notes.get('stale')}")
        elif job == "check_health":
            report = health()
            for s in report["sources"]:
                self.stdout.write(f"{s['name']:11} ok={s['ok']} last_success={s['last_success_at']} error={s['last_error'][:80]}")
            self.stdout.write(f"stale factors: {report['stale']}")


def _parse(text: str) -> date:
    try:
        return date.fromisoformat(text)
    except ValueError as exc:
        raise CommandError("Use --date YYYY-MM-DD") from exc
