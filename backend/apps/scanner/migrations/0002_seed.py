"""Seed the 8 currencies, 28 pairs and the default factor config (version 1)."""

from django.db import migrations


def seed(apps, schema_editor):
    from apps.scanner.reference import CONFIG_VERSION, CURRENCIES, DEFAULT_CONFIG, PAIRS

    Currency = apps.get_model("scanner", "Currency")
    Pair = apps.get_model("scanner", "Pair")
    FactorConfig = apps.get_model("scanner", "FactorConfig")
    by_code = {}
    for code, name, bank, cot, target in CURRENCIES:
        by_code[code], _ = Currency.objects.update_or_create(
            code=code, defaults={"name": name, "central_bank": bank, "cot_contract_code": cot, "inflation_target": target}
        )
    for symbol in PAIRS:
        Pair.objects.update_or_create(symbol=symbol, defaults={"base": by_code[symbol[:3]], "quote": by_code[symbol[3:]]})
    for factor, (weight, window, thresholds) in DEFAULT_CONFIG.items():
        FactorConfig.objects.update_or_create(
            version=CONFIG_VERSION, factor=factor,
            defaults={"weight": weight, "refresh_window_days": window, "thresholds": thresholds, "active": True},
        )


class Migration(migrations.Migration):
    dependencies = [("scanner", "0001_initial")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
