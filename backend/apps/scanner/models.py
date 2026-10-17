"""
Fundamental Bias Scanner data (docs/scanner/fundamental-bias-scanner.md,
spec "Architecture and data model"). Data moves one way: ingest raw
observations, score them in a run, serve the stored results.
"""

from django.db import models

from apps.core.models import BaseModel

from .reference import FACTORS_CURRENCY, FACTORS_PAIR  # noqa: F401 (re-exported)


class Currency(BaseModel):
    code = models.CharField(max_length=3, unique=True)
    name = models.CharField(max_length=40)
    central_bank = models.CharField(max_length=60)
    cot_contract_code = models.CharField(max_length=10)
    inflation_target = models.FloatField(default=2.0)

    class Meta(BaseModel.Meta):
        ordering = ["code"]

    def __str__(self):
        return self.code


class Pair(BaseModel):
    symbol = models.CharField(max_length=6, unique=True)  # "EURUSD"
    base = models.ForeignKey(Currency, on_delete=models.CASCADE, related_name="+")
    quote = models.ForeignKey(Currency, on_delete=models.CASCADE, related_name="+")

    class Meta(BaseModel.Meta):
        ordering = ["symbol"]

    def __str__(self):
        return self.symbol


class DataSource(BaseModel):
    """Health of each feed (spec: data_source)."""

    name = models.CharField(max_length=40, unique=True)
    base_url = models.URLField(blank=True)
    last_success_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True)
    last_error_at = models.DateTimeField(null=True, blank=True)


class RawObservation(BaseModel):
    """Every fetched data point; unique on factor + subject + period (+ series)."""

    factor = models.CharField(max_length=16, db_index=True)
    series = models.CharField(max_length=40, default="")  # e.g. "close", "cpi_yoy", "net_long"
    currency = models.ForeignKey(Currency, null=True, blank=True, on_delete=models.CASCADE)
    pair = models.ForeignKey(Pair, null=True, blank=True, on_delete=models.CASCADE)
    period_date = models.DateField()
    value = models.FloatField()
    extra = models.JSONField(default=dict, blank=True)  # e.g. sentiment sample size, COT long/short
    released_at = models.DateField(null=True, blank=True)  # when the market could know it (actual or estimated)
    source = models.ForeignKey(DataSource, on_delete=models.PROTECT)

    class Meta(BaseModel.Meta):
        ordering = ["period_date"]
        constraints = [
            models.UniqueConstraint(fields=["factor", "series", "currency", "period_date"], condition=models.Q(currency__isnull=False), name="obs_currency_unique"),
            models.UniqueConstraint(fields=["factor", "series", "pair", "period_date"], condition=models.Q(pair__isnull=False), name="obs_pair_unique"),
        ]
        indexes = [models.Index(fields=["factor", "currency", "period_date"]), models.Index(fields=["factor", "pair", "period_date"])]


class FactorConfig(BaseModel):
    """Tunable weights and cut-offs; a change is a new config version (spec: factor_config)."""

    version = models.PositiveIntegerField(default=1)
    factor = models.CharField(max_length=16)
    weight = models.FloatField()
    thresholds = models.JSONField(default=dict, blank=True)
    refresh_window_days = models.PositiveIntegerField()
    active = models.BooleanField(default=True)

    class Meta(BaseModel.Meta):
        ordering = ["version", "factor"]
        constraints = [models.UniqueConstraint(fields=["version", "factor"], name="factorconfig_version_factor")]


class ScoringRun(BaseModel):
    started_at = models.DateTimeField()
    finished_at = models.DateTimeField(null=True, blank=True)
    as_of = models.DateField()  # data released on or before this date only
    is_weekly_snapshot = models.BooleanField(default=False, db_index=True)
    is_replay = models.BooleanField(default=False)  # built from history, not live
    config_version = models.PositiveIntegerField(default=1)
    notes = models.JSONField(default=dict, blank=True)

    class Meta(BaseModel.Meta):
        ordering = ["-as_of", "-started_at"]


class FactorScore(BaseModel):
    run = models.ForeignKey(ScoringRun, on_delete=models.CASCADE, related_name="factor_scores")
    factor = models.CharField(max_length=16)
    currency = models.ForeignKey(Currency, null=True, blank=True, on_delete=models.CASCADE)
    pair = models.ForeignKey(Pair, null=True, blank=True, on_delete=models.CASCADE)
    raw_value = models.FloatField(null=True, blank=True)
    score = models.IntegerField(null=True, blank=True)  # −2..+2; null when missing
    is_stale = models.BooleanField(default=False)
    detail = models.JSONField(default=dict, blank=True)  # inputs behind the score: dates, comparisons, sources


class CurrencyScore(BaseModel):
    run = models.ForeignKey(ScoringRun, on_delete=models.CASCADE, related_name="currency_scores")
    currency = models.ForeignKey(Currency, on_delete=models.CASCADE)
    score = models.FloatField(null=True, blank=True)  # −10..+10; null when insufficient data
    label = models.CharField(max_length=16)
    factors_used = models.PositiveSmallIntegerField(default=0)


class PairScore(BaseModel):
    run = models.ForeignKey(ScoringRun, on_delete=models.CASCADE, related_name="pair_scores")
    pair = models.ForeignKey(Pair, on_delete=models.CASCADE)
    score = models.FloatField(null=True, blank=True)
    label = models.CharField(max_length=16)
    rank = models.PositiveSmallIntegerField(null=True, blank=True)
    change_wow = models.FloatField(null=True, blank=True)
    close = models.FloatField(null=True, blank=True)  # the pair's latest close at as_of, for history
    detail = models.JSONField(default=dict, blank=True)  # difference term, trend, retail, agreement


class Publication(BaseModel):
    """A central bank press release or speech that backs a factor (evidence panel, AI explanation input)."""

    currency = models.ForeignKey(Currency, on_delete=models.CASCADE, related_name="publications")
    title = models.CharField(max_length=300)
    url = models.URLField(max_length=500, unique=True)
    published_at = models.DateTimeField(db_index=True)
    summary = models.TextField(blank=True)  # plain text, trimmed
    topics = models.JSONField(default=list)  # factor names from reference.NEWS_TOPICS
    source = models.CharField(max_length=60)  # central bank name

    class Meta(BaseModel.Meta):
        ordering = ["-published_at"]


class Explanation(BaseModel):
    """
    A cached plain-language AI explanation of one subject (pair or currency) and
    optional factor for one scoring run. Built only from public data, so it's
    shared by every learner who asks for it.
    """

    key = models.CharField(max_length=64, unique=True)  # sha256 of run + subject + factor
    run = models.ForeignKey(ScoringRun, on_delete=models.CASCADE, related_name="explanations")
    subject = models.CharField(max_length=6)
    factor = models.CharField(max_length=16, blank=True)
    answer = models.TextField()
    provider = models.CharField(max_length=16)
    model = models.CharField(max_length=60)
    hits = models.PositiveIntegerField(default=0)


class CalendarEvent(BaseModel):
    """
    A scheduled economic release from the Forex Factory weekly calendar feed (forecast
    and previous only; actual figures come from the official data). Cached here, shown
    with a link back to Forex Factory, never redistributed as a feed.
    """

    currency = models.ForeignKey(Currency, on_delete=models.CASCADE, related_name="events")
    title = models.CharField(max_length=200)
    at = models.DateTimeField(db_index=True)
    impact = models.CharField(max_length=10)  # High or Medium
    forecast = models.CharField(max_length=40, blank=True)
    previous = models.CharField(max_length=40, blank=True)
    factor = models.CharField(max_length=16, blank=True)  # the scanner factor it feeds, if any

    class Meta(BaseModel.Meta):
        ordering = ["at"]
        constraints = [models.UniqueConstraint(fields=["currency", "title", "at"], name="calendar_event_unique")]
