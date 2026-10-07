import hashlib
import hmac
import time

from django.conf import settings
from rest_framework import mixins, permissions, viewsets
from rest_framework.decorators import api_view, authentication_classes, permission_classes, throttle_classes
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.response import Response

from .models import Job
from .serializers import JobSerializer
from .sweep import run_sweep


class OwnedViewSetMixin:
    """
    The shared base queryset for user-owned data (spec §16 "Data isolation"):
    every query is filtered by the authenticated user, and new rows are
    stamped with them. Tests prove one user can't read another's rows.
    """

    owned_field = "user"

    def get_queryset(self):
        return super().get_queryset().filter(**{self.owned_field: self.request.user})

    def perform_create(self, serializer):
        serializer.save(**{self.owned_field: self.request.user})


class JobViewSet(OwnedViewSetMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """GET /jobs/{id}: owner only (spec §15)."""

    queryset = Job.objects.all()
    serializer_class = JobSerializer


def verify_sweep_signature(request) -> None:
    """HMAC over "<timestamp>.<body>" with a bounded clock skew (spec §13)."""
    secret = settings.SWEEP_HMAC_SECRET
    ts = request.headers.get("X-Sweep-Timestamp", "")
    sig = request.headers.get("X-Sweep-Signature", "")
    if not secret or not ts.isdigit() or not sig:
        raise AuthenticationFailed("Missing or invalid signature.")
    if abs(time.time() - int(ts)) > settings.SWEEP_MAX_SKEW_SECONDS:
        raise AuthenticationFailed("Signature expired.")
    expected = hmac.new(secret.encode(), f"{ts}.".encode() + request.body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, sig):
        raise AuthenticationFailed("Missing or invalid signature.")


@api_view(["POST"])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
@throttle_classes([])
def sweep(request):
    """POST /internal/jobs/sweep: idempotent housekeeping, finishes within 60 s."""
    verify_sweep_signature(request)
    return Response(run_sweep())


@api_view(["GET"])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def health(request):
    return Response({"status": "ok"})
