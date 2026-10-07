from django.contrib import admin

from .models import GateConfig


@admin.register(GateConfig)
class GateConfigAdmin(admin.ModelAdmin):
    list_display = ["gate", "version", "active", "created_at"]
    list_filter = ["gate", "active"]
