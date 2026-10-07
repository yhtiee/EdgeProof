"""
Authentication (spec §15).

Access tokens are short-lived and returned in the body (the client keeps them
in memory). The refresh token rotates and lives in an HttpOnly, Secure,
SameSite=Lax cookie scoped to /api/v1/auth/. Presenting an already-rotated
refresh token is treated as theft: every session of that user is revoked.
"""

from django.conf import settings
from django.contrib.auth import authenticate
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from apps.audit.models import AuditLog

from .models import ActivityEvent, User
from .serializers import LoginSerializer, RegisterSerializer

COOKIE = settings.REFRESH_COOKIE


def _issue(user: User, response: Response | None = None, status_code=status.HTTP_200_OK) -> Response:
    refresh = RefreshToken.for_user(user)
    response = response or Response(status=status_code)
    response.data = {"access": str(refresh.access_token)}
    _set_cookie(response, str(refresh))
    return response


def _set_cookie(response: Response, token: str):
    response.set_cookie(
        COOKIE["key"],
        token,
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        path=COOKIE["path"],
        httponly=COOKIE["httponly"],
        secure=COOKIE["secure"],
        samesite=COOKIE["samesite"],
    )


def _unverified_payload(raw: str) -> dict:
    """Signature still checked; expiry and blacklist are not. Used only to detect reuse."""
    try:
        return RefreshToken(raw, verify=False).payload
    except TokenError:
        return {}


def revoke_all_sessions(user_id) -> int:
    count = 0
    for token in OutstandingToken.objects.filter(user_id=user_id):
        _, created = BlacklistedToken.objects.get_or_create(token=token)
        count += int(created)
    return count


class AuthThrottleMixin:
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"


class RegisterView(AuthThrottleMixin, APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes: list = []

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                user = serializer.save()
        except IntegrityError:
            # Don't reveal that the account exists (spec §16): answer like a
            # successful signup that still needs verification.
            return Response(
                {"code": "check_email", "message": "Check your email to continue.", "fields": {}},
                status=status.HTTP_202_ACCEPTED,
            )
        ActivityEvent.objects.create(user=user, type="signup")
        return _issue(user, status_code=status.HTTP_201_CREATED)


class LoginView(AuthThrottleMixin, APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes: list = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(
            request, email=serializer.validated_data["email"].lower(), password=serializer.validated_data["password"]
        )
        if user is None or user.deletion_requested_at:
            return Response(
                {"code": "invalid_credentials", "message": "That email and password don't match an account.", "fields": {}},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        return _issue(user)


class RefreshView(AuthThrottleMixin, APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes: list = []

    def post(self, request):
        raw = request.COOKIES.get(COOKIE["key"])
        if not raw:
            return Response({"code": "no_session", "message": "Sign in again.", "fields": {}}, status=401)
        try:
            refresh = RefreshToken(raw)  # verifies signature, expiry and blacklist
        except TokenError:
            payload = _unverified_payload(raw)
            user_id, jti = payload.get("user_id"), payload.get("jti")
            if user_id and jti and BlacklistedToken.objects.filter(token__jti=jti).exists():
                # Reuse of a rotated token: revoke everything (spec §15).
                revoke_all_sessions(user_id)
                AuditLog.record(actor_id=user_id, action="auth.refresh_reuse_detected", target=f"user:{user_id}")
            response = Response({"code": "session_expired", "message": "Sign in again.", "fields": {}}, status=401)
            response.delete_cookie(COOKIE["key"], path=COOKIE["path"])
            return response

        user = User.objects.filter(id=refresh.payload.get("user_id"), is_active=True).first()
        if user is None:
            return Response({"code": "session_expired", "message": "Sign in again.", "fields": {}}, status=401)

        refresh.blacklist()
        return _issue(user)


class LogoutView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes: list = []

    def post(self, request):
        raw = request.COOKIES.get(COOKIE["key"])
        if raw:
            try:
                RefreshToken(raw).blacklist()
            except TokenError:
                pass
        response = Response(status=status.HTTP_204_NO_CONTENT)
        response.delete_cookie(COOKIE["key"], path=COOKIE["path"])
        return response


class LogoutAllView(APIView):
    """POST /me/security/logout-all (AS-1)."""

    def post(self, request):
        revoke_all_sessions(request.user.id)
        AuditLog.record(actor_id=request.user.id, action="auth.logout_all", target=f"user:{request.user.id}")
        response = Response(status=status.HTTP_204_NO_CONTENT)
        response.delete_cookie(COOKIE["key"], path=COOKIE["path"])
        return response


class GoogleSignInView(APIView):
    """POST /auth/google: django-allauth handles the Google exchange once credentials are configured."""

    permission_classes = [permissions.AllowAny]
    authentication_classes: list = []

    def post(self, request):
        if not settings.SOCIALACCOUNT_PROVIDERS["google"]["APP"]["client_id"]:
            return Response(
                {"code": "not_configured", "message": "Google sign-in isn't set up on this server yet.", "fields": {}},
                status=status.HTTP_501_NOT_IMPLEMENTED,
            )
        return Response(
            {"code": "not_implemented", "message": "Google sign-in is planned for Phase 1.", "fields": {}},
            status=status.HTTP_501_NOT_IMPLEMENTED,
        )


def touch_activity(user: User):
    user.profile.last_active_at = timezone.now()
    user.profile.save(update_fields=["last_active_at", "updated_at"])
