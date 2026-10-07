from rest_framework import serializers

from .models import Job, Notification


class JobSerializer(serializers.ModelSerializer):
    class Meta:
        model = Job
        fields = ["id", "kind", "status", "progress", "result", "error", "created_at", "updated_at"]
        read_only_fields = fields


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "type", "title", "body", "due_at", "read_at"]
        read_only_fields = ["id", "type", "title", "body", "due_at"]
