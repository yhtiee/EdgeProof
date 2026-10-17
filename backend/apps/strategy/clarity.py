"""
Clarity engine (SL-3, SL-4): one pure, deterministic function over a version
document and its examples. No clock, network or randomness. This copy is the
source of truth for Gate 3; src/features/strategy-lab/clarity.ts mirrors it
for instant feedback, and both are tested against docs/strategy-lab/fixtures.

check(name, version, examples) -> {
    "passed": bool, "kind": "mechanical" | "discretionary",
    "items": [{"code", "severity": "fail" | "warn", "path", "message", "fix"}]
}
`fix` is the builder step that holds the field.
"""

import re

from .banned import find_vague
from .vocabulary import (
    BREAKEVEN,
    CONDITIONS,
    COSTS,
    DISTANCE_LIMITS,
    ENTRY_TRIGGERS,
    NO_TRADE_OTHER_TYPES,
    OPTIONAL_PARAMS,
    PARTIAL,
    RISK,
    SESSION_HOURS,
    STOP_RULES,
    STREAK_ACTIONS,
    TARGETS,
    TF_RANK,
    TIME_EXITS,
    TRAILING,
    WEEKDAYS,
    ZONE_OFFSETS,
)

TIME = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
PAIR = re.compile(r"^[A-Z]{3}/[A-Z]{3}$")
LABEL = {
    "period": "period", "fast": "fast average", "slow": "slow average", "within_bars": "number of candles",
    "strength": "swing strength", "tolerance": "tolerance", "value": "value", "ratio": "body ratio",
    "wick_ratio": "wick ratio", "min_range_atr": "minimum range", "signal": "signal period", "from": "start time",
    "to": "end time", "days": "days", "buffer": "buffer", "expiry_bars": "expiry", "percent": "percentage",
    "multiple": "ATR multiple", "pips": "stop distance", "r": "target", "at_r": "trigger level", "bars": "number of candles",
    "at": "time",
}


def _label(key: str) -> str:
    return LABEL.get(key, key.replace("_", " "))


def _num(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def _fmt(n) -> str:
    return f"{n:g}" if _num(n) else str(n)


class _Report:
    def __init__(self):
        self.items: list[dict] = []

    def fail(self, code, path, message, fix):
        self.items.append({"code": code, "severity": "fail", "path": path, "message": message, "fix": fix})

    def warn(self, code, path, message, fix):
        self.items.append({"code": code, "severity": "warn", "path": path, "message": message, "fix": fix})


def _check_param(spec, value, required=True):
    """None when fine, else ('missing' | 'range', detail)."""
    if value is None or value == "" or value == []:
        return ("missing", None) if required else None
    kind = spec[0]
    if kind == "enum":
        return None if value in spec[1] else ("range", None)
    if kind in ("int", "num"):
        if not _num(value) or (kind == "int" and int(value) != value):
            return ("range", None)
        return None if spec[1] <= value <= spec[2] else ("range", (spec[1], spec[2]))
    if kind == "distance":
        if not isinstance(value, dict) or value.get("unit") not in DISTANCE_LIMITS or not _num(value.get("value")):
            return ("missing", None)
        lo, hi = DISTANCE_LIMITS[value["unit"]]
        return None if lo <= value["value"] <= hi else ("range", (lo, hi))
    if kind == "time":
        return None if isinstance(value, str) and TIME.match(value) else ("range", None)
    if kind == "days":
        return None if isinstance(value, list) and value and set(value) <= set(WEEKDAYS) else ("missing", None)
    if kind == "text":
        return None if isinstance(value, str) else ("missing", None)
    return None


def _check_params(report, specs, params, path, fix, missing_code, range_code, optional=()):
    params = params if isinstance(params, dict) else {}
    for key, spec in specs.items():
        problem = _check_param(spec, params.get(key), required=key not in optional)
        if not problem:
            continue
        what, limits = problem
        p = f"{path}.{key}"
        if what == "missing":
            report.fail(missing_code, p, f"This rule is missing its {_label(key)}.", fix)
        elif limits:
            report.fail(range_code, p, f"The {_label(key)} is {_fmt(_val(params.get(key)))}; the allowed range is {_fmt(limits[0])}–{_fmt(limits[1])}.", fix)
        else:
            report.fail(range_code, p, f"The {_label(key)} isn't one of the allowed options.", fix)


def _val(v):
    return v.get("value") if isinstance(v, dict) else v


def _minutes(t: str) -> int:
    h, m = t.split(":")
    return int(h) * 60 + int(m)


# --- Conditions ------------------------------------------------------------------


def _condition(report, cond, path, market_tfs, fix):
    """Structural checks shared by setup conditions and no-trade 'other' rules."""
    ctype = cond.get("type")
    if ctype not in CONDITIONS:
        report.fail("COND_PARAM_MISSING", f"{path}.type", "This condition has no type.", fix)
        return
    tf = cond.get("timeframe")
    if ctype != "free_text" and tf not in market_tfs:
        report.fail("COND_TIMEFRAME_UNKNOWN", f"{path}.timeframe", f"This condition uses {tf or 'no timeframe'}, which isn't one of your timeframes.", fix)
    params = cond.get("params") or {}
    if ctype == "free_text":
        _free_text(report, params, path, fix)
        return
    _check_params(report, CONDITIONS[ctype], params, f"{path}.params", fix, "COND_PARAM_MISSING", "COND_PARAM_RANGE",
                  optional=OPTIONAL_PARAMS.get(ctype, set()))
    p = f"{path}.params"
    if ctype in ("ma_cross", "ma_order") and _num(params.get("fast")) and _num(params.get("slow")) and params["slow"] <= params["fast"]:
        report.fail("COND_PARAM_RANGE", f"{p}.slow", "The slow average needs a longer period than the fast one.", fix)
    if ctype == "macd" and _num(params.get("fast")) and _num(params.get("slow")) and params["slow"] <= params["fast"]:
        report.fail("COND_PARAM_RANGE", f"{p}.slow", "MACD's slow period needs to be longer than its fast period.", fix)
    if ctype == "level":
        if params.get("event") == "within" and _check_param(("distance",), params.get("tolerance")):
            report.fail("COND_PARAM_MISSING", f"{p}.tolerance", "A 'within' level needs a tolerance in pips or ATR.", fix)
        if params.get("level") in ("swing_high", "swing_low") and _check_param(("int", 2, 10), params.get("strength")):
            report.fail("COND_PARAM_MISSING", f"{p}.strength", "A swing level needs its swing strength (2–10 candles each side).", fix)
    if ctype == "candle_pattern":
        pattern = params.get("pattern", "")
        if "engulfing" in pattern and _check_param(CONDITIONS[ctype]["ratio"], params.get("ratio")):
            report.fail("COND_PARAM_MISSING", f"{p}.ratio", "An engulfing pattern needs its body ratio (1.0–2.0).", fix)
        if "pin_bar" in pattern:
            for key in ("wick_ratio", "min_range_atr"):
                if _check_param(CONDITIONS[ctype][key], params.get(key)):
                    report.fail("COND_PARAM_MISSING", f"{p}.{key}", f"A pin bar needs its {_label(key)}.", fix)
    if ctype == "distance" and params.get("to") == "ma":
        for key in ("ma", "period"):
            if _check_param(CONDITIONS["distance"][key], params.get(key)):
                report.fail("COND_PARAM_MISSING", f"{p}.{key}", f"Distance to an average needs its {_label(key)}.", fix)
    if ctype == "time_window" and params.get("from") and params.get("from") == params.get("to"):
        report.fail("COND_PARAM_RANGE", f"{p}.to", "The window starts and ends at the same time.", fix)


def _free_text(report, params, path, fix):
    text = (params.get("text") or "").strip()
    p = f"{path}.params.text"
    if not 15 <= len(text) <= 280:
        report.fail("FREE_TEXT_TOO_SHORT", p, f"This rule is {'too short' if len(text) < 15 else 'too long'} to follow: {len(text)} characters (15–280).", fix)
    for hit in find_vague(text):
        report.fail("FREE_TEXT_VAGUE", p, f"Your rule uses '{hit['word']}'. {hit['question']}", fix)
    override = params.get("override") or {}
    if len((override.get("reason") or "").strip()) < 10:
        report.fail(
            "FREE_TEXT_UNRESOLVED", f"{path}.params",
            "This rule is written in your own words and has no override recorded. It can become a building block, or be kept as written with a reason.",
            fix,
        )


def _key(cond):
    return (cond.get("type"), cond.get("timeframe"), repr(sorted((cond.get("params") or {}).items())))


def _conflicts(conds):
    """Pairs of condition indexes that can't both be true on the same closed candle."""
    out = []
    for i in range(len(conds)):
        for j in range(i + 1, len(conds)):
            a, b = conds[i], conds[j]
            if a.get("timeframe") != b.get("timeframe") or not _conflict(a, b):
                continue
            out.append((i, j))
    return out


def _bounds(cond):
    """(lower, upper) on the indicator value implied by a threshold condition."""
    p = cond.get("params") or {}
    rel, v = p.get("relation"), p.get("value")
    if not _num(v):
        return None, None
    if rel in ("above", "crosses_above"):
        return v, None
    if rel in ("below", "crosses_below"):
        return None, v
    return None, None


MACD_UP = {"line_above_signal", "crosses_above_signal", "histogram_above_zero"}
MACD_DOWN = {"line_below_signal", "crosses_below_signal", "histogram_below_zero"}
BULLISH = {"bullish_engulfing", "bullish_pin_bar"}
BEARISH = {"bearish_engulfing", "bearish_pin_bar"}


def _conflict(a, b) -> bool:
    ta, tb = a.get("type"), b.get("type")
    pa, pb = a.get("params") or {}, b.get("params") or {}
    if ta != tb:
        return False
    t = ta
    same = lambda *keys: all(pa.get(k) == pb.get(k) for k in keys)
    if t == "price_vs_ma":
        return same("ma", "period") and pa.get("relation") != pb.get("relation")
    if t == "ma_order":
        if pa.get("ma") != pb.get("ma"):
            return False
        def norm(p):
            f, s, r = p.get("fast"), p.get("slow"), p.get("relation")
            return (f, s, r) if (f or 0) <= (s or 0) else (s, f, "below" if r == "above" else "above")
        na, nb = norm(pa), norm(pb)
        return na[:2] == nb[:2] and na[2] != nb[2]
    if t in ("rsi", "atr") and not same("period"):
        return False
    if t == "candle_size" and not same("measure", "unit"):
        return False
    if t in ("rsi", "atr", "candle_size"):
        lo = [x for x in (_bounds(a)[0], _bounds(b)[0]) if x is not None]
        hi = [x for x in (_bounds(a)[1], _bounds(b)[1]) if x is not None]
        return bool(lo and hi and max(lo) >= min(hi))
    if t == "structure":
        pair = {pa.get("pattern"), pb.get("pattern")}
        return pair in ({"higher_highs_lows", "lower_highs_lows"}, {"break_up", "break_down"})
    if t == "candle_pattern":
        x, y = pa.get("pattern"), pb.get("pattern")
        return (x in BULLISH and y in BEARISH) or (x in BEARISH and y in BULLISH)
    if t == "macd":
        if not same("fast", "slow", "signal"):
            return False
        x, y = pa.get("event"), pb.get("event")
        return (x in MACD_UP and y in MACD_DOWN) or (x in MACD_DOWN and y in MACD_UP)
    if t == "level":
        return same("level") and {pa.get("event"), pb.get("event")} == {"closes_above", "closes_below"}
    if t == "distance":
        if not same("to", "ma", "period", "unit"):
            return False
        within = [p.get("value") for p in (pa, pb) if p.get("relation") == "within" and _num(p.get("value"))]
        beyond = [p.get("value") for p in (pa, pb) if p.get("relation") == "beyond" and _num(p.get("value"))]
        return bool(within and beyond and max(beyond) >= min(within))
    return False


def _window_overlaps_sessions(params, sessions) -> bool:
    try:
        start, end = _minutes(params["from"]), _minutes(params["to"])
    except (KeyError, ValueError, AttributeError):
        return True
    offsets = ZONE_OFFSETS.get(params.get("zone"), (0, 0))
    for off in set(offsets):
        s, e = (start - off * 60) % 1440, (end - off * 60) % 1440
        window = [(s, e)] if s < e else [(s, 1440), (0, e)]
        for name in sessions:
            hs, he = SESSION_HOURS.get(name, (0, 0))
            if any(ws < he * 60 and hs * 60 < we for ws, we in window):
                return True
    return False


# --- The engine -------------------------------------------------------------------


def check(name: str, version: dict, examples: list[dict]) -> dict:
    report = _Report()
    rules = version.get("rules") or {}
    risk = version.get("risk_plan") or {}
    costs = version.get("cost_model") or {}

    if not 3 <= len((name or "").strip()) <= 60:
        report.fail("NAME_MISSING", "name", "This strategy has no name yet.", "name")

    # Market
    market = rules.get("market") or {}
    instruments = [p for p in market.get("instruments") or [] if isinstance(p, str)]
    tfs = market.get("timeframes") or []
    if not 1 <= len(instruments) <= 6 or any(not PAIR.match(p) for p in instruments):
        report.fail("MARKET_NO_INSTRUMENT", "market.instruments", "No pairs chosen." if not instruments else "Choose up to six pairs, like EUR/USD.", "market")
    if not 1 <= len(tfs) <= 3 or len(set(tfs)) != len(tfs) or any(tf not in TF_RANK for tf in tfs):
        report.fail("MARKET_NO_TIMEFRAME", "market.timeframes", "No timeframe chosen." if not tfs else "Choose one to three different timeframes.", "market")
    sessions = market.get("sessions") or []
    if not sessions:
        report.fail("MARKET_NO_SESSION", "market.sessions", "No trading session chosen.", "market")

    # Setup
    conds = (rules.get("setup") or {}).get("conditions") or []
    if not conds:
        report.fail("SETUP_EMPTY", "setup.conditions", "The setup has no conditions, so any candle would qualify.", "setup")
    for i, cond in enumerate(conds):
        _condition(report, cond, f"setup.conditions[{i}]", tfs, "setup")
    seen = {}
    for i, cond in enumerate(conds):
        k = _key(cond)
        if k in seen:
            report.fail("COND_DUPLICATE", f"setup.conditions[{i}]", f"Condition {i + 1} repeats condition {seen[k] + 1}.", "setup")
        else:
            seen[k] = i
    for i, j in _conflicts(conds):
        report.fail("COND_CONFLICT", f"setup.conditions[{j}]", f"Conditions {i + 1} and {j + 1} can't both be true on the same candle.", "setup")
    if len(conds) > 5:
        report.warn("W_MANY_CONDITIONS", "setup.conditions", f"The setup has {len(conds)} conditions. Each extra filter is another chance to fit past noise.", "setup")
    for i, cond in enumerate(conds):
        if cond.get("type") == "time_window" and sessions and not _window_overlaps_sessions(cond.get("params") or {}, sessions):
            p = cond.get("params") or {}
            report.warn("W_WINDOW_OUTSIDE_SESSION", f"setup.conditions[{i}]", f"The {p.get('from')}–{p.get('to')} window falls outside the sessions you chose.", "setup")

    # Entry
    entry = rules.get("entry")
    trigger = (entry or {}).get("trigger") or {}
    if not entry or trigger.get("type") not in ENTRY_TRIGGERS:
        report.fail("ENTRY_MISSING", "entry", "There's no entry rule yet.", "entry")
    else:
        etf = entry.get("timeframe")
        lower = [c.get("timeframe") for c in conds if c.get("type") != "free_text" and c.get("timeframe") in TF_RANK and etf in TF_RANK and TF_RANK[c["timeframe"]] < TF_RANK[etf]]
        if etf not in tfs:
            report.fail("ENTRY_TIMEFRAME", "entry.timeframe", f"The entry uses {etf or 'no timeframe'}, which isn't one of your timeframes.", "entry")
        elif lower:
            report.fail("ENTRY_TIMEFRAME", "entry.timeframe", f"The entry uses {etf}, but a condition uses a lower timeframe, {min(lower, key=TF_RANK.get)}.", "entry")
        _check_params(report, ENTRY_TRIGGERS[trigger["type"]], trigger, "entry.trigger", "entry", "ENTRY_PARAM", "ENTRY_PARAM")

    # Stop
    stop = rules.get("stop")
    rule = (stop or {}).get("rule") or {}
    if not stop or rule.get("type") not in STOP_RULES:
        report.fail("STOP_MISSING", "stop", "There's no initial stop. Every trade needs one before it opens.", "stop")
    else:
        _check_params(report, STOP_RULES[rule["type"]], rule, "stop.rule", "stop", "STOP_PARAM", "STOP_PARAM")
        if stop.get("skip_if_wider_than") is not None and _check_param(("distance",), stop["skip_if_wider_than"]):
            report.fail("STOP_PARAM", "stop.skip_if_wider_than", "The 'skip if wider than' distance needs pips or ATR.", "stop")
        buffer = rule.get("buffer")
        if rule["type"] in ("swing", "setup_candle") and isinstance(buffer, dict) and buffer.get("value") == 0:
            report.warn("W_STOP_NO_BUFFER", "stop.rule.buffer", "Your stop rule has no buffer, so the spread alone can reach it.", "stop")
        if rule["type"] == "fixed" and _num(rule.get("pips")):
            report.warn("W_STOP_FIXED", "stop.rule", f"A fixed {_fmt(rule['pips'])}-pip stop is the same in quiet and busy markets.", "stop")

    # Exit
    exit_ = rules.get("exit")
    target = (exit_ or {}).get("target") or {}
    if not exit_ or target.get("type") not in TARGETS or (target["type"] == "none" and not exit_.get("trailing") and not exit_.get("time_exit")):
        report.fail("EXIT_MISSING", "exit", "Nothing closes a winning trade: no target, trailing stop or time exit.", "exit")
    else:
        _check_params(report, TARGETS[target["type"]], target, "exit.target", "exit", "EXIT_PARAM", "EXIT_PARAM")
        for key, specs in (("breakeven", BREAKEVEN), ("partial", PARTIAL)):
            if exit_.get(key):
                _check_params(report, specs, exit_[key], f"exit.{key}", "exit", "EXIT_PARAM", "EXIT_PARAM")
        for key, table in (("trailing", TRAILING), ("time_exit", TIME_EXITS)):
            part = exit_.get(key)
            if part:
                if part.get("type") not in table:
                    report.fail("EXIT_PARAM", f"exit.{key}", f"The {key.replace('_', ' ')} has no type.", "exit")
                else:
                    _check_params(report, table[part["type"]], part, f"exit.{key}", "exit", "EXIT_PARAM", "EXIT_PARAM")
        if target["type"] == "r_multiple" and _num(target.get("r")):
            r = target["r"]
            for key in ("breakeven", "partial"):
                at = (exit_.get(key) or {}).get("at_r")
                if _num(at) and at >= r:
                    report.fail("EXIT_ORDER", f"exit.{key}.at_r", f"The {'breakeven move' if key == 'breakeven' else 'partial close'} at +{_fmt(at)}R comes at or after the +{_fmt(r)}R target.", "exit")
            if r < 1:
                report.warn("W_TARGET_BELOW_1R", "exit.target.r", f"The target is +{_fmt(r)}R; the break-even win rate before costs is {round(100 / (1 + r))}%.", "exit")

    # Risk
    for key, spec in RISK.items():
        problem = _check_param(spec, risk.get(key))
        if problem:
            limits = f"{_fmt(spec[1])}–{_fmt(spec[2])}"
            report.fail("RISK_INCOMPLETE", f"risk_plan.{key}", f"{_label(key).capitalize()} is missing or outside {limits}.", "risk")
    streak = risk.get("losing_streak") or {}
    if _check_param(("int", 2, 10), streak.get("losses")) or streak.get("action") not in STREAK_ACTIONS:
        report.fail("RISK_INCOMPLETE", "risk_plan.losing_streak", "The losing-streak rule needs a number of losses (2–10) and an action.", "risk")
    if _num(risk.get("daily_loss_r")) and _num(risk.get("weekly_loss_r")) and risk["weekly_loss_r"] < risk["daily_loss_r"]:
        report.fail("RISK_LIMITS_ORDER", "risk_plan.weekly_loss_r", f"The weekly loss limit ({_fmt(risk['weekly_loss_r'])}R) is lower than the daily one ({_fmt(risk['daily_loss_r'])}R).", "risk")
    if _num(risk.get("risk_pct")) and risk["risk_pct"] > 1:
        left = round(100 * (1 - risk["risk_pct"] / 100) ** 20)
        report.warn("W_RISK_ABOVE_1", "risk_plan.risk_pct", f"Each trade risks {_fmt(risk['risk_pct'])}%. Twenty losses in a row would leave about {left}% of the account.", "risk")
    if _num(risk.get("daily_loss_r")) and risk["daily_loss_r"] > 5:
        report.warn("W_DAILY_LIMIT_HIGH", "risk_plan.daily_loss_r", f"A {_fmt(risk['daily_loss_r'])}R daily limit allows a long losing run in one day.", "risk")
    if _num(risk.get("max_currency_risk_pct")) and risk["max_currency_risk_pct"] > 3:
        report.warn("W_CURRENCY_RISK_HIGH", "risk_plan.max_currency_risk_pct", f"Up to {_fmt(risk['max_currency_risk_pct'])}% can ride on one currency at once.", "risk")

    # Costs
    for pair in instruments:
        row = costs.get(pair)
        if not isinstance(row, dict) or any(_check_param(spec, row.get(k)) for k, spec in COSTS.items()):
            report.fail("COSTS_MISSING", f"cost_model.{pair}", f"{pair} has no costs set.", "costs")
            continue
        if row["spread_pips"] + row["slippage_pips"] <= 0:
            report.fail("COSTS_ZERO", f"cost_model.{pair}", f"{pair} has no spread or slippage, so tests would show results no account could get.", "costs")
        if row.get("placeholder"):
            report.warn("W_COSTS_PLACEHOLDER", f"cost_model.{pair}", f"{pair} still uses placeholder costs.", "costs")

    # No-trade rules
    no_trade = rules.get("no_trade") or {}
    news = no_trade.get("news") or {}
    if not news.get("enabled"):
        report.warn("W_NO_NEWS_RULE", "no_trade.news", "There's no news window, so trades can open into high-impact releases.", "no_trade")
    else:
        for key in ("before_min", "after_min"):
            if _check_param(("int", 0, 240), news.get(key)):
                report.fail("NOTRADE_PARAM", f"no_trade.news.{key}", "News windows are 0–240 minutes either side.", "no_trade")
    if no_trade.get("max_spread_pips") is not None and _check_param(("num", 0.1, 50), no_trade["max_spread_pips"]):
        report.fail("NOTRADE_PARAM", "no_trade.max_spread_pips", "The spread limit is 0.1–50 pips.", "no_trade")
    if no_trade.get("no_new_after_friday") and not TIME.match(str(no_trade["no_new_after_friday"])):
        report.fail("NOTRADE_PARAM", "no_trade.no_new_after_friday", "Use a time like 15:00.", "no_trade")
    for i, cond in enumerate(no_trade.get("other") or []):
        path = f"no_trade.other[{i}]"
        if cond.get("type") not in NO_TRADE_OTHER_TYPES:
            report.fail("NOTRADE_PARAM", path, "Other no-trade rules are a time window or a rule in your own words.", "no_trade")
            continue
        _condition(report, cond, path, tfs, "no_trade")

    # Examples (setup conditions only)
    for i, cond in enumerate(conds):
        cid = cond.get("id")
        mine = [e for e in examples if e.get("rule_key") == cid]
        label = f"Condition {i + 1}"
        if not any(e.get("valid") for e in mine):
            report.fail("EXAMPLES_VALID_MISSING", f"examples.{cid}", f"{label} has no example of a chart where it's true.", "examples")
        if not any(e.get("valid") is False for e in mine):
            report.fail("EXAMPLES_INVALID_MISSING", f"examples.{cid}", f"{label} has no example of a chart where it's false.", "examples")

    # Low timeframes
    if tfs and all(tf in TF_RANK for tf in tfs):
        low = min(tfs, key=TF_RANK.get)
        if low in ("M5", "M15"):
            report.warn("W_LOW_TF", "market.timeframes", f"On {low} charts, the spread is a bigger share of each stop.", "market")

    texts = [c for c in conds + list(no_trade.get("other") or []) if c.get("type") == "free_text"]
    kept = any(len(((c.get("params") or {}).get("override") or {}).get("reason", "").strip()) >= 10 for c in texts)
    return {
        "passed": not any(i["severity"] == "fail" for i in report.items),
        "kind": "discretionary" if kept else "mechanical",
        "items": report.items,
    }
