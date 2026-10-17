"""Discipline data (spec §11). Phase 1: guided daily and weekly reviews (JR-8)."""

from django.db import models

from apps.core.models import OwnedModel


class Review(OwnedModel):
    class Kind(models.TextChoices):
        DAILY = "daily"
        WEEKLY = "weekly"

    kind = models.CharField(max_length=8, choices=Kind.choices)
    # The day reviewed, or the Monday of the week, in the user's timezone.
    period = models.DateField()
    answers = models.JSONField(default=dict)  # {"q1": "...", ...}

    class Meta(OwnedModel.Meta):
        ordering = ["-period"]
        constraints = [models.UniqueConstraint(fields=["user", "kind", "period"], name="review_once_per_period")]
