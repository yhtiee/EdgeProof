"""
Journal and testing data (spec §7, §14).

Phase 1 ships the practice journal (JR-1 to JR-6, JR-9 to JR-11): trades
belong to a user and a trading account; a test run link arrives with Phase 2.
Derived fields (P&L, R, outcome, session, flags) are computed on the server
in services.derive() so every client gets the same numbers.
"""

from django.db import models
from django.db.models import Q

from apps.core.models import OwnedModel


class TradingAccount(OwnedModel):
    """Where trades happen (JR-2). Practice trades usually sit on a demo account."""

    class Kind(models.TextChoices):
        DEMO = "demo"
        LIVE = "live"
        PROP = "prop"

    name = models.CharField(max_length=60)
    kind = models.CharField(max_length=8, choices=Kind.choices, default=Kind.DEMO)
    broker = models.CharField(max_length=80, blank=True)
    currency = models.CharField(max_length=3, default="USD")
    # Used to show risk % per trade and to compare drawdowns with the plan.
    balance = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    risk_per_trade_pct = models.DecimalField(max_digits=4, decimal_places=2, default=1)
    archived = models.BooleanField(default=False)

    class Meta(OwnedModel.Meta):
        ordering = ["archived", "created_at"]


class PracticeRule(OwnedModel):
    """
    The checklist ticked on every practice trade (JR-5) until a strategy
    rulebook exists; then the rules come from the strategy version.
    """

    text = models.CharField(max_length=160)
    order = models.PositiveSmallIntegerField(default=0)
    active = models.BooleanField(default=True)

    class Meta(OwnedModel.Meta):
        ordering = ["order", "created_at"]


class Trade(OwnedModel):
    class Side(models.TextChoices):
        BUY = "buy"
        SELL = "sell"

    class Outcome(models.TextChoices):
        OPEN = "open"
        WIN = "win"
        LOSS = "loss"
        BREAKEVEN = "breakeven"

    class Session(models.TextChoices):
        ASIA = "asia"
        LONDON = "london"
        OVERLAP = "overlap"  # London and New York both open
        NEW_YORK = "new_york"
        OFF = "off"  # after New York closes

    account = models.ForeignKey(TradingAccount, on_delete=models.PROTECT, related_name="trades")
    # JR-1: practice trades may link to any version, drafts included; they never feed a verdict.
    strategy_version = models.ForeignKey(
        "strategy.StrategyVersion", null=True, blank=True, on_delete=models.PROTECT, related_name="trades"
    )
    # Offline-first: the device creates the id it syncs with, so a resend can't duplicate (DESIGN §10).
    client_id = models.CharField(max_length=40, blank=True)

    instrument = models.CharField(max_length=12)  # "EUR/USD"
    side = models.CharField(max_length=4, choices=Side.choices)
    entry = models.DecimalField(max_digits=14, decimal_places=6)
    initial_stop = models.DecimalField(max_digits=14, decimal_places=6, null=True, blank=True)  # immutable once saved
    target = models.DecimalField(max_digits=14, decimal_places=6, null=True, blank=True)
    exit_price = models.DecimalField(max_digits=14, decimal_places=6, null=True, blank=True)
    exits = models.JSONField(default=list, blank=True)  # partial closes: [{"price": "1.1", "size": "0.5"}]
    size = models.DecimalField(max_digits=10, decimal_places=2)  # lots
    opened_at = models.DateTimeField()
    closed_at = models.DateTimeField(null=True, blank=True)

    # Money in account currency. P&L is entered when the pair's quote currency
    # differs from the account's (no FX feed in Phase 1); otherwise computed.
    initial_risk_ccy = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    gross_pnl = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    fees = models.DecimalField(max_digits=10, decimal_places=2, default=0)  # commission, a cost (≥ 0)
    swap = models.DecimalField(max_digits=10, decimal_places=2, default=0)  # signed: + received, − paid

    # Derived (services.derive)
    pnl = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)  # net
    r_result = models.FloatField(null=True, blank=True)
    r_estimated = models.BooleanField(default=False)  # from prices only, costs not included
    outcome = models.CharField(max_length=10, choices=Outcome.choices, default=Outcome.OPEN)
    market_session = models.CharField(max_length=10, choices=Session.choices, blank=True)
    after_loss = models.BooleanField(default=False)  # JR-6, automatic

    setup_key = models.CharField(max_length=60, blank=True)
    rule_checks = models.JSONField(default=list, blank=True)  # [{"rule": "...", "followed": true}]
    rules_followed = models.BooleanField(default=False)
    broken_rules = models.JSONField(default=list, blank=True)

    emotion_before = models.CharField(max_length=16, blank=True)
    emotion_after = models.CharField(max_length=16, blank=True)
    confidence = models.PositiveSmallIntegerField(null=True, blank=True)  # 1–5
    sleep = models.CharField(max_length=8, blank=True)  # good | ok | poor
    distracted = models.BooleanField(null=True, blank=True)
    tags = models.JSONField(default=list, blank=True)
    notes = models.TextField(blank=True, max_length=5000)
    external_ticket = models.CharField(max_length=40, blank=True)

    class Meta(OwnedModel.Meta):
        ordering = ["-opened_at", "-created_at"]
        indexes = [models.Index(fields=["user", "opened_at"], name="trade_user_opened")]
        constraints = [
            models.UniqueConstraint(fields=["user", "client_id"], condition=~Q(client_id=""), name="trade_client_id"),
            models.UniqueConstraint(
                fields=["account", "external_ticket"], condition=~Q(external_ticket=""), name="trade_account_ticket"
            ),
        ]


class TradeImage(OwnedModel):
    class Kind(models.TextChoices):
        BEFORE = "before"
        AFTER = "after"

    trade = models.ForeignKey(Trade, on_delete=models.CASCADE, related_name="images")
    kind = models.CharField(max_length=8, choices=Kind.choices)
    key = models.CharField(max_length=255)

    class Meta(OwnedModel.Meta):
        ordering = ["created_at"]
