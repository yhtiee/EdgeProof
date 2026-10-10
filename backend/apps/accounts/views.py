from django.db import transaction
from django.utils import timezone
from rest_framework import generics, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.exceptions import Conflict
from apps.core.views import OwnedViewSetMixin
from apps.gates.services import grant_gate

from .models import ActivityEvent, NeverAgainItem, Profile
from .serializers import (
    ExperienceSerializer,
    MeSerializer,
    NeverAgainSerializer,
    ProfileSerializer,
    ProfileUpdateSerializer,
    TimeStepSerializer,
)
from .services import build_plan, seed_never_again

STEP_TIME, STEP_EXPERIENCE, STEP_PLAN, STEP_DONE = 2, 3, 4, 5


def _profile(user) -> Profile:
    profile, _ = Profile.objects.get_or_create(user=user)
    return profile


def _advance(profile: Profile, to_step: int, event: str):
    """Each step saves on completion (ON-1); steps only move forward."""
    if profile.onboarding_step < to_step:
        profile.onboarding_step = to_step
    ActivityEvent.objects.create(user=profile.user, type=event)


class MeView(generics.RetrieveUpdateAPIView):
    """GET/PATCH /me: first name, last name, timezone."""

    serializer_class = MeSerializer
    http_method_names = ["get", "patch", "delete"]

    def get_object(self):
        _profile(self.request.user)
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


class ProfileView(APIView):
    """GET/PATCH /me/profile: study setup and trading background."""

    def get(self, request):
        return Response(ProfileSerializer(_profile(request.user)).data)

    @transaction.atomic
    def patch(self, request):
        profile = _profile(request.user)
        serializer = ProfileUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if "weekly_hours" in data:
            profile.weekly_hours = data["weekly_hours"]
        if "sessions" in data:
            profile.sessions = data["sessions"]
        if "experience" in data:
            profile.answers = {**(profile.answers or {}), "experience": data["experience"]}
            seed_never_again(request.user, data["experience"]["usual_mistakes"], data["experience"]["other_mistake"])
        profile.save()
        return Response(ProfileSerializer(profile).data)


class OnboardingTimeView(APIView):
    """PUT /me/onboarding/time: step 2 (ON-2)."""

    @transaction.atomic
    def put(self, request):
        serializer = TimeStepSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user = request.user
        user.timezone = data["timezone"]
        user.save(update_fields=["timezone", "updated_at"])
        profile = _profile(user)
        profile.weekly_hours = data["weekly_hours"]
        profile.sessions = data["sessions"]
        _advance(profile, STEP_EXPERIENCE, "onboarding_time_done")
        profile.save()
        return Response(ProfileSerializer(profile).data)


class OnboardingExperienceView(APIView):
    """PUT /me/onboarding/experience: step 3 (ON-3); seeds the never-again list."""

    @transaction.atomic
    def put(self, request):
        serializer = ExperienceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        experience = serializer.validated_data
        profile = _profile(request.user)
        if profile.onboarding_step < STEP_EXPERIENCE:
            raise Conflict("Finish the time and sessions step first.")
        profile.answers = {**(profile.answers or {}), "experience": experience}
        seed_never_again(request.user, experience["usual_mistakes"], experience["other_mistake"])
        _advance(profile, STEP_PLAN, "onboarding_experience_done")
        profile.save()
        return Response(ProfileSerializer(profile).data)


class PlanView(APIView):
    """GET /me/plan: step 4 (ON-4)."""

    def get(self, request):
        profile = _profile(request.user)
        if profile.onboarding_step < STEP_PLAN:
            raise Conflict("Finish the earlier onboarding steps first.")
        return Response(build_plan(request.user))


class AcceptPlanView(APIView):
    """POST /me/plan/accept: passes Gate 1 (ON-5)."""

    @transaction.atomic
    def post(self, request):
        profile = _profile(request.user)
        if profile.onboarding_step < STEP_PLAN:
            raise Conflict("Finish the earlier onboarding steps first.")
        if profile.plan_accepted_at is None:
            plan = build_plan(request.user)
            profile.plan_accepted_at = timezone.now()
            profile.style = plan["style"]["key"]
            _advance(profile, STEP_DONE, "plan_accepted")
            profile.save()
        gate_pass = grant_gate(
            request.user, gate=1, evidence={"plan_accepted_at": profile.plan_accepted_at.isoformat()}
        )
        return Response({"gate": 1, "passed_at": gate_pass.passed_at})


class NeverAgainViewSet(OwnedViewSetMixin, viewsets.ModelViewSet):
    queryset = NeverAgainItem.objects.all()
    serializer_class = NeverAgainSerializer
    pagination_class = None
