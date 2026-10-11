from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import ActivityEvent
from apps.gates.permissions import RequiresGate
from apps.gates.services import evaluate_gate_2, grant_gate

from .models import Exam, ExamAttempt, Lesson, LessonProgress, Level, Question
from .serializers import (
    AttemptSerializer,
    ExamSerializer,
    LessonProgressSerializer,
    LevelSerializer,
    QuestionReportSerializer,
    SubmitSerializer,
)
from .services import first_incomplete_before, start_attempt, submit_attempt


class LevelListView(generics.ListAPIView):
    """GET /levels"""

    serializer_class = LevelSerializer
    pagination_class = None
    queryset = Level.objects.filter(status=Level.Status.PUBLISHED).order_by("order")


class LessonProgressView(APIView):
    """
    POST /lessons/{slug}/progress: saves completed screens (AC-10). The client
    saves locally first and sends the full set again when it reconnects, so
    this merges and is safe to repeat.
    """

    permission_classes = [RequiresGate(1)]

    def post(self, request, slug):
        lesson = get_object_or_404(Lesson, slug=slug)
        serializer = LessonProgressSerializer(data=request.data, context={"lesson": lesson})
        serializer.is_valid(raise_exception=True)
        progress = LessonProgress.objects.filter(user=request.user, lesson=lesson).first()
        if progress is None:
            # Lessons open in order (spec §5). Already-started lessons can always be saved.
            blocker = first_incomplete_before(request.user, lesson)
            if blocker:
                return Response(
                    {
                        "code": "lesson_locked",
                        "message": f"Finish \"{blocker['title']}\" first. Lessons open in order.",
                        "fields": {},
                        "next": blocker["slug"],
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            progress = LessonProgress.objects.create(user=request.user, lesson=lesson)
        before = set(progress.completed_blocks)
        merged = before | set(serializer.validated_data["completed_blocks"])
        progress.completed_blocks = sorted(merged)
        if merged != before:
            ActivityEvent.objects.create(user=request.user, type="lesson_progress", ref=lesson.slug)
        if len(merged) >= lesson.block_count and not progress.completed_at:
            progress.completed_at = timezone.now()
            ActivityEvent.objects.create(user=request.user, type="lesson_completed", ref=lesson.slug)
        progress.save()
        return Response(LessonProgressSerializer(progress).data)


class MyLessonProgressView(generics.ListAPIView):
    """GET /me/lesson-progress: every lesson the user has started."""

    serializer_class = LessonProgressSerializer
    pagination_class = None

    def get_queryset(self):
        return LessonProgress.objects.owned_by(self.request.user).select_related("lesson")


class ExamDetailView(generics.RetrieveAPIView):
    """GET /exams/{id}"""

    serializer_class = ExamSerializer
    queryset = Exam.objects.filter(status=Exam.Status.PUBLISHED)


class StartAttemptView(APIView):
    """POST /exams/{id}/attempts: draws questions server-side, returns prompts only."""

    permission_classes = [RequiresGate(1)]

    def post(self, request, pk):
        exam = get_object_or_404(Exam, pk=pk, status=Exam.Status.PUBLISHED)
        attempt = start_attempt(request.user, exam)
        return Response(AttemptSerializer(attempt).data, status=status.HTTP_201_CREATED)


class SubmitAttemptView(APIView):
    """POST /attempts/{id}/submit: graded on the server."""

    def post(self, request, pk):
        attempt = get_object_or_404(ExamAttempt, pk=pk, user=request.user)
        serializer = SubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = submit_attempt(attempt, serializer.validated_data["answers"])
        ActivityEvent.objects.create(user=request.user, type="exam_attempt", ref=str(attempt.exam_id))

        if result["passed"] and attempt.exam.scope in (Exam.Scope.LEVEL, Exam.Scope.PLACEMENT):
            gate2 = evaluate_gate_2(request.user)
            if gate2["met"]:
                grant_gate(request.user, gate=2, evidence=gate2)
            result["gate_2"] = gate2
        return Response(result)


class ReportQuestionView(APIView):
    """POST /questions/{id}/report (AC-8)."""

    def post(self, request, pk):
        question = get_object_or_404(Question, pk=pk)
        serializer = QuestionReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user, question=question)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
