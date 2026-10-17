"""AI endpoints (spec §10, §15): settings and consent, tutor status, and the streamed tutor answer."""

import json

from django.conf import settings
from django.http import StreamingHttpResponse
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.renderers import BaseRenderer, JSONRenderer
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Profile

from . import providers, tutor


def _profile(user) -> Profile:
    return Profile.objects.get_or_create(user=user)[0]


def ai_settings(user) -> dict:
    s = _profile(user).settings or {}
    return {"ai_enabled": s.get("ai_enabled", True), "ai_tutor_consent": bool(s.get("ai_tutor_consent_at"))}


class AISettingsView(APIView):
    """GET/PATCH /me/settings/ai: switch AI off entirely, and per-feature consent (spec §10 Privacy)."""

    class Body(serializers.Serializer):
        ai_enabled = serializers.BooleanField(required=False)
        ai_tutor_consent = serializers.BooleanField(required=False)

    def get(self, request):
        return Response(ai_settings(request.user))

    def patch(self, request):
        body = self.Body(data=request.data)
        body.is_valid(raise_exception=True)
        profile = _profile(request.user)
        s = dict(profile.settings or {})
        if "ai_enabled" in body.validated_data:
            s["ai_enabled"] = body.validated_data["ai_enabled"]
        if "ai_tutor_consent" in body.validated_data:
            s["ai_tutor_consent_at"] = timezone.now().isoformat() if body.validated_data["ai_tutor_consent"] else None
        profile.settings = s
        profile.save(update_fields=["settings", "updated_at"])
        return Response(ai_settings(request.user))


def _blocker(user) -> tuple[int, dict] | None:
    """Why the tutor can't answer this user right now, or None."""
    if not providers.enabled():
        return status.HTTP_503_SERVICE_UNAVAILABLE, {"code": "ai_off", "message": "The tutor is switched off on this server."}
    prefs = ai_settings(user)
    if not prefs["ai_enabled"]:
        return status.HTTP_409_CONFLICT, {"code": "ai_disabled", "message": "AI features are off in your settings."}
    if not prefs["ai_tutor_consent"]:
        return status.HTTP_409_CONFLICT, {"code": "consent_required", "message": "The tutor needs your consent before its first answer."}
    if tutor.remaining(user) <= 0:
        return status.HTTP_429_TOO_MANY_REQUESTS, {
            "code": "tutor_limit",
            "message": f"You've used today's {settings.AI['daily_user_limit']} tutor questions. They reset at midnight your time.",
        }
    if tutor.breaker_tripped():
        return status.HTTP_503_SERVICE_UNAVAILABLE, {"code": "ai_paused", "message": "The tutor is paused for the rest of the month while costs are reviewed."}
    return None


class TutorStatusView(APIView):
    """GET /ai/tutor/status: whether the tutor can answer, and how many questions are left today."""

    def get(self, request):
        block = _blocker(request.user)
        chain = providers.chain()
        return Response({
            "available": block is None,
            "reason": block[1] if block else None,
            "remaining": tutor.remaining(request.user),
            "limit": settings.AI["daily_user_limit"],
            "provider": chain[0].name if chain else None,
            **ai_settings(request.user),
        })


class EventStreamRenderer(BaseRenderer):
    """Lets clients ask for text/event-stream; errors before the stream still go out as JSON text."""

    media_type = "text/event-stream"
    format = "sse"
    charset = "utf-8"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return json.dumps(data).encode()


class TutorAskView(APIView):
    """
    POST /ai/tutor {lesson, question}: a streamed answer as server-sent events
    (meta, text, reset, done | refused | error). Every check that can fail runs
    before the stream starts, so those come back as ordinary JSON errors.
    """

    renderer_classes = [JSONRenderer, EventStreamRenderer]

    class Body(serializers.Serializer):
        lesson = serializers.RegexField(r"^[a-z0-9-]{1,80}$")
        question = serializers.CharField(min_length=3, max_length=tutor.MAX_QUESTION, trim_whitespace=True)

    def post(self, request):
        body = self.Body(data=request.data)
        body.is_valid(raise_exception=True)
        block = _blocker(request.user)
        if block:
            code, payload = block
            return Response({**payload, "fields": {}}, status=code, content_type="application/json")
        if tutor.lesson_text(body.validated_data["lesson"]) is None:
            return Response({"code": "not_found", "message": "That lesson isn't published.", "fields": {}}, status=404, content_type="application/json")

        events = tutor.answer_events(request.user, body.validated_data["lesson"], body.validated_data["question"])

        def sse():
            for event in events:
                yield f"data: {json.dumps(event)}\n\n"

        response = StreamingHttpResponse(sse(), content_type="text/event-stream")
        response["Cache-Control"] = "no-store"
        response["X-Accel-Buffering"] = "no"
        return response
