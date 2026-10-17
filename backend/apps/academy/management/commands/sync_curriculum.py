"""
Mirrors the compiled curriculum (frontend/public/lessons/index.json) into the
database so lesson progress, exams and gates can reference it. The content
repo stays the source of truth (spec §5 "Content authoring").

    python manage.py sync_curriculum ../frontend/public/lessons/index.json

Idempotent. Lessons missing from the index are set back to draft, and
levels and modules are published only when they contain a published lesson.
"""

import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.academy.models import Lesson, Level, Module

PUBLISHED, DRAFT = Lesson.Status.PUBLISHED, Lesson.Status.DRAFT


# The frontend sits beside the backend in this repo.
FRONTEND = Path(__file__).resolve().parents[5] / "frontend"
DEFAULT_INDEX = FRONTEND / "public" / "lessons" / "index.json"


class Command(BaseCommand):
    help = "Sync levels, modules and lessons from the compiled lesson index."

    def add_arguments(self, parser):
        parser.add_argument(
            "index", type=Path, nargs="?", default=DEFAULT_INDEX,
            help=f"Path to public/lessons/index.json (default: {DEFAULT_INDEX})",
        )

    @transaction.atomic
    def handle(self, *args, index: Path, **options):
        if not index.exists():
            raise CommandError(f"{index} not found. Run the frontend lesson compiler first.")
        data = json.loads(index.read_text(encoding="utf-8"))

        seen: set[str] = set()
        counts = {"levels": 0, "modules": 0, "lessons": 0}
        for lv in data["levels"]:
            level_published = False
            level, _ = Level.objects.update_or_create(
                slug=lv["slug"], defaults={"order": lv["order"], "title": lv["title"], "phase": lv.get("phase", 1)}
            )
            counts["levels"] += 1
            for md in lv["modules"]:
                module, _ = Module.objects.update_or_create(
                    slug=md["slug"], defaults={"level": level, "order": md["order"], "title": md["title"]}
                )
                counts["modules"] += 1
                module_published = False
                for ls in md["lessons"]:
                    status = PUBLISHED if ls.get("status") == "published" else DRAFT
                    Lesson.objects.update_or_create(
                        slug=ls["slug"],
                        defaults={
                            "module": module,
                            "order": ls["order"],
                            "title": ls["title"],
                            "block_count": ls["screens"],
                            "minutes": ls.get("minutes", 5),
                            "status": status,
                        },
                    )
                    seen.add(ls["slug"])
                    counts["lessons"] += 1
                    module_published |= status == PUBLISHED
                module.status = PUBLISHED if module_published else DRAFT
                module.save(update_fields=["status", "updated_at"])
                level_published |= module_published
            level.status = PUBLISHED if level_published else DRAFT
            level.save(update_fields=["status", "updated_at"])

        retired = Lesson.objects.exclude(slug__in=seen).exclude(status=DRAFT).update(status=DRAFT)
        self.stdout.write(
            self.style.SUCCESS(
                f"Synced {counts['levels']} levels, {counts['modules']} modules, {counts['lessons']} lessons"
                f" ({retired} retired to draft)."
            )
        )
