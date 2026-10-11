"""
EdgeProof settings. Configuration comes from environment variables only
(spec §13 "Environments"); see .env.example for the full list.
"""

from datetime import timedelta
from pathlib import Path
import os

import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Local development: read backend/.env if present. Real environment variables win.
_dotenv = BASE_DIR / ".env"
if _dotenv.exists():
    for _line in _dotenv.read_text(encoding="utf-8").splitlines():
        _key, _sep, _value = _line.strip().partition("=")
        if _sep and not _key.startswith("#"):
            os.environ.setdefault(_key.strip(), _value.strip())


def env(name: str, default: str | None = None) -> str | None:
    return os.environ.get(name, default)


def env_bool(name: str, default: bool = False) -> bool:
    return env(name, str(default)).lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: str = "") -> list[str]:
    return [v.strip() for v in env(name, default).split(",") if v.strip()]


DEBUG = env_bool("DJANGO_DEBUG", False)
SECRET_KEY = env("DJANGO_SECRET_KEY") or ("dev-insecure-key" if DEBUG else None)
if not SECRET_KEY:
    raise RuntimeError("DJANGO_SECRET_KEY is required when DJANGO_DEBUG is off.")

ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")
CSRF_TRUSTED_ORIGINS = env_list("DJANGO_CSRF_TRUSTED_ORIGINS", "http://localhost:5173")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",
    # Third party
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "drf_spectacular",
    "django_otp",
    "django_otp.plugins.otp_totp",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.google",
    # EdgeProof
    "apps.core",
    "apps.accounts",
    "apps.academy",
    "apps.library",
    "apps.schedule",
    "apps.strategy",
    "apps.testing",
    "apps.analytics",
    "apps.gates",
    "apps.discipline",
    "apps.ladder",
    "apps.ai",
    "apps.audit",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "apps.core.middleware.RequestIdMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django_otp.middleware.OTPMiddleware",
    "allauth.account.middleware.AccountMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
SITE_ID = 1

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# --- Database (spec §13: Neon, pooled URL for the app) ----------------------
# Without DATABASE_URL, local development falls back to SQLite so the API can
# run without Docker. Production and CI use PostgreSQL.
DATABASES = {
    "default": dj_database_url.config(
        env="DATABASE_URL",
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=int(env("DB_CONN_MAX_AGE", "60")),
        conn_health_checks=True,
    )
}
if DATABASES["default"]["ENGINE"] == "django.db.backends.postgresql":
    DATABASES["default"].setdefault("OPTIONS", {})["connect_timeout"] = 10
    # Neon's pooler runs in transaction mode: server-side cursors break there.
    DATABASES["default"]["DISABLE_SERVER_SIDE_CURSORS"] = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "accounts.User"

# --- Passwords (spec §16: Argon2) -------------------------------------------
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
]
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 10}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]

LANGUAGE_CODE = "en-gb"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

# --- Cache: Postgres-backed so rate limits hold across threads (spec §16) ---
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.db.DatabaseCache",
        "LOCATION": "edgeproof_cache",
    }
}

# --- REST framework (spec §15) ----------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework_simplejwt.authentication.JWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.CreatedCursorPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "apps.core.exceptions.exception_handler",
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.AnonRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "user": env("THROTTLE_USER_RATE", "600/hour"),
        "anon": env("THROTTLE_ANON_RATE", "120/hour"),
        "auth": "10/minute",  # login and register, per IP
        "refresh": "60/minute",  # runs on every page load
        "ai": "30/day",
    },
    # Only the host's known proxy hops are trusted for the client IP.
    "NUM_PROXIES": int(env("NUM_PROXIES", "1")),
}

SPECTACULAR_SETTINGS = {
    "TITLE": "EdgeProof API",
    "DESCRIPTION": "Education-only forex training platform. All statistics are computed by code.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
}

# --- Tokens (spec §15): short access token in memory, rotating refresh cookie
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=10),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=30),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "USER_ID_FIELD": "id",
    "AUTH_HEADER_TYPES": ("Bearer",),
}
REFRESH_COOKIE = {
    "key": "ep_refresh",
    "path": "/api/v1/auth/",
    "httponly": True,
    "secure": not DEBUG,
    "samesite": "Lax",
}

# --- allauth: Google sign-in only (spec §13) --------------------------------
ACCOUNT_LOGIN_METHODS = {"email"}
ACCOUNT_SIGNUP_FIELDS = ["email*", "password1*"]
ACCOUNT_USER_MODEL_USERNAME_FIELD = None
ACCOUNT_EMAIL_VERIFICATION = "optional"
SOCIALACCOUNT_PROVIDERS = {
    "google": {
        "APP": {
            "client_id": env("GOOGLE_CLIENT_ID", ""),
            "secret": env("GOOGLE_CLIENT_SECRET", ""),
        },
        "SCOPE": ["openid", "email", "profile"],
    }
}

# --- Security (spec §16) ----------------------------------------------------
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SAMESITE = "Lax"
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_SSL_REDIRECT = env_bool("DJANGO_SSL_REDIRECT", not DEBUG)
SECURE_HSTS_SECONDS = 0 if DEBUG else 60 * 60 * 24 * 365
X_FRAME_OPTIONS = "DENY"
ADMIN_URL = env("DJANGO_ADMIN_URL", "ep-console/")

# Field-level envelope encryption (spec §16). Comma-separated "id:key" pairs,
# newest first; stored apart from the database credentials.
FIELD_ENCRYPTION_KEYS = env("FIELD_ENCRYPTION_KEYS", "")

# Scheduled sweep (spec §13): HMAC-signed by GitHub Actions.
SWEEP_HMAC_SECRET = env("SWEEP_HMAC_SECRET", "")
SWEEP_MAX_SKEW_SECONDS = 300

# --- Object storage: Cloudflare R2 (spec §13, §16) --------------------------
R2 = {
    "endpoint_url": env("R2_ENDPOINT_URL", ""),
    "access_key_id": env("R2_ACCESS_KEY_ID", ""),
    "secret_access_key": env("R2_SECRET_ACCESS_KEY", ""),
    "bucket": env("R2_BUCKET", "edgeproof-uploads"),
    "signed_url_seconds": 300,
    "max_upload_bytes": 5 * 1024 * 1024,
}

# --- AI (spec §10) ----------------------------------------------------------
AI = {
    "provider": env("AI_PROVIDER", "disabled"),
    "api_key": env("AI_API_KEY", ""),
    "model": env("AI_MODEL", ""),
    "timeout_seconds": 45,
    "daily_user_limit": int(env("AI_DAILY_USER_LIMIT", "20")),
    "monthly_circuit_breaker_usd": float(env("AI_MONTHLY_BREAKER_USD", "20")),
}

# --- Email ------------------------------------------------------------------
EMAIL_BACKEND = env("EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", "EdgeProof <no-reply@localhost>")

# --- Logging: structured, with request IDs (spec §16) -----------------------
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {"request_id": {"()": "apps.core.middleware.RequestIdLogFilter"}},
    "formatters": {
        "structured": {
            "format": '{"time":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s",'
            '"request_id":"%(request_id)s","message":"%(message)s"}'
        }
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "structured", "filters": ["request_id"]}
    },
    "root": {"handlers": ["console"], "level": env("LOG_LEVEL", "INFO")},
}

# --- Sentry (spec §13): PII scrubbing on ------------------------------------
if env("SENTRY_DSN"):
    import sentry_sdk

    sentry_sdk.init(dsn=env("SENTRY_DSN"), send_default_pii=False, traces_sample_rate=0.0)
