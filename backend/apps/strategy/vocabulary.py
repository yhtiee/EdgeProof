"""
The rulebook vocabulary (docs/strategy-lab/rulebook-builder.md §2): every
building block, its parameters and their allowed ranges, plus the options for
entry, stop, exit, risk and costs. The clarity engine, the JSON Schema and the
defaults for a new draft all read from here. The frontend mirrors this file in
src/features/strategy-lab/vocabulary.ts; shared fixtures keep them in step.
"""

SCHEMA_VERSION = 1

TIMEFRAMES = ["M5", "M15", "M30", "H1", "H4", "D1", "W1"]  # lowest to highest
TF_RANK = {tf: i for i, tf in enumerate(TIMEFRAMES)}
SESSIONS = ["asia", "london", "new_york"]
ZONES = ["Europe/London", "America/New_York", "Asia/Tokyo", "UTC"]
WEEKDAYS = ["mon", "tue", "wed", "thu", "fri"]
DIRECTIONS = ["long", "short", "both"]
MAJORS = {"EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "AUD/USD", "USD/CAD", "NZD/USD"}

# Session hours in UTC, as in onboarding (apps.accounts.services.SESSIONS).
SESSION_HOURS = {"asia": (0, 9), "london": (7, 16), "new_york": (12, 21)}
# Fixed offsets (winter, summer) so the engine never reads a clock.
ZONE_OFFSETS = {"Europe/London": (0, 1), "America/New_York": (-5, -4), "Asia/Tokyo": (9, 9), "UTC": (0, 0)}

# Parameter specs: ("enum", [...]) · ("int", lo, hi) · ("num", lo, hi) · ("distance",) · ("time",) · ("days",) · ("text", lo, hi)
MA = ("enum", ["sma", "ema"])
DISTANCE_LIMITS = {"pips": (0, 500), "atr": (0, 10)}

CONDITIONS = {
    "price_vs_ma": {"ma": MA, "period": ("int", 2, 400), "relation": ("enum", ["above", "below"])},
    "ma_cross": {
        "ma": MA, "fast": ("int", 2, 200), "slow": ("int", 3, 400),
        "direction": ("enum", ["bullish", "bearish"]), "within_bars": ("int", 1, 20),
    },
    "ma_order": {"ma": MA, "fast": ("int", 2, 200), "slow": ("int", 3, 400), "relation": ("enum", ["above", "below"])},
    "structure": {
        "pattern": ("enum", ["higher_highs_lows", "lower_highs_lows", "break_up", "break_down"]),
        "strength": ("int", 2, 10),
    },
    "level": {
        "level": ("enum", ["prior_day_high", "prior_day_low", "prior_week_high", "prior_week_low", "swing_high", "swing_low", "round_number"]),
        "event": ("enum", ["within", "closes_above", "closes_below"]),
        "tolerance": ("distance",),  # required for `within`
        "strength": ("int", 2, 10),  # required for swing levels
    },
    "candle_pattern": {
        "pattern": ("enum", ["bullish_engulfing", "bearish_engulfing", "bullish_pin_bar", "bearish_pin_bar", "inside_bar"]),
        "ratio": ("num", 1.0, 2.0),  # engulfing
        "wick_ratio": ("num", 2.0, 5.0),  # pin bar
        "min_range_atr": ("num", 0.3, 2.0),  # pin bar
    },
    "rsi": {"period": ("int", 2, 50), "relation": ("enum", ["above", "below", "crosses_above", "crosses_below"]), "value": ("num", 1, 99)},
    "macd": {
        "fast": ("int", 2, 50), "slow": ("int", 3, 100), "signal": ("int", 2, 50),
        "event": ("enum", ["line_above_signal", "line_below_signal", "crosses_above_signal", "crosses_below_signal",
                           "histogram_above_zero", "histogram_below_zero"]),
    },
    "atr": {"period": ("int", 2, 50), "relation": ("enum", ["above", "below"]), "value": ("num", 0.1, 1000)},
    "distance": {
        "to": ("enum", ["ma", "prior_day_high", "prior_day_low"]), "ma": MA, "period": ("int", 2, 400),
        "relation": ("enum", ["within", "beyond"]), "unit": ("enum", ["pips", "atr"]), "value": ("num", 0.1, 1000),
    },
    "time_window": {"from": ("time",), "to": ("time",), "zone": ("enum", ZONES), "days": ("days",)},
    "candle_size": {
        "measure": ("enum", ["range", "body"]), "relation": ("enum", ["above", "below"]),
        "unit": ("enum", ["pips", "atr"]), "value": ("num", 0.1, 1000),
    },
    "free_text": {"text": ("text", 15, 280)},
}

# Parameters that are only required in some cases (checked in clarity.py).
OPTIONAL_PARAMS = {
    "level": {"tolerance", "strength"},
    "candle_pattern": {"ratio", "wick_ratio", "min_range_atr"},
    "distance": {"ma", "period"},
}
NO_TRADE_OTHER_TYPES = {"time_window", "free_text"}

ENTRY_TRIGGERS = {
    "next_open": {},
    "stop_beyond_setup": {"buffer": ("distance",), "expiry_bars": ("int", 1, 10)},
    "limit_at_ma": {"ma": MA, "period": ("int", 2, 400), "expiry_bars": ("int", 1, 10)},
    "limit_retrace": {"percent": ("num", 25, 75), "expiry_bars": ("int", 1, 10)},
}
STOP_RULES = {
    "swing": {"strength": ("int", 2, 10), "buffer": ("distance",)},
    "setup_candle": {"buffer": ("distance",)},
    "atr": {"period": ("int", 2, 50), "multiple": ("num", 0.5, 5)},
    "fixed": {"pips": ("num", 3, 500)},
}
TARGETS = {
    "r_multiple": {"r": ("num", 0.5, 10)},
    "prior_swing": {"strength": ("int", 2, 10)},
    "prior_day_level": {},
    "atr": {"period": ("int", 2, 50), "multiple": ("num", 0.5, 10)},
    "none": {},
}
TRAILING = {
    "atr": {"period": ("int", 2, 50), "multiple": ("num", 0.5, 10)},
    "swing": {"strength": ("int", 2, 10)},
    "ma": {"ma": MA, "period": ("int", 2, 400)},
}
TIME_EXITS = {"bars": {"bars": ("int", 1, 500)}, "time": {"at": ("time",), "zone": ("enum", ZONES)}, "before_weekend": {}}
BREAKEVEN = {"at_r": ("num", 0.5, 5)}
PARTIAL = {"at_r": ("num", 0.5, 5), "percent": ("num", 10, 90)}

RISK = {
    "risk_pct": ("num", 0.1, 2),
    "daily_loss_r": ("num", 1, 10),
    "weekly_loss_r": ("num", 1, 20),
    "max_drawdown_r": ("num", 5, 50),
    "max_open_trades": ("int", 1, 10),
    "max_trades_per_day": ("int", 1, 20),
    "max_currency_risk_pct": ("num", 0.5, 5),
}
STREAK_ACTIONS = ["stop_day", "halve_risk", "stop_review"]
COSTS = {
    "spread_pips": ("num", 0, 50),
    "commission_per_lot": ("num", 0, 50),
    "slippage_pips": ("num", 0, 20),
    "news_slippage_pips": ("num", 0, 50),
    "swap_long": ("num", -1000, 1000),
    "swap_short": ("num", -1000, 1000),
}

DEFAULT_RISK = {
    "risk_pct": 0.5, "daily_loss_r": 3, "weekly_loss_r": 6, "max_drawdown_r": 15, "max_open_trades": 2,
    "max_trades_per_day": 3, "max_currency_risk_pct": 2, "losing_streak": {"losses": 3, "action": "stop_day"},
}
DEFAULT_NO_TRADE = {
    "news": {"enabled": True, "before_min": 30, "after_min": 30},
    "avoid_rollover": True,
    "no_new_after_friday": "15:00",
    "other": [],
}


def default_costs(pair: str) -> dict:
    """Round placeholders the trader replaces with their broker's figures (open question 3: kept with a warning)."""
    major = pair in MAJORS
    return {
        "spread_pips": 1.0 if major else 2.0, "commission_per_lot": 0.0, "slippage_pips": 0.3 if major else 1.0,
        "news_slippage_pips": 3.0, "swap_long": 0.0, "swap_short": 0.0, "placeholder": True,
    }


def new_draft() -> dict:
    """The document a new strategy starts from: valid structure, nothing chosen yet."""
    return {
        "rules": {
            "schemaVersion": SCHEMA_VERSION,
            "idea": "",
            "direction": "long",
            "market": {"instruments": [], "timeframes": [], "sessions": []},
            "setup": {"conditions": []},
            "entry": None,
            "stop": None,
            "exit": None,
            "no_trade": {**DEFAULT_NO_TRADE, "news": dict(DEFAULT_NO_TRADE["news"]), "other": []},
        },
        "risk_plan": {**DEFAULT_RISK, "losing_streak": dict(DEFAULT_RISK["losing_streak"])},
        "cost_model": {},
    }
