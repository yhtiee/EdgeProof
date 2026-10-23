"""Add gold (XAU and XAUUSD) and the regime/momentum blend weight to every config version (docs/scanner/scoreboard.md)."""

from django.db import migrations


def seed(apps, schema_editor):
    from apps.scanner.reference import MERGE, METALS

    Currency = apps.get_model("scanner", "Currency")
    Pair = apps.get_model("scanner", "Pair")
    FactorConfig = apps.get_model("scanner", "FactorConfig")
    usd = Currency.objects.get(code="USD")
    for code, name, bank, cot, target in METALS:
        metal, _ = Currency.objects.update_or_create(
            code=code, defaults={"name": name, "central_bank": bank, "cot_contract_code": cot, "inflation_target": target}
        )
        Pair.objects.update_or_create(symbol=f"{code}USD", defaults={"base": metal, "quote": usd})
    for version in set(FactorConfig.objects.values_list("version", flat=True)):
        FactorConfig.objects.update_or_create(
            version=version, factor="momentum",
            defaults={"weight": MERGE["momentum"], "refresh_window_days": 0, "thresholds": {"mixed_at": MERGE["mixed_at"]}, "active": True},
        )


def unseed(apps, schema_editor):
    apps.get_model("scanner", "Pair").objects.filter(symbol="XAUUSD").delete()
    apps.get_model("scanner", "Currency").objects.filter(code="XAU").delete()
    apps.get_model("scanner", "FactorConfig").objects.filter(factor="momentum").delete()


class Migration(migrations.Migration):
    dependencies = [("scanner", "0006_scoreboard")]
    operations = [migrations.RunPython(seed, unseed)]
