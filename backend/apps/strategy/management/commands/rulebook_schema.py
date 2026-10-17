from django.core.management.base import BaseCommand

from apps.strategy.schema import write_schema


class Command(BaseCommand):
    help = "Regenerates apps/strategy/schema/rulebook.v1.json from the vocabulary."

    def handle(self, *args, **options):
        self.stdout.write(f"Wrote {write_schema()}")
