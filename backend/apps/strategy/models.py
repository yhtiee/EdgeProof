"""
Strategy Lab (spec §6, rulebook-builder.md §3.5). A strategy has numbered
versions; each version holds the rulebook document in three JSON fields,
validated against schema/rulebook.v1.json on every save. Passing Gate 3 locks
a version for good; later edits create a new version with a reason (SL-6).
"""

from django.core.exceptions import ValidationError
from django.db import models

from apps.core.models import OwnedModel

MAX_ACTIVE_STRATEGIES = 5  # SL-10


class Strategy(OwnedModel):
    class Status(models.TextChoices):
        ACTIVE = "active"
        ARCHIVED = "archived"

    name = models.CharField(max_length=60)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE, db_index=True)

    class Meta(OwnedModel.Meta):
        ordering = ["status", "-updated_at"]


class StrategyVersion(OwnedModel):
    class Kind(models.TextChoices):
        MECHANICAL = "mechanical"
        DISCRETIONARY = "discretionary"

    class Clarity(models.TextChoices):
        UNCHECKED = "unchecked"
        FAILING = "failing"
        PASSING = "passing"

    strategy = models.ForeignKey(Strategy, on_delete=models.CASCADE, related_name="versions")
    number = models.PositiveIntegerField()
    reason = models.CharField(max_length=280, blank=True)  # required from version 2
    rules = models.JSONField()
    risk_plan = models.JSONField()
    cost_model = models.JSONField(default=dict)
    kind = models.CharField(max_length=14, choices=Kind.choices, default=Kind.MECHANICAL)
    clarity_status = models.CharField(max_length=10, choices=Clarity.choices, default=Clarity.UNCHECKED)
    clarity_report = models.JSONField(default=dict, blank=True)
    locked = models.BooleanField(default=False)
    locked_at = models.DateTimeField(null=True, blank=True)
    revision = models.PositiveIntegerField(default=0)  # optimistic concurrency for autosave

    class Meta(OwnedModel.Meta):
        ordering = ["strategy", "-number"]
        constraints = [models.UniqueConstraint(fields=["strategy", "number"], name="strategy_version_number")]

    LOCKED_FIELDS = ("rules", "risk_plan", "cost_model")

    def document(self) -> dict:
        return {"rules": self.rules, "risk_plan": self.risk_plan, "cost_model": self.cost_model}

    def save(self, *args, **kwargs):
        # A locked version never changes its rules (SL-6); the API checks first, this is the last line.
        if self.pk and not self._state.adding:
            old = StrategyVersion.objects.filter(pk=self.pk).values(*self.LOCKED_FIELDS, "locked").first()
            if old and old["locked"] and any(old[f] != getattr(self, f) for f in self.LOCKED_FIELDS):
                raise ValidationError("A locked version can't change. Create a new version instead.")
        super().save(*args, **kwargs)


class RuleExample(OwnedModel):
    """A screenshot showing a setup rule true (`valid`) or false (SL-3)."""

    version = models.ForeignKey(StrategyVersion, on_delete=models.CASCADE, related_name="examples")
    rule_key = models.CharField(max_length=16)  # condition id, e.g. "c2"
    valid = models.BooleanField()
    image_key = models.CharField(max_length=255)
    note = models.CharField(max_length=280)
    annotations = models.JSONField(default=list, blank=True)  # [{"shape": "arrow"|"box", "x1", "y1", "x2", "y2"}] in 0–1

    class Meta(OwnedModel.Meta):
        ordering = ["rule_key", "-valid", "created_at"]
