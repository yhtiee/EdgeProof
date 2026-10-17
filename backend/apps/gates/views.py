from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import GatePass
from .progress import progress
from .services import evaluate_gate_2, has_gate


class GatePassSerializer(serializers.ModelSerializer):
    class Meta:
        model = GatePass
        fields = ["id", "gate", "passed_at", "evidence", "config_version", "revoked_at", "revoke_reason"]


class MyGatesView(APIView):
    """GET /me/gates: user-scoped gates as a checklist (Gate card, DESIGN.md §7)."""

    def get(self, request):
        user = request.user
        profile = getattr(user, "profile", None)
        gate2 = evaluate_gate_2(user)
        return Response(
            [
                {
                    "gate": 1,
                    "unlocks": "Academy",
                    "passed": has_gate(user, 1),
                    "criteria": [{"name": "Plan accepted", "met": bool(profile and profile.plan_accepted_at)}],
                },
                {
                    "gate": 2,
                    "unlocks": "Testing in the Strategy Lab",
                    "passed": has_gate(user, 2),
                    "criteria": [
                        {"name": f"Level {c['level']}: {c['title']} exam passed", "met": c["met"]} for c in gate2["criteria"]
                    ],
                },
            ]
        )


class MyGatePassesView(APIView):
    """GET /me/gate-passes: history, including revocations."""

    def get(self, request):
        passes = GatePass.objects.owned_by(request.user).order_by("-passed_at")
        return Response(GatePassSerializer(passes, many=True).data)


class MyProgressView(APIView):
    """GET /me/progress: the whole path (gates, levels, Lab) with what's done and what's left."""

    def get(self, request):
        return Response(progress(request.user))
