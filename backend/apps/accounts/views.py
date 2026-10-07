from django.utils import timezone
from rest_framework import generics, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.views import OwnedViewSetMixin
from apps.gates.services import grant_gate

from .models import ActivityEvent, NeverAgainItem, Profile
from .serializers import MeSerializer, NeverAgainSerializer, ProfileSerializer


class MeView(generics.RetrieveUpdateAPIView):
    """GET/PATCH /me"""

    serializer_class = MeSerializer

    def get_object(self):
        return self.request.user

    def delete(self, request):
        """DELETE /me: 7-day soft delete, then a hard-delete job (AS-3)."""
        user = request.user
        user.deletion_requested_at = timezone.now()
        user.save(update_fields=["deletion_requested_at", "updated_at"])
        return Response(
            {"message": "Your account will be deleted in 7 days. Sign in before then to cancel."},
            status=status.HTTP_202_ACCEPTED,
        )


class ProfileView(generics.RetrieveUpdateAPIView):
    """GET/PUT /me/profile: each onboarding step saves on completion (ON-1)."""

    serializer_class = ProfileSerializer

    def get_object(self):
        profile, _ = Profile.objects.get_or_create(user=self.request.user)
        return profile


class AcceptPlanView(APIView):
    """POST /me/plan/accept: passes Gate 1 (ON-5)."""

    def post(self, request):
        profile, _ = Profile.objects.get_or_create(user=request.user)
        if profile.plan_accepted_at is None:
            profile.plan_accepted_at = timezone.now()
            profile.save(update_fields=["plan_accepted_at", "updated_at"])
            ActivityEvent.objects.create(user=request.user, type="plan_accepted")
        gate_pass = grant_gate(request.user, gate=1, evidence={"plan_accepted_at": profile.plan_accepted_at.isoformat()})
        return Response({"gate": 1, "passed_at": gate_pass.passed_at})


class NeverAgainViewSet(OwnedViewSetMixin, viewsets.ModelViewSet):
    queryset = NeverAgainItem.objects.all()
    serializer_class = NeverAgainSerializer
    pagination_class = None
