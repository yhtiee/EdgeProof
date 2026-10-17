import re

from rest_framework import serializers

from apps.core.models import UploadIntent
from apps.core.uploads import discard_uploads

from apps.strategy.models import StrategyVersion

from .models import PracticeRule, Trade, TradeImage, TradingAccount
from .plan import warnings_by_trade
from .services import EMOTIONS, SLEEP, derive

INSTRUMENT = re.compile(r"^[A-Z]{3}/?[A-Z]{3}$")


class TradingAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = TradingAccount
        fields = ["id", "name", "kind", "broker", "currency", "balance", "risk_per_trade_pct", "archived", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_currency(self, value):
        if not re.fullmatch(r"[A-Za-z]{3}", value):
            raise serializers.ValidationError("Use a 3-letter currency code, like USD.")
        return value.upper()

    def validate_risk_per_trade_pct(self, value):
        if not 0 < value <= 10:
            raise serializers.ValidationError("Between 0.01% and 10%.")
        return value


class PracticeRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = PracticeRule
        fields = ["id", "text", "order", "active"]
        read_only_fields = ["id"]


class RuleCheckSerializer(serializers.Serializer):
    rule = serializers.CharField(max_length=160)
    followed = serializers.BooleanField()


class ExitSerializer(serializers.Serializer):
    price = serializers.DecimalField(max_digits=14, decimal_places=6, min_value=0)
    size = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0)


class ImageSerializer(serializers.Serializer):
    key = serializers.CharField(max_length=255)
    kind = serializers.ChoiceField(choices=TradeImage.Kind.choices)


class TradeSerializer(serializers.ModelSerializer):
    account = serializers.PrimaryKeyRelatedField(queryset=TradingAccount.objects.none())
    strategy_version = serializers.PrimaryKeyRelatedField(queryset=StrategyVersion.objects.none(), required=False, allow_null=True)
    rule_checks = RuleCheckSerializer(many=True, required=False)
    exits = ExitSerializer(many=True, required=False)
    images = ImageSerializer(many=True, required=False)
    tags = serializers.ListField(child=serializers.CharField(max_length=30), max_length=12, required=False)
    emotion_before = serializers.ChoiceField(choices=[""] + EMOTIONS, required=False, allow_blank=True)
    emotion_after = serializers.ChoiceField(choices=[""] + EMOTIONS, required=False, allow_blank=True)
    sleep = serializers.ChoiceField(choices=[""] + SLEEP, required=False, allow_blank=True)
    confidence = serializers.IntegerField(min_value=1, max_value=5, required=False, allow_null=True)

    class Meta:
        model = Trade
        fields = [
            "id", "client_id", "account", "strategy_version", "instrument", "side", "entry", "initial_stop", "target", "exit_price",
            "exits", "size", "opened_at", "closed_at", "initial_risk_ccy", "gross_pnl", "fees", "swap",
            "pnl", "r_result", "r_estimated", "outcome", "market_session", "after_loss",
            "setup_key", "rule_checks", "rules_followed", "broken_rules",
            "emotion_before", "emotion_after", "confidence", "sleep", "distracted", "tags", "notes",
            "images", "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "pnl", "r_result", "r_estimated", "outcome", "market_session", "after_loss",
            "rules_followed", "broken_rules", "created_at", "updated_at",
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request:
            self.fields["account"].queryset = TradingAccount.objects.owned_by(request.user)
            self.fields["strategy_version"].queryset = StrategyVersion.objects.owned_by(request.user)

    def validate_instrument(self, value):
        value = value.strip().upper().replace(" ", "")
        if not INSTRUMENT.fullmatch(value):
            raise serializers.ValidationError("Use a currency pair, like EUR/USD.")
        return value if "/" in value else f"{value[:3]}/{value[3:]}"

    def validate_size(self, value):
        if value <= 0:
            raise serializers.ValidationError("Size must be more than 0 lots.")
        return value

    def validate_tags(self, value):
        return list(dict.fromkeys(t.strip().lower() for t in value if t.strip()))

    def validate_images(self, value):
        request = self.context["request"]
        keys = [i["key"] for i in value]
        confirmed = set(
            UploadIntent.objects.owned_by(request.user).filter(key__in=keys, confirmed_at__isnull=False).values_list("key", flat=True)
        )
        missing = [k for k in keys if k not in confirmed]
        if missing:
            raise serializers.ValidationError("A screenshot didn't finish uploading. Remove it and add it again.")
        if len(value) > 4:
            raise serializers.ValidationError("Up to 4 screenshots per trade.")
        return value

    def validate(self, attrs):
        # JR-3: the initial stop can't change once saved.
        if self.instance is not None and "initial_stop" in attrs:
            old, new = self.instance.initial_stop, attrs["initial_stop"]
            if old != new and not (old is not None and new is not None and old.compare(new) == 0):
                raise serializers.ValidationError({"initial_stop": ["The initial stop can't change after the trade is saved."]})
        return attrs

    def _save(self, instance, validated):
        images = validated.pop("images", None)
        for key, value in validated.items():
            if key in ("rule_checks", "exits"):
                value = [{k: str(v) if not isinstance(v, bool) else v for k, v in item.items()} for item in value]
            setattr(instance, key, value)
        derive(instance)
        instance.save()
        if images is not None:
            keep = {img["key"] for img in images}
            removed = [i.key for i in instance.images.all() if i.key not in keep]
            instance.images.all().delete()
            TradeImage.objects.bulk_create(TradeImage(user=instance.user, trade=instance, **img) for img in images)
            discard_uploads(instance.user, removed)
        return instance

    def create(self, validated):
        return self._save(Trade(user=self.context["request"].user), validated)

    def update(self, instance, validated):
        return self._save(instance, validated)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["images"] = [{"key": i.key, "kind": i.kind} for i in instance.images.all()]
        data["plan_warnings"] = self._plan().get(instance.id, []) if instance.strategy_version_id else []
        return data

    def _plan(self) -> dict:
        """SL-8 warnings, computed once per response (the list shares one context)."""
        if "_plan" not in self.context:
            from .views import user_tz

            request = self.context["request"]
            self.context["_plan"] = warnings_by_trade(request.user, user_tz(request.user))
        return self.context["_plan"]
