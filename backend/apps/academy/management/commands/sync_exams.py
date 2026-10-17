"""
Mirrors compiled question banks (frontend/content/build/exams.json, made by
`npm run exams`) into the database. Answers live only here and in the
repository's content files, never in the public lesson JSON (AC-5).

    python manage.py sync_exams ../frontend/content/build/exams.json

Idempotent. Questions and exams missing from the file are set back to draft,
so they stop being drawn; past attempts keep their history.
"""

import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.academy.models import Exam, Level, Module, Question

PUBLISHED, DRAFT = Question.Status.PUBLISHED, Question.Status.DRAFT
TYPES = {"mc": Question.Type.MULTIPLE_CHOICE, "numeric": Question.Type.NUMERIC}


# The frontend sits beside the backend in this repo.
FRONTEND = Path(__file__).resolve().parents[5] / "frontend"
DEFAULT_PATH = FRONTEND / "content" / "build" / "exams.json"


class Command(BaseCommand):
    help = "Sync exam question banks and exams from the compiled exams file."

    def add_arguments(self, parser):
        parser.add_argument(
            "path", type=Path, nargs="?", default=DEFAULT_PATH,
            help=f"Path to content/build/exams.json (default: {DEFAULT_PATH})",
        )

    @transaction.atomic
    def handle(self, *args, path: Path, **options):
        if not path.exists():
            raise CommandError(f"{path} not found. Run `npm run exams` in the frontend first.")
        data = json.loads(path.read_text(encoding="utf-8"))

        by_key = {}
        for q in data["questions"]:
            question, _ = Question.objects.update_or_create(
                key=q["key"],
                defaults={
                    "type": TYPES[q["type"]],
                    "prompt": q["prompt"],
                    "options": q.get("options", []),
                    "answer": q["answer"],
                    "tolerance": q.get("tolerance"),
                    "unit": q.get("unit", ""),
                    "explanation": q.get("explanation", ""),
                    "concept_tags": q.get("lessons", []),
                    "status": PUBLISHED,
                },
            )
            by_key[q["key"]] = question
        retired_q = Question.objects.exclude(key__in=by_key).exclude(key__isnull=True).update(status=DRAFT)

        exam_keys = []
        for e in data["exams"]:
            try:
                level = Level.objects.get(order=e["level"])
                module = Module.objects.get(slug=e["module"]) if e.get("module") else None
            except (Level.DoesNotExist, Module.DoesNotExist) as exc:
                raise CommandError(f"{e['key']}: {exc}. Run sync_curriculum first.") from exc
            exam, _ = Exam.objects.update_or_create(
                key=e["key"],
                defaults={
                    "title": e["title"],
                    "scope": e["scope"],
                    "level": level,
                    "module": module,
                    "draw_count": e["draw"],
                    "pass_mark": e["pass_mark"],
                    "cooldown_hours": e.get("cooldown_hours", 24),
                    "status": PUBLISHED,
                },
            )
            exam.bank.set([by_key[k] for k in e["bank"]])
            exam_keys.append(e["key"])
        retired_e = Exam.objects.exclude(key__in=exam_keys).exclude(key__isnull=True).update(status=DRAFT)

        self.stdout.write(
            self.style.SUCCESS(
                f"Synced {len(by_key)} questions and {len(exam_keys)} exams "
                f"({retired_q} questions and {retired_e} exams retired to draft)."
            )
        )
