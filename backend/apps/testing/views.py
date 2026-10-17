from datetime import datetime, time
from zoneinfo import ZoneInfo

from django.db import transaction
from django.db.models import ProtectedError, Q
from django.http import HttpResponse
from django.utils.dateparse import parse_date
from rest_framework import status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import CursorPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import ActivityEvent
from apps.core.exceptions import Conflict
from apps.core.uploads import discard_uploads
from apps.core.views import OwnedViewSetMixin

from .models import PracticeRule, Trade, TradingAccount
from .serializers import (
    PracticeRuleSerializer,
    TradeSerializer,
    TradingAccountSerializer,
)
from .services import ensure_defaults, export_csv, refresh_after_loss


class TradingAccountViewSet(OwnedViewSetMixin, viewsets.ModelViewSet):
    """GET/POST /me/trading-accounts (JR-2)."""

    queryset = TradingAccount.objects.all()
    serializer_class = TradingAccountSerializer
    pagination_class = None

    def list(self, request, *args, **kwargs):
        ensure_defaults(request.user)
        return super().list(request, *args, **kwargs)

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except ProtectedError as exc:
            raise Conflict("This account has trades. Archive it instead.") from exc


class PracticeRuleViewSet(OwnedViewSetMixin, viewsets.ModelViewSet):
    """The practice checklist (JR-5)."""

    queryset = PracticeRule.objects.all()
    serializer_class = PracticeRuleSerializer
    pagination_class = None

    def list(self, request, *args, **kwargs):
        ensure_defaults(request.user)
        return super().list(request, *args, **kwargs)


class TradePagination(CursorPagination):
    ordering = ("-opened_at", "-created_at")
    page_size = 50
    page_size_query_param = "limit"
    max_page_size = 200


def user_tz(user):
    try:
        return ZoneInfo(user.timezone)
    except Exception:  # noqa: BLE001 (unknown zone in old data)
        return ZoneInfo("UTC")


def filter_trades(request, qs):
    """Shared by the list, metrics and export (JR-9)."""
    p = request.query_params
    if p.get("account"):
        qs = qs.filter(account_id=p["account"])
    if p.get("instrument"):
        qs = qs.filter(instrument=p["instrument"].upper())
    if p.get("outcome"):
        qs = qs.filter(outcome=p["outcome"])
    if p.get("rules") in ("followed", "broken"):
        qs = qs.filter(rules_followed=p["rules"] == "followed")
    tz = user_tz(request.user)
    if p.get("from") and (day := parse_date(p["from"])):
        qs = qs.filter(opened_at__gte=datetime.combine(day, time.min, tz))
    if p.get("to") and (day := parse_date(p["to"])):
        qs = qs.filter(opened_at__lte=datetime.combine(day, time.max, tz))
    if q := p.get("q", "").strip():
        qs = qs.filter(
            Q(notes__icontains=q) | Q(setup_key__icontains=q) | Q(instrument__icontains=q.replace(" ", ""))
            | Q(tags__icontains=q) | Q(broken_rules__icontains=q)
        )
    return qs


class TradeViewSet(OwnedViewSetMixin, viewsets.ModelViewSet):
    """GET/POST /me/trades, GET/PATCH/DELETE /me/trades/{id} (JR-1 to JR-6, JR-9)."""

    queryset = Trade.objects.select_related("account").prefetch_related("images")
    serializer_class = TradeSerializer
    pagination_class = TradePagination

    def get_queryset(self):
        qs = super().get_queryset()
        return filter_trades(self.request, qs) if self.action == "list" else qs

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        # A resend from an offline device carries the same client_id: update, don't duplicate.
        client_id = str(request.data.get("client_id", "")).strip()
        existing = Trade.objects.owned_by(request.user).filter(client_id=client_id).first() if client_id else None
        serializer = self.get_serializer(existing, data=request.data, partial=existing is not None)
        serializer.is_valid(raise_exception=True)
        trade = serializer.save()
        refresh_after_loss(request.user)
        if existing is None:
            ActivityEvent.objects.create(user=request.user, type="trade_logged", ref=str(trade.id))
        trade.refresh_from_db()
        body = self.get_serializer(trade).data
        return Response(body, status=status.HTTP_200_OK if existing else status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        serializer.save()
        refresh_after_loss(self.request.user)

    def perform_destroy(self, instance):
        keys = [i.key for i in instance.images.all()]
        instance.delete()
        discard_uploads(self.request.user, keys)
        refresh_after_loss(self.request.user)


class ExportView(APIView):
    """GET /me/trades/export.csv (JR-10): every cell formula-escaped."""

    def get(self, request):
        response = HttpResponse(export_csv(request.user), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="edgeproof-journal.csv"'
        response["Cache-Control"] = "no-store"
        return response


def require_account(request, account_id):
    if account_id and not TradingAccount.objects.owned_by(request.user).filter(id=account_id).exists():
        raise ValidationError({"account": ["Unknown account."]})
