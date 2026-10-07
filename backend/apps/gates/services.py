"""
Gate decisions are made here, by code, and recorded with their evidence
(spec §8). AI never decides a gate.
"""

from django.db import transaction
from django.utils import timezone

from apps.audit.models import AuditLog

from .models import GATE_DEFAULTS, GateConfig, GatePass


def active_config(gate: int) -> tuple[int, dict]:
    cfg = GateConfig.objects.filter(gate=gate, active=True).order_by("-version").first()
    if cfg:
        return cfg.version, cfg.criteria
    return 1, GATE_DEFAULTS[gate]


def active_pass(user, gate: int) -> GatePass | None:
    return GatePass.objects.filter(
        user=user, gate=gate, revoked_at__isnull=True
    ).first()


def has_gate(user, gate: int) -> bool:
    return active_pass(user, gate) is not None


@transaction.atomic
def grant_gate(user, *, gate: int, evidence: dict, override_by=None) -> GatePass:
    existing = active_pass(user, gate)
    if existing:
        return existing
    version, _ = active_config(gate)
    gp = GatePass.objects.create(
        user=user,
        gate=gate,
        passed_at=timezone.now(),
        evidence=evidence,
        config_version=version,
        granted_by_override=override_by is not None,
    )
    AuditLog.record(
        actor_id=override_by.id if override_by else user.id,
        action="gate.override" if override_by else "gate.pass",
        target=f"user:{user.id}:gate:{gate}",
        detail={"evidence": evidence, "config_version": version},
    )
    return gp


@transaction.atomic
def revoke_gate(user, *, gate: int, reason: str) -> bool:
    gp = active_pass(user, gate)
    if not gp:
        return False
    gp.revoked_at = timezone.now()
    gp.revoke_reason = reason
    gp.save(update_fields=["revoked_at", "revoke_reason", "updated_at"])
    AuditLog.record(actor_id=user.id, action="gate.revoke", target=f"user:{user.id}:gate:{gate}", detail={"reason": reason})
    return True


def evaluate_gate_2(user) -> dict:
    """
    Phase-aware (spec §2): requires only the level exams that are published.
    A placement pass (≥ 90%) counts as that level's evidence.
    """
    from apps.academy.models import Exam, ExamAttempt, Level

    levels = list(Level.objects.filter(status=Level.Status.PUBLISHED).order_by("order"))
    results = []
    for level in levels:
        passed = ExamAttempt.objects.filter(
            user=user,
            passed=True,
            exam__level=level,
            exam__scope__in=[Exam.Scope.LEVEL, Exam.Scope.PLACEMENT],
        ).exists()
        results.append({"level": level.order, "title": level.title, "met": passed})
    met = bool(levels) and all(r["met"] for r in results)
    return {"met": met, "criteria": results}

