from django.db import models

from apps.core.models import BaseModel, OwnedModel


class Publishable(BaseModel):
    class Status(models.TextChoices):
        DRAFT = "draft"
        PUBLISHED = "published"

    order = models.PositiveSmallIntegerField()
    title = models.CharField(max_length=160)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT, db_index=True)
    version = models.PositiveIntegerField(default=1)

    class Meta:
        abstract = True
        ordering = ["order"]

    def __str__(self):
        return self.title


class Level(Publishable):
    slug = models.SlugField(max_length=80, unique=True)
    phase = models.PositiveSmallIntegerField(default=1)


class Module(Publishable):
    level = models.ForeignKey(Level, on_delete=models.CASCADE, related_name="modules")
    slug = models.SlugField(max_length=80, unique=True)


class Lesson(Publishable):
    """
    Lesson metadata. Lesson *content* is Markdown in the frontend repo,
    compiled to static JSON (spec §5); `slug` links the two. Rows are written
    by `manage.py sync_curriculum`, never edited by hand.
    """

    module = models.ForeignKey(Module, on_delete=models.CASCADE, related_name="lessons")
    slug = models.SlugField(max_length=80, unique=True)
    block_count = models.PositiveSmallIntegerField(default=0)  # screens in the compiled lesson
    minutes = models.PositiveSmallIntegerField(default=5)


class LessonBlock(BaseModel):
    """Typed blocks (AC-1), kept for server-side references such as embedded questions."""

    class Type(models.TextChoices):
        TEXT = "text"
        SIMULATOR = "simulator"
        DIAGRAM = "diagram"
        QUESTION = "question"
        GLOSSARY = "glossary"
        TAKEAWAY = "takeaway"
        CHART_DRILL = "chart_drill"

    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="blocks")
    type = models.CharField(max_length=16, choices=Type.choices)
    content = models.JSONField(default=dict)
    order = models.PositiveSmallIntegerField()

    class Meta(BaseModel.Meta):
        ordering = ["order"]


class Question(BaseModel):
    Status = Publishable.Status

    class Type(models.TextChoices):
        MULTIPLE_CHOICE = "multiple_choice"
        NUMERIC = "numeric"
        MULTI_SELECT = "multi_select"  # Phase 2
        ORDERING = "ordering"  # Phase 2
        CHART_MARK = "chart_mark"  # Phase 2

    key = models.SlugField(max_length=100, unique=True, null=True, blank=True)  # stable id from content/exams
    type = models.CharField(max_length=24, choices=Type.choices)
    prompt = models.TextField()
    options = models.JSONField(default=list, blank=True)  # [{"key": "a", "text": "..."}]
    answer = models.JSONField()  # never sent to learners (AC-5, §15)
    tolerance = models.FloatField(null=True, blank=True)  # numeric: absolute tolerance
    unit = models.CharField(max_length=24, blank=True)  # numeric: shown beside the answer box, e.g. "pips"
    explanation = models.TextField(blank=True)  # shown after answering ("why")
    concept_tags = models.JSONField(default=list, blank=True)  # lesson slugs this question tests
    status = models.CharField(max_length=16, choices=Publishable.Status.choices, default=Publishable.Status.DRAFT)
    flagged = models.BooleanField(default=False)  # AC-8: pass-rate outlier or confirmed report

    def __str__(self):
        return self.prompt[:60]

    def is_correct(self, response) -> bool:
        if self.type == self.Type.NUMERIC:
            try:
                return abs(float(response) - float(self.answer)) <= (self.tolerance or 0)
            except (TypeError, ValueError):
                return False
        if self.type == self.Type.MULTI_SELECT:
            return sorted(response or []) == sorted(self.answer)
        return response == self.answer


class Exam(BaseModel):
    Status = Publishable.Status

    class Scope(models.TextChoices):
        MODULE = "module"
        LEVEL = "level"
        PLACEMENT = "placement"

    key = models.SlugField(max_length=80, unique=True, null=True, blank=True)  # m-<module>, l-<level>, p-<level>
    title = models.CharField(max_length=160)
    scope = models.CharField(max_length=16, choices=Scope.choices)
    level = models.ForeignKey(Level, on_delete=models.CASCADE, related_name="exams")
    module = models.ForeignKey(Module, null=True, blank=True, on_delete=models.CASCADE, related_name="exams")
    bank = models.ManyToManyField(Question, related_name="exams")
    draw_count = models.PositiveSmallIntegerField(default=10)
    pass_mark = models.FloatField(default=0.8)  # placement exams use 0.9 (§5)
    cooldown_hours = models.PositiveSmallIntegerField(default=24)
    status = models.CharField(max_length=16, choices=Publishable.Status.choices, default=Publishable.Status.DRAFT)

    def __str__(self):
        return self.title


class ExamAttempt(OwnedModel):
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name="attempts")
    drawn_question_ids = models.JSONField(default=list)
    answers = models.JSONField(default=dict, blank=True)
    score = models.FloatField(null=True, blank=True)
    passed = models.BooleanField(null=True, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True, blank=True)


class LessonProgress(OwnedModel):
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="+")
    completed_blocks = models.JSONField(default=list)  # screen indexes; AC-10 saves per screen
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta(OwnedModel.Meta):
        constraints = [models.UniqueConstraint(fields=["user", "lesson"], name="lessonprogress_unique")]


class ReviewCard(OwnedModel):
    """Spaced repetition at 1, 3, 7, 21 days (AC-9, Phase 2)."""

    concept = models.CharField(max_length=80)
    question = models.ForeignKey(Question, null=True, on_delete=models.SET_NULL, related_name="+")
    due_at = models.DateTimeField(db_index=True)
    interval = models.PositiveSmallIntegerField(default=1)


class QuestionReport(OwnedModel):
    class Status(models.TextChoices):
        OPEN = "open"
        CONFIRMED = "confirmed"
        DISMISSED = "dismissed"

    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="reports")
    reason = models.TextField(max_length=1000)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN)
