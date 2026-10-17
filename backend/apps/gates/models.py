from django.db import models

from apps.core.models import BaseModel, OwnedModel


class GateConfig(BaseModel):
    """
    Versioned gate thresholds (spec §8). Existing passes are kept when the
    config changes; each pass records the config version it was judged by.
    """

    gate = models.PositiveSmallIntegerField()
    version = models.PositiveIntegerField()
    criteria = models.JSONField(default=dict)
    active = models.BooleanField(default=True)

    class Meta(BaseModel.Meta):
        constraints = [models.UniqueConstraint(fields=["gate", "version"], name="gateconfig_gate_version")]
        ordering = ["gate", "-version"]

    def __str__(self):
        return f"Gate {self.gate} v{self.version}"


class GatePass(OwnedModel):
    """
    One gate passed by one user, optionally for one strategy version (gates
    3–6 are per version). Revocations keep the row with a reason (spec §8).
    """

    gate = models.PositiveSmallIntegerField()
    # Gates 3–6 are per strategy version; gates 1–2 leave this empty.
    strategy_version = models.ForeignKey(
        "strategy.StrategyVersion", null=True, blank=True, on_delete=models.CASCADE, related_name="gate_passes"
    )
    passed_at = models.DateTimeField()
    evidence = models.JSONField(default=dict)
    config_version = models.PositiveIntegerField(default=1)
    granted_by_override = models.BooleanField(default=False)
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoke_reason = models.CharField(max_length=255, blank=True)

    class Meta(OwnedModel.Meta):
        indexes = [models.Index(fields=["user", "gate"])]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "gate"],
                condition=models.Q(revoked_at__isnull=True, strategy_version__isnull=True),
                name="gatepass_one_active",
            ),
            models.UniqueConstraint(
                fields=["user", "gate", "strategy_version"],
                condition=models.Q(revoked_at__isnull=True, strategy_version__isnull=False),
                name="gatepass_one_active_per_version",
            ),
        ]


GATE_DEFAULTS = {
    1: {"plan_accepted": True},
    2: {"all_published_level_exams_passed": True},
    3: {"clarity_checks_pass": True},
    4: {"verdict": "passed_out_of_sample"},
    5: {
        "min_forward_trades": 50,
        "min_weeks": 8,
        "forward_expectancy_gt": 0,
        "forward_vs_validation_min_ratio": 0.5,
        "drawdown_within_mc_p95": True,
        "min_rule_following": 0.9,
        "readiness_check_done": True,
    },
    6: {"min_real_trades": 30, "max_risk_pct": 0.25, "expectancy_gt": 0, "min_rule_following": 0.9},
}
USER_SCOPED_GATES = {1, 2}
