"""
The rulebook JSON Schema (rulebook-builder.md §3.2), generated from the
vocabulary so the two can't drift. The committed copy lives in
schema/rulebook.v1.json (regenerate with `manage.py rulebook_schema`; a test
checks it's current). The schema checks structure and types and lets drafts
be incomplete; missing values and ranges are the clarity engine's job.
"""

import json
from functools import cache
from pathlib import Path

from jsonschema import Draft202012Validator
from rest_framework.exceptions import ValidationError

from .vocabulary import (
    BREAKEVEN,
    CONDITIONS,
    COSTS,
    DIRECTIONS,
    ENTRY_TRIGGERS,
    PARTIAL,
    RISK,
    SCHEMA_VERSION,
    SESSIONS,
    STOP_RULES,
    STREAK_ACTIONS,
    TARGETS,
    TIME_EXITS,
    TIMEFRAMES,
    TRAILING,
    WEEKDAYS,
)

SCHEMA_PATH = Path(__file__).parent / "schema" / f"rulebook.v{SCHEMA_VERSION}.json"
NULL = {"type": "null"}


def _spec(spec) -> dict:
    kind = spec[0]
    if kind == "enum":
        out = {"enum": list(spec[1])}
    elif kind == "int":
        out = {"type": "integer"}
    elif kind == "num":
        out = {"type": "number"}
    elif kind == "distance":
        out = {"$ref": "#/$defs/distance"}
    elif kind == "time":
        out = {"type": "string", "pattern": r"^\d{2}:\d{2}$"}
    elif kind == "days":
        out = {"type": "array", "items": {"enum": WEEKDAYS}, "uniqueItems": True}
    else:
        out = {"type": "string", "maxLength": 1000}
    return {"anyOf": [out, NULL]}


def _object(specs: dict, extra: dict | None = None, required=()) -> dict:
    props = {k: _spec(v) for k, v in specs.items()}
    props.update(extra or {})
    return {"type": "object", "properties": props, "required": list(required), "additionalProperties": False}


def _typed(table: dict) -> dict:
    """A discriminated union: {"type": key, ...params}."""
    return {"oneOf": [_object(specs, {"type": {"const": key}}, required=["type"]) for key, specs in table.items()]}


def build() -> dict:
    condition_variants = []
    for ctype, specs in CONDITIONS.items():
        params = _object(specs)
        if ctype == "free_text":
            params["properties"]["override"] = {
                "anyOf": [_object({}, {"reason": {"type": "string", "maxLength": 280}, "recorded_at": {"type": "string"}}), NULL]
            }
        condition_variants.append({
            "type": "object",
            "properties": {
                "id": {"type": "string", "pattern": r"^[a-z0-9]{1,16}$"},
                "type": {"const": ctype},
                "timeframe": {"anyOf": [{"enum": TIMEFRAMES}, NULL]},
                "params": params,
            },
            "required": ["id", "type", "params"],
            "additionalProperties": False,
        })
    nullable = lambda schema: {"anyOf": [schema, NULL]}
    rules = {
        "type": "object",
        "properties": {
            "schemaVersion": {"const": SCHEMA_VERSION},
            "idea": {"type": "string", "maxLength": 280},
            "direction": {"enum": DIRECTIONS},
            "market": {
                "type": "object",
                "properties": {
                    "instruments": {"type": "array", "items": {"type": "string", "pattern": r"^[A-Z]{3}/[A-Z]{3}$"}, "maxItems": 12, "uniqueItems": True},
                    "timeframes": {"type": "array", "items": {"enum": TIMEFRAMES}, "maxItems": 7, "uniqueItems": True},
                    "sessions": {"type": "array", "items": {"enum": SESSIONS}, "uniqueItems": True},
                },
                "required": ["instruments", "timeframes", "sessions"],
                "additionalProperties": False,
            },
            "setup": {
                "type": "object",
                "properties": {"conditions": {"type": "array", "items": {"$ref": "#/$defs/condition"}, "maxItems": 12}},
                "required": ["conditions"],
                "additionalProperties": False,
            },
            "entry": nullable({
                "type": "object",
                "properties": {"timeframe": {"anyOf": [{"enum": TIMEFRAMES}, NULL]}, "trigger": _typed(ENTRY_TRIGGERS)},
                "required": ["trigger"],
                "additionalProperties": False,
            }),
            "stop": nullable({
                "type": "object",
                "properties": {"rule": _typed(STOP_RULES), "skip_if_wider_than": nullable({"$ref": "#/$defs/distance"})},
                "required": ["rule"],
                "additionalProperties": False,
            }),
            "exit": nullable({
                "type": "object",
                "properties": {
                    "target": _typed(TARGETS),
                    "breakeven": nullable(_object(BREAKEVEN)),
                    "partial": nullable(_object(PARTIAL)),
                    "trailing": nullable(_typed(TRAILING)),
                    "time_exit": nullable(_typed(TIME_EXITS)),
                },
                "required": ["target"],
                "additionalProperties": False,
            }),
            "no_trade": {
                "type": "object",
                "properties": {
                    "news": {
                        "type": "object",
                        "properties": {"enabled": {"type": "boolean"}, "before_min": _spec(("int", 0, 240)), "after_min": _spec(("int", 0, 240))},
                        "required": ["enabled"],
                        "additionalProperties": False,
                    },
                    "max_spread_pips": _spec(("num", 0, 50)),
                    "avoid_rollover": {"type": "boolean"},
                    "no_new_after_friday": _spec(("time",)),
                    "other": {"type": "array", "items": {"$ref": "#/$defs/condition"}, "maxItems": 6},
                },
                "required": ["news", "avoid_rollover", "other"],
                "additionalProperties": False,
            },
        },
        "required": ["schemaVersion", "idea", "direction", "market", "setup", "entry", "stop", "exit", "no_trade"],
        "additionalProperties": False,
    }
    risk_plan = _object(
        RISK,
        {"losing_streak": {
            "type": "object",
            "properties": {"losses": _spec(("int", 2, 10)), "action": {"anyOf": [{"enum": STREAK_ACTIONS}, NULL]}},
            "additionalProperties": False,
        }},
    )
    cost_row = _object(COSTS, {"placeholder": {"type": "boolean"}})
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": f"https://edgeproof.app/schemas/rulebook.v{SCHEMA_VERSION}.json",
        "title": "EdgeProof rulebook version",
        "description": "One strategy version: rules, risk plan and cost model. Structure only; the clarity engine checks completeness and ranges.",
        "type": "object",
        "properties": {
            "rules": rules,
            "risk_plan": risk_plan,
            "cost_model": {"type": "object", "propertyNames": {"pattern": r"^[A-Z]{3}/[A-Z]{3}$"}, "additionalProperties": cost_row},
        },
        "required": ["rules", "risk_plan", "cost_model"],
        "additionalProperties": False,
        "$defs": {
            "distance": {
                "type": "object",
                "properties": {"unit": {"enum": ["pips", "atr"]}, "value": {"type": "number"}},
                "required": ["unit", "value"],
                "additionalProperties": False,
            },
            "condition": {"oneOf": condition_variants},
        },
    }


@cache
def _validator() -> Draft202012Validator:
    return Draft202012Validator(json.loads(SCHEMA_PATH.read_text(encoding="utf-8")))


def schema_errors(document: dict) -> list[str]:
    """Readable problems with a version document, at most ten."""
    errors = sorted(_validator().iter_errors(document), key=lambda e: list(e.path))
    return [f"{'.'.join(str(p) for p in e.path) or '(document)'}: {e.message}" for e in errors[:10]]


def validate_document(document: dict) -> None:
    problems = schema_errors(document)
    if problems:
        raise ValidationError({"document": problems})


def write_schema() -> Path:
    SCHEMA_PATH.parent.mkdir(exist_ok=True)
    SCHEMA_PATH.write_text(json.dumps(build(), indent=2) + "\n", encoding="utf-8")
    _validator.cache_clear()
    return SCHEMA_PATH
