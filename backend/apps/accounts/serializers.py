from zoneinfo import available_timezones

from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import serializers

from .models import NeverAgainItem, Profile, User
from .services import MISTAKES, SESSIONS, YEARS_TRADING

_TIMEZONES = available_timezones()


def validate_timezone(value: str) -> str:
    if value not in _TIMEZONES:
        raise serializers.ValidationError("Choose a timezone from the list.")
    return value


class RegisterSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=80)
    last_name = serializers.CharField(max_length=80)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    over_18 = serializers.BooleanField()
    timezone = serializers.CharField(required=False, validators=[validate_timezone])

    def validate_over_18(self, value):
        if not value:
            raise serializers.ValidationError("EdgeProof is for adults. Confirm you are 18 or older to continue.")
        return value

    def validate(self, attrs):
        candidate = User(email=attrs["email"], first_name=attrs["first_name"], last_name=attrs["last_name"])
        try:
            password_validation.validate_password(attrs["password"], candidate)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": exc.messages})
        return attrs

    def create(self, data):
        extra = {"timezone": data["timezone"]} if data.get("timezone") else {}
        user = User.objects.create_user(
            email=data["email"],
            password=data["password"],
            first_name=data["first_name"].strip(),
            last_name=data["last_name"].strip(),
            **extra,
        )
        # AS-4: only the confirmation date is stored.
        Profile.objects.create(user=user, over_18_confirmed_at=timezone.now())
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class MeSerializer(serializers.ModelSerializer):
    """User data, editable from the profile section."""

    onboarding_step = serializers.IntegerField(source="profile.onboarding_step", read_only=True)
    plan_accepted_at = serializers.DateTimeField(source="profile.plan_accepted_at", read_only=True)
    # Development builds open every gate; the app shows where a lock would be.
    gates_open = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "timezone",
            "role",
            "email_verified_at",
            "onboarding_step",
            "plan_accepted_at",
            "gates_open",
            "created_at",
        ]
        read_only_fields = ["id", "email", "role", "email_verified_at", "created_at"]
        extra_kwargs = {"timezone": {"validators": [validate_timezone]}}

    def get_gates_open(self, user) -> bool:
        from apps.gates.services import gates_open

        return gates_open()

    def validate_first_name(self, value):
        if not value.strip():
            raise serializers.ValidationError("Enter your first name.")
        return value.strip()

    def validate_last_name(self, value):
        if not value.strip():
            raise serializers.ValidationError("Enter your last name.")
        return value.strip()


class ExperienceSerializer(serializers.Serializer):
    """ON-3: experience and history."""

    years_trading = serializers.ChoiceField(choices=list(YEARS_TRADING))
    accounts_blown = serializers.IntegerField(min_value=0, max_value=999)
    prop_challenges = serializers.IntegerField(min_value=0, max_value=999)
    usual_mistakes = serializers.ListField(
        child=serializers.ChoiceField(choices=list(MISTAKES)), allow_empty=True, max_length=len(MISTAKES)
    )
    other_mistake = serializers.CharField(max_length=160, allow_blank=True, required=False, default="")


class TimeStepSerializer(serializers.Serializer):
    """ON-2: weekly hours, timezone, sessions the user can watch."""

    weekly_hours = serializers.IntegerField(min_value=1, max_value=80)
    timezone = serializers.CharField(validators=[validate_timezone])
    sessions = serializers.ListField(child=serializers.ChoiceField(choices=list(SESSIONS)), allow_empty=True)


class ProfileSerializer(serializers.ModelSerializer):
    """Trader profile, editable from the profile section after onboarding."""

    experience = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = ["weekly_hours", "sessions", "experience", "onboarding_step", "plan_accepted_at"]
        read_only_fields = fields

    def get_experience(self, profile) -> dict | None:
        return (profile.answers or {}).get("experience")


class ProfileUpdateSerializer(serializers.Serializer):
    weekly_hours = serializers.IntegerField(min_value=1, max_value=80, required=False)
    sessions = serializers.ListField(child=serializers.ChoiceField(choices=list(SESSIONS)), required=False)
    experience = ExperienceSerializer(required=False)


class NeverAgainSerializer(serializers.ModelSerializer):
    class Meta:
        model = NeverAgainItem
        fields = ["id", "text", "order"]
