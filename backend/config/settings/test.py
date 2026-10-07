import os

os.environ.setdefault("DJANGO_DEBUG", "true")
os.environ.setdefault("DJANGO_SECRET_KEY", "test-secret-key-that-is-long-enough-for-hs256")
os.environ.setdefault("FIELD_ENCRYPTION_KEYS", "k1:AC3uMzb9UIE5YM6Mq5P8f8ONAzxQMs13XDDY-vQ-OhY=")
os.environ.setdefault("SWEEP_HMAC_SECRET", "test-sweep-secret")

from .base import *  # noqa: E402,F403

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
REST_FRAMEWORK = {**REST_FRAMEWORK, "DEFAULT_THROTTLE_CLASSES": []}  # noqa: F405
SECURE_SSL_REDIRECT = False
