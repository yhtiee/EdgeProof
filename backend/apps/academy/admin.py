from django.contrib import admin

from .models import Exam, Lesson, Level, Module, Question, QuestionReport


@admin.register(Level)
class LevelAdmin(admin.ModelAdmin):
    list_display = ["order", "title", "status", "version"]
    list_filter = ["status"]


@admin.register(Module)
class ModuleAdmin(admin.ModelAdmin):
    list_display = ["title", "level", "order", "status"]
    list_filter = ["level", "status"]


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ["title", "slug", "module", "order", "status"]
    list_filter = ["module__level", "status"]
    prepopulated_fields = {"slug": ["title"]}


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ["__str__", "type", "status", "flagged"]
    list_filter = ["type", "status", "flagged"]
    search_fields = ["prompt"]


@admin.register(Exam)
class ExamAdmin(admin.ModelAdmin):
    list_display = ["title", "scope", "level", "draw_count", "pass_mark", "status"]
    list_filter = ["scope", "level", "status"]
    filter_horizontal = ["bank"]


@admin.register(QuestionReport)
class QuestionReportAdmin(admin.ModelAdmin):
    list_display = ["question", "status", "created_at"]
    list_filter = ["status"]
    fields = ["question", "reason", "status"]
    readonly_fields = ["question", "reason"]
