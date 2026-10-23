"""Admin for the scoreboard's hand-set inputs (docs/scanner/scoreboard.md)."""

from django.contrib import admin

from .models import CentralBankOutlook, Release


@admin.register(CentralBankOutlook)
class CentralBankOutlookAdmin(admin.ModelAdmin):
    """The house view of each central bank's next-quarter move; it outranks the market-rate proxy for 120 days."""

    list_display = ("currency", "direction", "set_on", "note")
    ordering = ("currency__code",)


@admin.register(Release)
class ReleaseAdmin(admin.ModelAdmin):
    list_display = ("at", "currency", "indicator", "title", "forecast_text", "actual", "previous", "actual_source")
    list_filter = ("indicator", "currency")
    ordering = ("-at",)
