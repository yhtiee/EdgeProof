"""Guided reviews (JR-8): daily 3 questions, weekly 5, from the Level 3 routines lesson."""

from datetime import timedelta

from django.db import transaction
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.response import Response

from apps.accounts.models import ActivityEvent
from apps.core.views import OwnedViewSetMixin

from .models import Review

QUESTIONS = {
    "daily": [
        "Did I follow my rules on every trade?",
        "If not, what pulled me off them?",
        "What will I do differently tomorrow?",
    ],
    "weekly": [
        "How many trades followed every rule?",
        "What did rule-breaking trades cost me in R?",
        "Did any mistake repeat?",
        "Did anything in my state (sleep, stress, time) affect my trading?",
        "What's one thing to focus on next week?",
    ],
}


class ReviewSerializer(serializers.ModelSerializer):
    answers = serializers.DictField(child=serializers.CharField(max_length=2000, allow_blank=True))

    class Meta:
        model = Review
        fields = ["id", "kind", "period", "answers", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        kind = attrs.get("kind", getattr(self.instance, "kind", None))
        period = attrs.get("period", getattr(self.instance, "period", None))
        if kind == Review.Kind.WEEKLY and period and period.weekday() != 0:
            attrs["period"] = period - timedelta(days=period.weekday())  # the week's Monday
        expected = {f"q{i + 1}" for i in range(len(QUESTIONS[kind]))}
        answers = attrs.get("answers", {})
        if set(answers) - expected:
            raise serializers.ValidationError({"answers": ["Unknown question."]})
        if not any(v.strip() for v in answers.values()):
            raise serializers.ValidationError({"answers": ["Answer at least one question."]})
        return attrs


class ReviewViewSet(OwnedViewSetMixin, mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    """GET /me/reviews?kind=, POST /me/reviews (saves or replaces that period's review)."""

    queryset = Review.objects.all()
    serializer_class = ReviewSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        kind = self.request.query_params.get("kind")
        return qs.filter(kind=kind) if kind in QUESTIONS else qs

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        response.data["questions"] = QUESTIONS
        return response

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        review, created = Review.objects.update_or_create(
            user=request.user, kind=data["kind"], period=data["period"], defaults={"answers": data["answers"]}
        )
        if created:
            ActivityEvent.objects.create(user=request.user, type=f"review_{review.kind}", ref=str(review.id))
        return Response(ReviewSerializer(review).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
