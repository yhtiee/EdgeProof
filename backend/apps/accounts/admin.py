"""
Spec §16: only content, config and prop-firm models are registered in the
admin. Users are listed (without profile data) so roles can be managed;
journal data is reachable only through a SupportGrant.
"""

from django.contrib import admin

from .models import User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ["email", "role", "is_active", "created_at"]
    list_filter = ["role", "is_active"]
    search_fields = ["email"]
    fields = ["email", "name", "role", "is_active", "is_staff", "is_superuser"]
    readonly_fields = ["email"]
