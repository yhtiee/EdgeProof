from django.conf import settings
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter

from apps.academy import views as academy
from apps.accounts import auth_views, views as accounts
from apps.core import views as core
from apps.gates import views as gates

router = DefaultRouter(trailing_slash=False)
router.register("jobs", core.JobViewSet, basename="job")
router.register("me/never-again", accounts.NeverAgainViewSet, basename="never-again")

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
    path("me/plan/accept", accounts.AcceptPlanView.as_view()),
    path("me/security/logout-all", auth_views.LogoutAllView.as_view()),
    path("me/gates", gates.MyGatesView.as_view()),
    path("me/gate-passes", gates.MyGatePassesView.as_view()),
    # Academy
    path("levels", academy.LevelListView.as_view()),
    path("lessons/<uuid:pk>/progress", academy.LessonProgressView.as_view()),
    path("exams/<uuid:pk>", academy.ExamDetailView.as_view()),
    path("exams/<uuid:pk>/attempts", academy.StartAttemptView.as_view()),
    path("attempts/<uuid:pk>/submit", academy.SubmitAttemptView.as_view()),
    path("questions/<uuid:pk>/report", academy.ReportQuestionView.as_view()),
    # Docs
    path("schema", SpectacularAPIView.as_view(), name="schema"),
    path("docs", SpectacularSwaggerView.as_view(url_name="schema")),
    path("", include(router.urls)),
]

urlpatterns = [
    path("api/v1/", include(api_v1)),
    path("internal/jobs/sweep", core.sweep),
    path("healthz", core.health),
    path(settings.ADMIN_URL, admin.site.urls),
]
