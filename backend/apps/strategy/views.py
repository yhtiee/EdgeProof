"""Strategy Lab API (rulebook-builder.md §3.6). Every queryset is the user's own."""

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.uploads import discard_uploads
from apps.core.views import OwnedViewSetMixin

from . import services
from .models import RuleExample, Strategy, StrategyVersion
from .serializers import (
    AutosaveSerializer,
    NewVersionSerializer,
    RuleExampleSerializer,
    StrategySerializer,
    VersionSerializer,
    VersionSummarySerializer,
)


class LabAccessView(APIView):
    """GET /strategy-lab/access: whether drafting is open, and what's left to open it."""

    def get(self, request):
        return Response(services.draft_access(request.user))


class StrategyViewSet(OwnedViewSetMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """GET/POST /strategies, GET/PATCH /strategies/{id} (rename, archive)."""

    queryset = Strategy.objects.all()
    serializer_class = StrategySerializer
    pagination_class = None

    def create(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        strategy = services.create_strategy(request.user, serializer.validated_data["name"])
        return Response(self.get_serializer(strategy).data, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def perform_update(self, serializer):
        strategy = serializer.instance
        new_status = serializer.validated_data.get("status")
        if new_status == Strategy.Status.ACTIVE and strategy.status != Strategy.Status.ACTIVE:
            services.check_limit(self.request.user)
        serializer.save()

    @action(detail=True, methods=["get", "post"])
    def versions(self, request, pk=None):
        """GET history; POST {reason} creates the next version from the latest locked one."""
        strategy = self.get_object()
        if request.method == "POST":
            body = NewVersionSerializer(data=request.data)
            body.is_valid(raise_exception=True)
            version = services.new_version(strategy, body.validated_data["reason"])
            return Response(VersionSerializer(version).data, status=status.HTTP_201_CREATED)
        rows = []
        for v in strategy.versions.order_by("-number"):
            row = VersionSummarySerializer(v).data
            row["trades"] = v.trades.count()
            rows.append(row)
        return Response(rows)


def owned_version(request, pk) -> StrategyVersion:
    return get_object_or_404(StrategyVersion.objects.select_related("strategy"), pk=pk, user=request.user)


class VersionView(APIView):
    """GET /versions/{id}; PATCH autosaves {rules?, risk_plan?, cost_model?, revision}."""

    def get(self, request, pk):
        version = owned_version(request, pk)
        data = VersionSerializer(version).data
        data["fit"] = services.profile_fit(version.rules, services.profile_of(request.user))
        return Response(data)

    def patch(self, request, pk):
        version = owned_version(request, pk)
        body = AutosaveSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        changes = {k: v for k, v in body.validated_data.items() if k != "revision"}
        version = services.autosave(version, changes, body.validated_data["revision"])
        return Response({"revision": version.revision, "updated_at": version.updated_at})


class ClarityCheckView(APIView):
    """POST /versions/{id}/clarity-check: the server's report (the one Gate 3 uses)."""

    def post(self, request, pk):
        return Response(services.run_clarity(owned_version(request, pk)))


class Gate3View(APIView):
    """POST /versions/{id}/gate-3: re-check on the server; if every check passes, lock and grant Gate 3."""

    def post(self, request, pk):
        version = services.pass_gate_3(owned_version(request, pk))
        return Response(VersionSerializer(version).data)


class ExampleListView(APIView):
    """POST /versions/{id}/examples."""

    def post(self, request, pk):
        version = owned_version(request, pk)
        serializer = RuleExampleSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        example = serializer.save(user=request.user, version=version)
        if not version.locked:
            version.clarity_status = StrategyVersion.Clarity.UNCHECKED
            version.save(update_fields=["clarity_status", "updated_at"])
        return Response(RuleExampleSerializer(example).data, status=status.HTTP_201_CREATED)


class ExampleView(APIView):
    """PATCH /examples/{id} (note, annotations); DELETE (drafts only: locked versions keep their examples)."""

    def get_object(self, request, pk) -> RuleExample:
        return get_object_or_404(RuleExample.objects.select_related("version"), pk=pk, user=request.user)

    def patch(self, request, pk):
        example = self.get_object(request, pk)
        serializer = RuleExampleSerializer(example, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        # Which rule and which screenshot an example shows never change; on a locked version, neither does valid/invalid.
        for key in ("rule_key", "image_key", *(("valid",) if example.version.locked else ())):
            serializer.validated_data.pop(key, None)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        example = self.get_object(request, pk)
        if example.version.locked:
            raise services.LabConflict("version_locked", "Examples on a locked version stay; add another instead.")
        key = example.image_key
        example.delete()
        if not RuleExample.objects.filter(user=request.user, image_key=key).exists():
            discard_uploads(request.user, [key])
        return Response(status=status.HTTP_204_NO_CONTENT)
