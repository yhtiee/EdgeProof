"""Refresh windows measured from the end of each data period (docs/scanner §3, engineer note)."""

from django.db import migrations


def update(apps, schema_editor):
    from apps.scanner.reference import CONFIG_VERSION, DEFAULT_CONFIG

    FactorConfig = apps.get_model("scanner", "FactorConfig")
    for factor, (weight, window, thresholds) in DEFAULT_CONFIG.items():
        FactorConfig.objects.update_or_create(
            version=CONFIG_VERSION, factor=factor, defaults={"weight": weight, "refresh_window_days": window, "thresholds": thresholds}
        )


class Migration(migrations.Migration):
    dependencies = [("scanner", "0002_seed")]
    operations = [migrations.RunPython(update, migrations.RunPython.noop)]
