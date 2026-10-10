import uuid

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone as tz

from apps.core.crypto import EncryptedJSONField
from apps.core.models import BaseModel, OwnedModel


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError("Email is required.")
        user = self.model(email=self.normalize_email(email).lower(), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("role", User.Role.ADMIN)
        return self.create_user(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    """Spec §3, §14. Content editor and admin can be one account while the founder works alone."""

    class Role(models.TextChoices):
        LEARNER = "learner"
        MENTOR = "mentor"
        EDITOR = "editor"
        ADMIN = "admin"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=80, blank=True)
    last_name = models.CharField(max_length=80, blank=True)
    timezone = models.CharField(max_length=64, default="Africa/Lagos")
    role = models.CharField(max_length=16, choices=Role.choices, default=Role.LEARNER)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    deletion_requested_at = models.DateTimeField(null=True, blank=True)  # AS-3: 7-day soft delete
    created_at = models.DateTimeField(default=tz.now)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    EMAIL_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    def __str__(self):
        return self.email

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()


class Profile(BaseModel):
    """Trader profile from onboarding (spec §4, §14 incl. peer-review changes)."""

    class Style(models.TextChoices):
        POSITION = "position"
        SWING = "swing"
        DAY = "day"

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    style = models.CharField(max_length=16, choices=Style.choices, blank=True)
    sessions = models.JSONField(default=list, blank=True)  # ["asia", "london", "new_york"]
    weekly_hours = models.PositiveSmallIntegerField(null=True, blank=True)
    risk_comfort = models.CharField(max_length=32, blank=True)
    answers = models.JSONField(default=dict, blank=True)  # experience and history (ON-3)
    # ON-1: the next onboarding step to show, so users resume on any device.
    # 2 time and sessions · 3 experience · 4 plan review · 5 done (plan accepted).
    onboarding_step = models.PositiveSmallIntegerField(default=2)
    # ON-7: money-related answers are encrypted; only a plaintext risk flag is stored beside them.
    readiness = EncryptedJSONField(null=True, blank=True)
    readiness_risk_flag = models.BooleanField(null=True, blank=True)
    plan_accepted_at = models.DateTimeField(null=True, blank=True)
    over_18_confirmed_at = models.DateTimeField(null=True, blank=True)  # AS-4
    last_active_at = models.DateTimeField(null=True, blank=True)
    settings = models.JSONField(default=dict, blank=True)  # AS-2


class NeverAgainItem(OwnedModel):
    """Seeded in onboarding, shown on the journal form (DE-5)."""

    text = models.CharField(max_length=200)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta(OwnedModel.Meta):
        ordering = ["order", "created_at"]


class SupportGrant(OwnedModel):
    """A time-limited grant the user creates before any admin read of their data (spec §3)."""

    scope = models.CharField(max_length=32, default="journal")
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)

    @property
    def is_active(self) -> bool:
        return self.revoked_at is None and self.expires_at > tz.now()


class ActivityEvent(OwnedModel):
    """Powers active-user, retention and funnel metrics (spec §1)."""

    type = models.CharField(max_length=48, db_index=True)
    ref = models.CharField(max_length=64, blank=True)
    at = models.DateTimeField(default=tz.now, db_index=True)
