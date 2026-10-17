"""
Rulebook schema, clarity engine and profile fit, against the twelve teaching
fixtures in docs/strategy-lab/fixtures (rulebook-builder.md §3.8). The
frontend runs the same fixtures through clarity.ts, so the two can't drift.
"""

import copy
import json
from pathlib import Path

import pytest

from apps.strategy.banned import find_vague
from apps.strategy.clarity import check
from apps.strategy.fit import profile_fit
from apps.strategy.schema import SCHEMA_PATH, build, schema_errors
from apps.strategy.vocabulary import new_draft

FIXTURES = sorted((Path(__file__).resolve().parents[2] / "docs" / "strategy-lab" / "fixtures").glob("*.json"))
LOADED = {f.stem: json.loads(f.read_text(encoding="utf-8")) for f in FIXTURES}


def codes(report, severity):
    return sorted({i["code"] for i in report["items"] if i["severity"] == severity})


def test_twelve_labelled_fixtures():
    assert len(LOADED) == 12
    assert all(f["teachingFixture"] and "Not a recommended strategy" in f["note"] for f in LOADED.values())


def test_committed_schema_is_current():
    assert json.loads(SCHEMA_PATH.read_text(encoding="utf-8")) == build(), "run `manage.py rulebook_schema`"


@pytest.mark.parametrize("name", LOADED)
def test_fixture_matches_schema(name):
    assert schema_errors(LOADED[name]["version"]) == []


@pytest.mark.parametrize("name", LOADED)
def test_fixture_clarity_and_fit(name):
    f = LOADED[name]
    report = check(f["name"], f["version"], f["examples"])
    assert codes(report, "fail") == f["expected"]["fails"]
    assert codes(report, "warn") == f["expected"]["warns"]
    assert report["kind"] == f["expected"]["kind"]
    assert report["passed"] is f["expected"]["passed"]
    assert sorted(x["code"] for x in profile_fit(f["version"]["rules"], f["profile"])) == f["expected"]["fit"]


def test_every_item_says_where_to_fix_it():
    for f in LOADED.values():
        for item in check(f["name"], f["version"], f["examples"])["items"]:
            assert item["path"] and item["message"] and item["fix"] in {
                "name", "market", "setup", "entry", "stop", "exit", "risk", "costs", "no_trade", "examples"}


def test_new_draft_is_valid_structure_and_lists_what_is_missing():
    draft = new_draft()
    assert schema_errors(draft) == []
    fails = codes(check("", draft, []), "fail")
    for code in ("NAME_MISSING", "MARKET_NO_INSTRUMENT", "MARKET_NO_TIMEFRAME", "MARKET_NO_SESSION", "SETUP_EMPTY",
                 "ENTRY_MISSING", "STOP_MISSING", "EXIT_MISSING"):
        assert code in fails


def test_schema_rejects_unknown_keys_and_types():
    doc = copy.deepcopy(LOADED["01-trend-pullback-ema"]["version"])
    doc["rules"]["market"]["leverage"] = 500
    doc["rules"]["setup"]["conditions"][0]["type"] = "order_block"
    doc["risk_plan"]["risk_pct"] = "lots"
    errors = " ".join(schema_errors(doc))
    assert "leverage" in errors and "conditions" in errors and "risk_pct" in errors


def test_examples_are_required_per_setup_rule():
    f = LOADED["01-trend-pullback-ema"]
    only_valid = [e for e in f["examples"] if e["valid"]]
    report = check(f["name"], f["version"], only_valid)
    assert codes(report, "fail") == ["EXAMPLES_INVALID_MISSING"]
    assert sum(i["code"] == "EXAMPLES_INVALID_MISSING" for i in report["items"]) == 4


def test_kept_free_text_needs_a_reason_and_no_vague_words():
    f = copy.deepcopy(LOADED["08-pin-bar-discretionary"])
    f["version"]["rules"]["setup"]["conditions"][1]["params"]["override"] = {"reason": "short"}
    assert "FREE_TEXT_UNRESOLVED" in codes(check(f["name"], f["version"], f["examples"]), "fail")
    f["version"]["rules"]["setup"]["conditions"][1]["params"]["text"] = "Price shows a strong close above the London opening price."
    f["version"]["rules"]["setup"]["conditions"][1]["params"]["override"] = {"reason": "I keep this one by hand."}
    report = check(f["name"], f["version"], f["examples"])
    assert codes(report, "fail") == ["FREE_TEXT_VAGUE"]  # an override can't keep vague words
    assert report["kind"] == "discretionary"


@pytest.mark.parametrize(
    ("text", "words"),
    [
        ("A strong candle near a key level", ["strong", "near", "key level"]),
        ("It closes above the prior day high on a major pair", []),
        ("Price is close to the 20 EMA", ["close to"]),
        ("STRONG and Clearly obvious", ["strong", "clearly", "obvious"]),
        ("Wait for confirmation, usually", ["confirmation", "usually"]),
        ("The candle's body is about 10 pips", ["about"]),
        ("Strongest", []),  # whole words only
    ],
)
def test_banned_word_matching(text, words):
    assert [h["word"] for h in find_vague(text)] == words


def test_conflicts_beyond_the_fixture():
    base = copy.deepcopy(LOADED["03-range-rsi"])
    conds = base["version"]["rules"]["setup"]["conditions"]

    def with_conds(extra):
        f = copy.deepcopy(base)
        f["version"]["rules"]["setup"]["conditions"] = conds + extra
        ids = [c["id"] for c in extra]
        f["examples"] += [{"rule_key": i, "valid": v} for i in ids for v in (True, False)]
        return codes(check(f["name"], f["version"], f["examples"]), "fail")

    tf = "H1"
    # RSI crosses above 30 already present: "below 25" contradicts it, "below 60" doesn't.
    assert with_conds([{"id": "c9", "type": "rsi", "timeframe": tf, "params": {"period": 14, "relation": "below", "value": 25}}]) == ["COND_CONFLICT"]
    assert with_conds([{"id": "c9", "type": "rsi", "timeframe": tf, "params": {"period": 14, "relation": "below", "value": 60}}]) == []
    # MACD histogram above zero means the line is above its signal line.
    assert with_conds([
        {"id": "c8", "type": "macd", "timeframe": tf, "params": {"fast": 12, "slow": 26, "signal": 9, "event": "histogram_above_zero"}},
        {"id": "c9", "type": "macd", "timeframe": tf, "params": {"fast": 12, "slow": 26, "signal": 9, "event": "line_below_signal"}},
    ]) == ["COND_CONFLICT"]
    # Same condition on different timeframes isn't a conflict; an identical one is a duplicate.
    assert with_conds([{"id": "c9", "type": "atr", "timeframe": tf, "params": {"period": 14, "relation": "below", "value": 12}}]) == ["COND_DUPLICATE"]


def test_ranges_and_cross_field_rules():
    f = copy.deepcopy(LOADED["01-trend-pullback-ema"])
    rules = f["version"]["rules"]
    rules["setup"]["conditions"][1]["params"].update(fast=60, slow=50)
    rules["setup"]["conditions"][3]["params"]["value"] = 120
    rules["exit"]["partial"]["at_r"] = 2
    f["version"]["risk_plan"]["weekly_loss_r"] = 2
    fails = codes(check(f["name"], f["version"], f["examples"]), "fail")
    assert fails == ["COND_PARAM_RANGE", "EXIT_ORDER", "RISK_LIMITS_ORDER"]


def test_entry_cannot_sit_above_a_condition_timeframe():
    f = copy.deepcopy(LOADED["01-trend-pullback-ema"])
    f["version"]["rules"]["entry"]["timeframe"] = "H4"
    assert codes(check(f["name"], f["version"], f["examples"]), "fail") == ["ENTRY_TIMEFRAME"]


def test_profile_fit_sessions_and_local_night():
    rules = copy.deepcopy(LOADED["02-prior-day-breakout"]["version"]["rules"])
    fit = profile_fit(rules, {"weekly_hours": 10, "sessions": ["asia"], "timezone": "Asia/Tokyo"})
    assert {x["code"] for x in fit} == {"FIT_SESSIONS"}
    rules["setup"]["conditions"][1]["params"].update({"from": "07:00", "to": "09:00"})
    fit = profile_fit(rules, {"weekly_hours": 10, "sessions": ["london"], "timezone": "America/Los_Angeles"})
    assert [x["code"] for x in fit] == ["FIT_WINDOW_LOCAL"]
    assert profile_fit(rules, {"weekly_hours": None, "sessions": [], "timezone": "UTC"})[0]["code"] == "FIT_NO_PROFILE"


def test_engine_is_deterministic():
    f = LOADED["07-macd-momentum"]
    assert check(f["name"], f["version"], f["examples"]) == check(f["name"], copy.deepcopy(f["version"]), list(f["examples"]))
