from rest_framework import serializers

from apps.core.models import UploadIntent

from .models import RuleExample, Strategy, StrategyVersion


class VersionSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = StrategyVersion
        fields = ["id", "number", "reason", "kind", "clarity_status", "locked", "locked_at", "created_at", "updated_at"]


class StrategySerializer(serializers.ModelSerializer):
    latest = serializers.SerializerMethodField()
    versions = serializers.SerializerMethodField()

    class Meta:
        model = Strategy
        fields = ["id", "name", "status", "latest", "versions", "created_at", "updated_at"]
        read_only_fields = ["id", "latest", "versions", "created_at", "updated_at"]

    def validate_name(self, value):
        value = value.strip()
        if not 3 <= len(value) <= 60:
            raise serializers.ValidationError("Use 3 to 60 characters.")
        return value

    def get_latest(self, strategy):
        v = strategy.versions.order_by("-number").first()
        if not v:
            return None
        data = VersionSummarySerializer(v).data
        report = v.clarity_report or {}
        data["fails"] = sum(1 for i in report.get("items", []) if i["severity"] == "fail") if report else None
        return data

    def get_versions(self, strategy):
        return strategy.versions.count()


class RuleExampleSerializer(serializers.ModelSerializer):
    class Meta:
        model = RuleExample
        fields = ["id", "rule_key", "valid", "image_key", "note", "annotations", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_note(self, value):
        if len(value.strip()) < 5:
            raise serializers.ValidationError("A sentence on why this chart counts, or doesn't.")
        return value.strip()

    def validate_annotations(self, value):
        if not isinstance(value, list) or len(value) > 12:
            raise serializers.ValidationError("Up to 12 marks.")
        for mark in value:
            if not isinstance(mark, dict) or mark.get("shape") not in ("arrow", "box"):
                raise serializers.ValidationError("Marks are arrows or boxes.")
            for k in ("x1", "y1", "x2", "y2"):
                v = mark.get(k)
                if not isinstance(v, (int, float)) or not 0 <= v <= 1:
                    raise serializers.ValidationError("Mark positions are between 0 and 1.")
        return [{k: m[k] for k in ("shape", "x1", "y1", "x2", "y2")} for m in value]

    def validate_image_key(self, value):
        user = self.context["request"].user
        if not UploadIntent.objects.owned_by(user).filter(key=value, confirmed_at__isnull=False).exists():
            raise serializers.ValidationError("The screenshot didn't finish uploading. Add it again.")
        return value


class VersionSerializer(serializers.ModelSerializer):
    examples = RuleExampleSerializer(many=True, read_only=True)
    strategy = serializers.SerializerMethodField()

    class Meta:
        model = StrategyVersion
        fields = [
            "id", "strategy", "number", "reason", "rules", "risk_plan", "cost_model", "kind", "clarity_status",
            "clarity_report", "locked", "locked_at", "revision", "examples", "created_at", "updated_at",
        ]
        read_only_fields = fields

    def get_strategy(self, v):
        return {"id": str(v.strategy_id), "name": v.strategy.name, "status": v.strategy.status}


class AutosaveSerializer(serializers.Serializer):
    revision = serializers.IntegerField(min_value=0)
    rules = serializers.JSONField(required=False)
    risk_plan = serializers.JSONField(required=False)
    cost_model = serializers.JSONField(required=False)


class NewVersionSerializer(serializers.Serializer):
    reason = serializers.CharField(min_length=10, max_length=280, trim_whitespace=True)
