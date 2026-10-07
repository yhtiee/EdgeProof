from rest_framework import serializers

from .models import Exam, ExamAttempt, Lesson, LessonProgress, Level, Module, Question, QuestionReport


class LearnerQuestionSerializer(serializers.ModelSerializer):
    """What a learner sees. Never add `answer` or `tolerance` here (spec §15; enforced by a test)."""

    class Meta:
        model = Question
        fields = ["id", "type", "prompt", "options"]


class LessonSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lesson
        fields = ["id", "slug", "order", "title", "block_count"]


class ModuleSerializer(serializers.ModelSerializer):
    lessons = serializers.SerializerMethodField()

    class Meta:
        model = Module
        fields = ["id", "order", "title", "lessons"]

    def get_lessons(self, module):
        qs = module.lessons.filter(status=Lesson.Status.PUBLISHED)
        return LessonSerializer(qs, many=True).data


class LevelSerializer(serializers.ModelSerializer):
    modules = serializers.SerializerMethodField()

    class Meta:
        model = Level
        fields = ["id", "order", "title", "modules"]

    def get_modules(self, level):
        qs = level.modules.filter(status=Module.Status.PUBLISHED)
        return ModuleSerializer(qs, many=True).data


class ExamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Exam
        fields = ["id", "title", "scope", "level", "module", "draw_count", "pass_mark"]


class AttemptSerializer(serializers.ModelSerializer):
    questions = serializers.SerializerMethodField()

    class Meta:
        model = ExamAttempt
        fields = ["id", "exam", "started_at", "submitted_at", "score", "passed", "questions"]

    def get_questions(self, attempt):
        by_id = {str(q.id): q for q in Question.objects.filter(id__in=attempt.drawn_question_ids)}
        return LearnerQuestionSerializer([by_id[i] for i in attempt.drawn_question_ids], many=True).data


class SubmitSerializer(serializers.Serializer):
    answers = serializers.DictField(child=serializers.JSONField())


class LessonProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = LessonProgress
        fields = ["lesson", "completed_blocks", "completed_at"]
        read_only_fields = ["lesson", "completed_at"]


class QuestionReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionReport
        fields = ["id", "reason", "status", "created_at"]
        read_only_fields = ["id", "status", "created_at"]
