"""AI usage and caching (spec §10, §14 "AIInteraction")."""

from django.db import models

from apps.core.models import BaseModel, OwnedModel


class AIInteraction(OwnedModel):
    """One request to an AI feature: who, which provider and model, tokens, estimated cost, outcome."""

    class Outcome(models.TextChoices):
        ANSWERED = "answered"
        CACHED = "cached"
        REFUSED = "refused"  # guardrail check failed twice
        FAILED = "failed"  # providers unavailable

    feature = models.CharField(max_length=32, db_index=True)  # "tutor"
    ref = models.CharField(max_length=80, blank=True)  # lesson slug
    provider = models.CharField(max_length=16, blank=True)
    model = models.CharField(max_length=60, blank=True)
    input_tokens = models.PositiveIntegerField(default=0)
    output_tokens = models.PositiveIntegerField(default=0)
    cost_usd = models.DecimalField(max_digits=10, decimal_places=6, default=0)
    outcome = models.CharField(max_length=10, choices=Outcome.choices, default=Outcome.ANSWERED)
    flagged = models.CharField(max_length=120, blank=True)  # guardrail reason, if any
    latency_ms = models.PositiveIntegerField(default=0)

    class Meta(OwnedModel.Meta):
        indexes = [models.Index(fields=["user", "feature", "created_at"], name="ai_user_feature_day")]


class TutorAnswer(BaseModel):
    """Cached tutor answers by lesson and normalised question (spec §10 cost control). Shared, never user-specific."""

    lesson = models.CharField(max_length=80)
    key = models.CharField(max_length=64, unique=True)  # sha256 of lesson + normalised question
    question = models.CharField(max_length=500)
    answer = models.TextField()
    provider = models.CharField(max_length=16)
    model = models.CharField(max_length=60)
    hits = models.PositiveIntegerField(default=0)
