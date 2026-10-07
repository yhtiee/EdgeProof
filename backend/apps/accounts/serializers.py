from django.contrib.auth import password_validation
from django.utils import timezone
from rest_framework import serializers

from .models import NeverAgainItem, Profile, User


class RegisterSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    over_18 = serializers.BooleanField()

    def validate_over_18(self, value):
        if not value:
            raise serializers.ValidationError("EdgeProof is for adults. Confirm you are 18 or older to continue.")
        return value

    def validate(self, attrs):
        password_validation.validate_password(attrs["password"], User(email=attrs["email"], name=attrs["name"]))
        return attrs

    def create(self, data):
        # Same response whether or not the email exists is handled in the view.
        user = User.objects.create_user(email=data["email"], password=data["password"], name=data["name"])
        Profile.objects.create(user=user, over_18_confirmed_at=timezone.now())
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class MeSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "name", "timezone", "role", "email_verified_at", "created_at"]
        read_only_fields = ["id", "email", "role", "email_verified_at", "created_at"]


class ProfileSerializer(serializers.ModelSerializer):
    suggested_style = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = [
            "style",
            "sessions",
            "weekly_hours",
            "risk_comfort",
            "answers",
            "onboarding_step",
            "plan_accepted_at",
            "suggested_style",
        ]
        read_only_fields = ["plan_accepted_at", "suggested_style"]

    def get_suggested_style(self, profile: Profile) -> str:
        from .services import suggest_style

        return suggest_style(profile.weekly_hours or 0, profile.sessions or [])

    def validate_sessions(self, value):
        allowed = {"asia", "london", "new_york"}
        if not set(value) <= allowed:
            raise serializers.ValidationError("Sessions must be from: asia, london, new_york.")
        return value


class NeverAgainSerializer(serializers.ModelSerializer):
    class Meta:
        model = NeverAgainItem
        fields = ["id", "text", "order"]
