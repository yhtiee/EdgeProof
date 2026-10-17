"""
The scheduled sweep (spec §13). Called by a GitHub Actions cron through an
HMAC-signed endpoint. Every step is idempotent and bounded so the whole run
finishes inside 60 seconds on the free host.
"""

import logging
import time
from datetime import timedelta

from django.utils import timezone

from .models import Job, Notification, UploadIntent

log = logging.getLogger(__name__)

BUDGET_SECONDS = 50
STUCK_AFTER = timedelta(minutes=10)
MAX_JOB_ATTEMPTS = 3


def run_sweep() -> dict:
    started = time.monotonic()
    now = timezone.now()
    report = {"notifications_sent": 0, "jobs_retried": 0, "jobs_failed": 0, "uploads_cleaned": 0}

    # 1. Due notifications: mark in-app ones as delivered; push/email go through
    #    their senders when configured. Shown on next visit either way.
    due = Notification.objects.filter(sent_at__isnull=True, due_at__lte=now)[:500]
    for n in due:
        n.sent_at = now
        n.save(update_fields=["sent_at", "updated_at"])
        report["notifications_sent"] += 1

    # 2. Stuck jobs: requeue, or fail after MAX_JOB_ATTEMPTS.
    stuck = Job.objects.filter(status=Job.Status.RUNNING, heartbeat_at__lt=now - STUCK_AFTER)
    for job in stuck[:100]:
        if time.monotonic() - started > BUDGET_SECONDS:
            break
        if job.attempts >= MAX_JOB_ATTEMPTS:
            job.status = Job.Status.FAILED
            job.error = "Stopped responding and was retried 3 times."
            report["jobs_failed"] += 1
        else:
            job.status = Job.Status.QUEUED
            report["jobs_retried"] += 1
        job.save(update_fields=["status", "error", "updated_at"])

    # 3. Unconfirmed uploads older than 24 hours (object deletion via storage service).
    stale = UploadIntent.objects.filter(confirmed_at__isnull=True, created_at__lt=now - timedelta(hours=24))
    from .uploads import delete_object

    report["uploads_cleaned"] = 0
    for intent in stale:
        try:
            delete_object(intent.key)
        except Exception:  # noqa: BLE001 (object never arrived; drop the row anyway)
            log.info("sweep: no object for %s", intent.key)
        intent.delete()
        report["uploads_cleaned"] += 1

    report["seconds"] = round(time.monotonic() - started, 3)
    log.info("sweep finished %s", report)
    return report
