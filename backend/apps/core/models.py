"""
Shared base models (spec §14): every table has a UUID id, created_at and
updated_at. User-owned tables carry user_id and are always filtered by it.
"""

import uuid

from django.conf import settings
from django.db import models


class BaseModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        ordering = ["-created_at"]


class OwnedQuerySet(models.QuerySet):
    def owned_by(self, user):
        return self.filter(user=user)


class OwnedModel(BaseModel):
    """A row that belongs to one learner. Use `Model.objects.owned_by(user)`."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")

    objects = OwnedQuerySet.as_manager()

    class Meta:
        abstract = True
        ordering = ["-created_at"]


class Job(OwnedModel):
    """Long work run in a thread in the web process (spec §13); the sweep picks up stragglers."""

    class Kind(models.TextChoices):
        IMPORT = "import"
        VERDICT = "verdict"
        AI_REVIEW = "ai_review"
        DELETE_ACCOUNT = "delete_account"

    class Status(models.TextChoices):
        QUEUED = "queued"
        RUNNING = "running"
        DONE = "done"
        FAILED = "failed"

    kind = models.CharField(max_length=32, choices=Kind.choices)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.QUEUED, db_index=True)
    progress = models.PositiveSmallIntegerField(default=0)
    payload = models.JSONField(default=dict, blank=True)
    result = models.JSONField(default=dict, blank=True)
    error = models.TextField(blank=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    heartbeat_at = models.DateTimeField(null=True, blank=True)


class Notification(OwnedModel):
    """Due reminders; sent by the sweep, shown in-app on next visit if push fails (spec §3)."""

    class Channel(models.TextChoices):
        IN_APP = "in_app"
        PUSH = "push"
        EMAIL = "email"

    type = models.CharField(max_length=48)
    channel = models.CharField(max_length=16, choices=Channel.choices, default=Channel.IN_APP)
    title = models.CharField(max_length=140)
    body = models.TextField(blank=True)
    due_at = models.DateTimeField(db_index=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    dedupe_key = models.CharField(max_length=128)

    class Meta(OwnedModel.Meta):
        constraints = [models.UniqueConstraint(fields=["user", "dedupe_key"], name="notification_dedupe")]


class UploadIntent(OwnedModel):
    """A presigned upload; unconfirmed rows are swept after 24 hours (spec §14, §16)."""

    key = models.CharField(max_length=255, unique=True)
    content_type = models.CharField(max_length=32)
    size = models.PositiveIntegerField()
    confirmed_at = models.DateTimeField(null=True, blank=True)
