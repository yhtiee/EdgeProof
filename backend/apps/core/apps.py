from django.apps import AppConfig
from django.conf import settings
from django.utils.autoreload import autoreload_started


def _watch_dotenv(sender, **kwargs):
    """`runserver` reloads when backend/.env changes, as it does for code (settings are read at start)."""
    sender.watch_dir(settings.BASE_DIR, ".env")


class CoreConfig(AppConfig):
    name = "apps.core"
    label = "core"

    def ready(self):
        autoreload_started.connect(_watch_dotenv)
