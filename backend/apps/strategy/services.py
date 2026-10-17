"""
Strategy Lab services (spec §6, rulebook-builder.md §3.5–3.6). Gate 3 is
decided here, by the server's clarity engine; no client field can set it.
"""

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import APIException

from apps.academy.models import Lesson, LessonProgress
from apps.gates.services import gates_open, grant_gate

from .clarity import check
from .fit import profile_fit
from .models import MAX_ACTIVE_STRATEGIES, Strategy, StrategyVersion
from .schema import validate_document
from .vocabulary import new_draft


class LabConflict(APIException):
    """409 with a code and optional extra fields for the client."""

    status_code = status.HTTP_409_CONFLICT

    def __init__(self, code: str, message: str, **extra):
        super().__init__(message)
        self.code = code
        self.extra = extra


# --- Who can draft -------------------------------------------------------------------


def draft_access(user) -> dict:
    """
    Whether the builder is open, and what's left to open it. Production: the
    strategy-design lessons must be complete. Development: always open, but
    the requirement is still reported so the nudge can be reviewed.
    """
    slugs = list(settings.STRATEGY_LAB_REQUIRED_LESSONS)
    titles = dict(Lesson.objects.filter(slug__in=slugs).values_list("slug", "title"))
    done = set(
        LessonProgress.objects.filter(user=user, lesson__slug__in=slugs, completed_at__isnull=False).values_list("lesson__slug", flat=True)
    )
    required = [{"slug": s, "title": titles.get(s, s), "done": s in done} for s in slugs]
    met = all(r["done"] for r in required)
    return {"open": met or gates_open(), "requirement_met": met, "gates_open": gates_open(), "required": required}


def require_draft_access(user) -> None:
    access = draft_access(user)
    if not access["open"]:
        raise LabConflict(
            "lab_locked",
            "The Strategy Lab opens after the strategy lessons in Level 6.",
            required=access["required"],
        )


# --- Strategies and versions ---------------------------------------------------------


def active_count(user) -> int:
    return Strategy.objects.owned_by(user).filter(status=Strategy.Status.ACTIVE).count()


def check_limit(user) -> None:
    if active_count(user) >= MAX_ACTIVE_STRATEGIES:
        raise LabConflict(
            "strategy_limit",
            f"{MAX_ACTIVE_STRATEGIES} strategies are active, the most allowed. Archive one to start another.",
        )


@transaction.atomic
def create_strategy(user, name: str) -> Strategy:
    require_draft_access(user)
    check_limit(user)
    strategy = Strategy.objects.create(user=user, name=name.strip()[:60])
    StrategyVersion.objects.create(user=user, strategy=strategy, number=1, **new_draft())
    return strategy


def latest(strategy: Strategy) -> StrategyVersion:
    return strategy.versions.order_by("-number").first()


@transaction.atomic
def autosave(version: StrategyVersion, changes: dict, revision: int) -> StrategyVersion:
    version = StrategyVersion.objects.select_for_update().get(pk=version.pk)
    if version.locked:
        raise LabConflict("version_locked", f"Version {version.number} is locked. Edit rules to start a new version.")
    if revision != version.revision:
        raise LabConflict(
            "stale_revision",
            "This draft changed on another device.",
            server={"revision": version.revision, **version.document()},
        )
    doc = version.document()
    doc.update({k: v for k, v in changes.items() if k in StrategyVersion.LOCKED_FIELDS})
    validate_document(doc)
    for key, value in doc.items():
        setattr(version, key, value)
    version.revision += 1
    version.clarity_status = StrategyVersion.Clarity.UNCHECKED
    version.save()
    return version


def profile_of(user) -> dict:
    p = getattr(user, "profile", None)
    return {
        "weekly_hours": getattr(p, "weekly_hours", None),
        "sessions": list(getattr(p, "sessions", None) or []),
        "timezone": user.timezone or "UTC",
    }


def run_clarity(version: StrategyVersion) -> dict:
    examples = list(version.examples.values("rule_key", "valid"))
    report = check(version.strategy.name, version.document(), examples)
    report["fit"] = profile_fit(version.rules, profile_of(version.user))
    if not version.locked:
        version.clarity_report = report
        version.clarity_status = StrategyVersion.Clarity.PASSING if report["passed"] else StrategyVersion.Clarity.FAILING
        version.kind = report["kind"]
        version.save(update_fields=["clarity_report", "clarity_status", "kind", "updated_at"])
    return report


@transaction.atomic
def pass_gate_3(version: StrategyVersion) -> StrategyVersion:
    """SL-4: Gate 3 passes only when every clarity check passes, run here on the server."""
    version = StrategyVersion.objects.select_for_update().get(pk=version.pk)
    if version.locked:
        return version
    require_draft_access(version.user)
    report = run_clarity(version)
    if not report["passed"]:
        raise LabConflict("clarity_failing", "Some clarity checks fail, so this version can't be locked yet.", report=report)
    version.locked = True
    version.locked_at = timezone.now()
    version.save(update_fields=["locked", "locked_at", "updated_at"])
    grant_gate(
        version.user,
        gate=3,
        strategy_version=version,
        evidence={"clarity": "passing", "kind": version.kind, "checks": len(report["items"])},
    )
    return version


@transaction.atomic
def new_version(strategy: Strategy, reason: str) -> StrategyVersion:
    """SL-6: after Gate 3, every change is a new version with a reason."""
    current = latest(strategy)
    if not current.locked:
        raise LabConflict("draft_exists", f"Version {current.number} is still a draft; edit it directly.")
    if strategy.status != Strategy.Status.ACTIVE:
        raise LabConflict("strategy_archived", "Unarchive this strategy to change it.")
    return StrategyVersion.objects.create(
        user=strategy.user,
        strategy=strategy,
        number=current.number + 1,
        reason=reason.strip(),
        rules=current.rules,
        risk_plan=current.risk_plan,
        cost_model=current.cost_model,
        kind=current.kind,
    )
