"""
Journal services (JR-3 to JR-6, JR-10).

R = net P&L in account currency ÷ initial risk in account currency (JR-4).
Money is computed from prices whenever the pair's quote currency is the account
currency (EUR/USD on a USD account), so edits never leave stale figures;
otherwise the trader enters the figures from their platform, because Phase 1 has no exchange-rate feed. Without
money figures, R falls back to the price move ÷ stop distance and is marked
as an estimate that excludes costs.
"""

import csv
import io
from datetime import UTC, datetime, time
from decimal import Decimal

from django.db import transaction
from rest_framework.exceptions import ValidationError

from .models import PracticeRule, Trade, TradingAccount

CONTRACT_SIZE = Decimal(100_000)  # units per standard lot
BREAKEVEN_R = 0.1  # |R| under this is a breakeven (spec §8)

DEFAULT_RULES = [
    "I placed my stop before entering",
    "I risked no more than my plan allows",
    "I traded in my planned session",
    "I stayed out of news windows",
    "This was my setup, not a feeling",
]

EMOTIONS = ["calm", "confident", "anxious", "frustrated", "excited", "bored", "tired", "fomo"]
SLEEP = ["good", "ok", "poor"]


def quote_currency(instrument: str) -> str:
    return instrument.replace("/", "")[-3:].upper()


def market_session(at: datetime) -> str:
    """Session from the open time in UTC, matching the onboarding session hours."""
    t = at.astimezone(UTC) if at.tzinfo else at
    hour = t.hour + t.minute / 60
    if 12 <= hour < 16:
        return Trade.Session.OVERLAP
    if 7 <= hour < 12:
        return Trade.Session.LONDON
    if 16 <= hour < 21:
        return Trade.Session.NEW_YORK
    if hour < 7:
        return Trade.Session.ASIA
    return Trade.Session.OFF


def weighted_exit(exits: list, size: Decimal) -> Decimal:
    """Partial closes merge into one trade (JR-4): the size-weighted exit price."""
    total = sum(Decimal(str(e["size"])) for e in exits)
    if abs(total - size) > Decimal("0.001"):
        raise ValidationError({"exits": [f"Partial closes add up to {total} lots; the trade is {size} lots."]})
    return sum(Decimal(str(e["price"])) * Decimal(str(e["size"])) for e in exits) / total


def derive(trade: Trade) -> Trade:
    """Fills the computed fields. Raises ValidationError for impossible trades."""
    d = 1 if trade.side == Trade.Side.BUY else -1
    units = trade.size * CONTRACT_SIZE
    same_ccy = quote_currency(trade.instrument) == trade.account.currency.upper()

    if trade.initial_stop is not None:
        distance = (trade.entry - trade.initial_stop) * d
        if distance <= 0:
            side = "below" if d == 1 else "above"
            raise ValidationError({"initial_stop": [f"For a {trade.side}, the stop goes {side} the entry."]})
        if same_ccy:
            trade.initial_risk_ccy = (distance * units).quantize(Decimal("0.01"))
    elif same_ccy:
        trade.initial_risk_ccy = None
    if trade.exit_price is None and not trade.exits and same_ccy:
        trade.gross_pnl = None

    if trade.exits:
        trade.exit_price = weighted_exit(trade.exits, trade.size)

    trade.pnl, trade.r_result, trade.r_estimated = None, None, False
    if trade.exit_price is not None:
        move = (trade.exit_price - trade.entry) * d
        if same_ccy:
            trade.gross_pnl = (move * units).quantize(Decimal("0.01"))
        if trade.gross_pnl is not None:
            trade.pnl = trade.gross_pnl - trade.fees + trade.swap
        if trade.pnl is not None and trade.initial_risk_ccy:
            trade.r_result = round(float(trade.pnl / trade.initial_risk_ccy), 4)
        elif trade.initial_stop is not None:
            trade.r_result = round(float(move / ((trade.entry - trade.initial_stop) * d)), 4)
            trade.r_estimated = True
        if trade.closed_at is None:
            raise ValidationError({"closed_at": ["A closed trade needs its close time."]})

    if trade.closed_at and trade.closed_at < trade.opened_at:
        raise ValidationError({"closed_at": ["The close time is before the open time."]})

    if trade.exit_price is None:
        trade.outcome = Trade.Outcome.OPEN
    else:
        value = trade.r_result if trade.r_result is not None else (float(trade.pnl) if trade.pnl is not None else 0.0)
        threshold = BREAKEVEN_R if trade.r_result is not None else 0
        if abs(value) < threshold or value == 0:
            trade.outcome = Trade.Outcome.BREAKEVEN
        else:
            trade.outcome = Trade.Outcome.WIN if value > 0 else Trade.Outcome.LOSS

    trade.market_session = market_session(trade.opened_at)

    # JR-4/JR-5: no initial stop is a rule break; every unticked rule is one too.
    broken = [c["rule"] for c in trade.rule_checks if not c.get("followed")]
    if trade.initial_stop is None:
        broken.insert(0, "No initial stop")
    trade.broken_rules = broken
    trade.rules_followed = not broken
    return trade


def refresh_after_loss(user) -> None:
    """JR-6: a trade opened after the previous closed trade lost is flagged."""
    trades = list(Trade.objects.owned_by(user).order_by("opened_at").only("id", "opened_at", "closed_at", "outcome", "after_loss"))
    closed = sorted((t for t in trades if t.closed_at), key=lambda t: t.closed_at)
    changed = []
    i, last = 0, None
    for t in trades:
        while i < len(closed) and closed[i].closed_at <= t.opened_at:
            last = closed[i]
            i += 1
        flag = last is not None and last.outcome == Trade.Outcome.LOSS
        if flag != t.after_loss:
            t.after_loss = flag
            changed.append(t)
    Trade.objects.bulk_update(changed, ["after_loss"])


@transaction.atomic
def ensure_defaults(user) -> None:
    """A practice account and starter checklist, so the first trade can be logged at once."""
    if not TradingAccount.objects.owned_by(user).exists():
        TradingAccount.objects.create(user=user, name="Practice", kind=TradingAccount.Kind.DEMO, currency="USD")
    if not PracticeRule.objects.owned_by(user).exists():
        PracticeRule.objects.bulk_create(PracticeRule(user=user, text=t, order=i) for i, t in enumerate(DEFAULT_RULES))


# --- CSV export (JR-10) --------------------------------------------------------

EXPORT_COLUMNS = [
    "opened_at", "closed_at", "account", "instrument", "side", "size", "entry", "initial_stop", "target",
    "exit_price", "initial_risk_ccy", "gross_pnl", "fees", "swap", "pnl", "r_result", "r_estimated", "outcome",
    "market_session", "setup_key", "rules_followed", "broken_rules", "emotion_before", "emotion_after",
    "confidence", "sleep", "distracted", "after_loss", "tags", "notes",
]


def safe_cell(value) -> str:
    """Escapes spreadsheet formulas: a cell starting with = + - @ tab or CR is prefixed with '."""
    if value is None:
        return ""
    if isinstance(value, (list, tuple)):
        value = "; ".join(str(v) for v in value)
    text = str(value)
    if text and text[0] in "=+-@\t\r":
        # Plain negative numbers stay numbers; anything else that could run as a formula is quoted.
        try:
            float(text)
            return text
        except ValueError:
            return "'" + text
    return text


def export_csv(user) -> str:
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(EXPORT_COLUMNS)
    for t in Trade.objects.owned_by(user).select_related("account").order_by("opened_at"):
        row = []
        for col in EXPORT_COLUMNS:
            value = t.account.name if col == "account" else getattr(t, col)
            if isinstance(value, datetime):
                value = value.isoformat()
            row.append(safe_cell(value))
        writer.writerow(row)
    return out.getvalue()


def day_bounds(day, tzinfo):
    start = datetime.combine(day, time.min, tzinfo)
    return start, datetime.combine(day, time.max, tzinfo)
