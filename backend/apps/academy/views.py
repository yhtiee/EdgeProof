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
from .services import start_attempt, submit_attempt


class LevelListView(generics.ListAPIView):
    """GET /levels"""

    serializer_class = LevelSerializer
    pagination_class = None
    queryset = Level.objects.filter(status=Level.Status.PUBLISHED).order_by("order")


class LessonProgressView(APIView):
    """POST /lessons/{id}/progress: saves per block (AC-10)."""

    permission_classes = [RequiresGate(1)]

    def post(self, request, pk):
        lesson = get_object_or_404(Lesson, pk=pk, status=Lesson.Status.PUBLISHED)
        progress, _ = LessonProgress.objects.get_or_create(user=request.user, lesson=lesson)
        blocks = set(progress.completed_blocks) | set(request.data.get("completed_blocks", []))
        progress.completed_blocks = sorted(int(b) for b in blocks)
        if lesson.block_count and len(progress.completed_blocks) >= lesson.block_count and not progress.completed_at:
            progress.completed_at = timezone.now()
            ActivityEvent.objects.create(user=request.user, type="lesson_completed", ref=str(lesson.id))
        progress.save()
        return Response(LessonProgressSerializer(progress).data)


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
