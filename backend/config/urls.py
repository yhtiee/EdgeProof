from django.conf import settings
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter

from apps.academy import views as academy
from apps.accounts import auth_views
from apps.accounts import views as accounts
from apps.ai import views as ai
from apps.analytics import views as analytics
from apps.core import uploads
from apps.core import views as core
from apps.discipline import views as discipline
from apps.gates import views as gates
from apps.scanner import views as scanner
from apps.strategy import views as strategy
from apps.testing import views as testing

router = DefaultRouter(trailing_slash=False)
router.register("jobs", core.JobViewSet, basename="job")
router.register("me/never-again", accounts.NeverAgainViewSet, basename="never-again")
router.register("me/trading-accounts", testing.TradingAccountViewSet, basename="trading-account")
router.register("me/practice-rules", testing.PracticeRuleViewSet, basename="practice-rule")
router.register("me/trades", testing.TradeViewSet, basename="trade")
router.register("me/reviews", discipline.ReviewViewSet, basename="review")
router.register("strategies", strategy.StrategyViewSet, basename="strategy")

api_v1 = [
    # Auth
    path("auth/register", auth_views.RegisterView.as_view()),
    path("auth/login", auth_views.LoginView.as_view()),
    path("auth/refresh", auth_views.RefreshView.as_view()),
    path("auth/logout", auth_views.LogoutView.as_view()),
    path("auth/google", auth_views.GoogleSignInView.as_view()),
    # Profile and gates
    path("me", accounts.MeView.as_view()),
    path("me/profile", accounts.ProfileView.as_view()),
    path("me/onboarding/time", accounts.OnboardingTimeView.as_view()),
    path("me/onboarding/experience", accounts.OnboardingExperienceView.as_view()),
    path("me/plan", accounts.PlanView.as_view()),
    path("me/plan/accept", accounts.AcceptPlanView.as_view()),
    path("me/security/logout-all", auth_views.LogoutAllView.as_view()),
    path("me/gates", gates.MyGatesView.as_view()),
    path("me/gate-passes", gates.MyGatePassesView.as_view()),
    path("me/progress", gates.MyProgressView.as_view()),
    # Academy
    path("levels", academy.LevelListView.as_view()),
    path("lessons/<slug:slug>/progress", academy.LessonProgressView.as_view()),
    path("me/lesson-progress", academy.MyLessonProgressView.as_view()),
    path("me/exams", academy.MyExamsView.as_view()),
    path("exams/<slug:key>", academy.ExamDetailView.as_view()),
    path("exams/<slug:key>/attempts", academy.StartAttemptView.as_view()),
    path("attempts/<uuid:pk>/submit", academy.SubmitAttemptView.as_view()),
    path("questions/<uuid:pk>/report", academy.ReportQuestionView.as_view()),
    # Journal and metrics
    path("me/trades/export.csv", testing.ExportView.as_view()),
    path("me/journal/metrics", analytics.JournalMetricsView.as_view()),
    path("me/journal/breakdowns", analytics.JournalBreakdownsView.as_view()),
    path("me/journal/activity", analytics.JournalActivityView.as_view()),
    # Strategy Lab
    path("strategy-lab/access", strategy.LabAccessView.as_view()),
    path("versions/<uuid:pk>", strategy.VersionView.as_view()),
    path("versions/<uuid:pk>/clarity-check", strategy.ClarityCheckView.as_view()),
    path("versions/<uuid:pk>/gate-3", strategy.Gate3View.as_view()),
    path("versions/<uuid:pk>/examples", strategy.ExampleListView.as_view()),
    path("examples/<uuid:pk>", strategy.ExampleView.as_view()),
    # AI (spec §10)
    path("me/settings/ai", ai.AISettingsView.as_view()),
    path("ai/tutor/status", ai.TutorStatusView.as_view()),
    path("ai/tutor", ai.TutorAskView.as_view()),
    # Fundamental Bias Scanner (signed-in users, no gate)
    path("scanner/pairs", scanner.PairsView.as_view()),
    path("scanner/scoreboard", scanner.ScoreboardView.as_view()),
    path("scanner/pairs/<str:symbol>", scanner.PairDetailView.as_view()),
    path("scanner/pairs/<str:symbol>/history", scanner.PairHistoryView.as_view()),
    path("scanner/currencies", scanner.CurrenciesView.as_view()),
    path("scanner/status", scanner.StatusView.as_view()),
    path("scanner/evidence", scanner.EvidenceView.as_view()),
    path("scanner/factor/<str:subject>/<str:factor>", scanner.FactorEvidenceView.as_view()),
    path("scanner/explain/status", scanner.ExplainStatusView.as_view()),
    path("scanner/explain", scanner.ExplainView.as_view()),
    path("scanner/calendar/<str:subject>", scanner.CalendarView.as_view()),
    # Uploads
    path("uploads/presign", uploads.PresignView.as_view()),
    path("uploads/<path:key>/local", uploads.LocalUploadView.as_view()),
    path("uploads/<path:key>/confirm", uploads.ConfirmUploadView.as_view()),
    path("uploads/<path:key>", uploads.UploadView.as_view()),
    # Docs
    path("schema", SpectacularAPIView.as_view(), name="schema"),
    path("docs", SpectacularSwaggerView.as_view(url_name="schema")),
    path("", include(router.urls)),
]

urlpatterns = [
    path("api/v1/", include(api_v1)),
    path("internal/jobs/sweep", core.sweep),
    path("internal/scanner/<str:name>", scanner.scheduled_job),
    path("healthz", core.health),
    path(settings.ADMIN_URL, admin.site.urls),
]
