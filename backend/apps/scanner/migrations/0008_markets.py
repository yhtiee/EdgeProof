"""
Indices, stocks and crypto (founder decision 19 Nov 2026, docs/scanner/markets.md): longer
symbols, no base or quote currency for them, and one Pair row per instrument.
"""

import django.db.models.deletion
from django.db import migrations, models


def seed(apps, schema_editor):
    from apps.scanner.reference import INSTRUMENTS

    Pair = apps.get_model("scanner", "Pair")
    for symbol in INSTRUMENTS:
        Pair.objects.update_or_create(symbol=symbol, defaults={"base": None, "quote": None})


def unseed(apps, schema_editor):
    from apps.scanner.reference import INSTRUMENTS

    apps.get_model("scanner", "Pair").objects.filter(symbol__in=list(INSTRUMENTS)).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("scanner", "0007_gold_and_merge"),
    ]

    operations = [
        migrations.AlterField(
            model_name="explanation",
            name="subject",
            field=models.CharField(max_length=10),
        ),
        migrations.AlterField(
            model_name="pair",
            name="base",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="+", to="scanner.currency"),
        ),
        migrations.AlterField(
            model_name="pair",
            name="quote",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="+", to="scanner.currency"),
        ),
        migrations.AlterField(
            model_name="pair",
            name="symbol",
            field=models.CharField(max_length=10, unique=True),
        ),
        migrations.RunPython(seed, unseed),
    ]
