import uuid

from django.db import models
from django.utils import timezone


class AuditLog(models.Model):
    """
    Append-only audit trail (spec §14): admin reads via SupportGrant, gate
    overrides, gate decisions, session revocations. actor_id is a UUID, not a
    foreign key, so entries survive account deletion.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor_id = models.UUIDField(null=True, blank=True, db_index=True)
    action = models.CharField(max_length=64, db_index=True)
    target = models.CharField(max_length=128)
    detail = models.JSONField(default=dict, blank=True)
    at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-at"]

    @classmethod
    def record(cls, *, actor_id, action: str, target: str, detail: dict | None = None) -> "AuditLog":
        return cls.objects.create(actor_id=actor_id, action=action, target=target, detail=detail or {})

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise RuntimeError("Audit log entries are append-only.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise RuntimeError("Audit log entries are append-only.")
