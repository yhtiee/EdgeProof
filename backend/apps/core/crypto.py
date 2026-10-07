"""
Field-level envelope encryption (spec §16).

Keys come from FIELD_ENCRYPTION_KEYS as "id:key,id:key" (newest first). Each
stored value records the id of the key that wrote it, and MultiFernet lets
old values be read while new writes use the newest key. Rotation: prepend a
new key, run `manage.py rotate_field_keys`, then remove the old key.
"""

import json
from functools import lru_cache

from cryptography.fernet import Fernet, MultiFernet
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import models


@lru_cache(maxsize=1)
def _keys() -> list[tuple[str, Fernet]]:
    raw = settings.FIELD_ENCRYPTION_KEYS
    if not raw:
        raise ImproperlyConfigured("FIELD_ENCRYPTION_KEYS is not set.")
    pairs = []
    for item in raw.split(","):
        key_id, _, key = item.strip().partition(":")
        if not key:
            raise ImproperlyConfigured("FIELD_ENCRYPTION_KEYS entries must look like 'id:key'.")
        pairs.append((key_id, Fernet(key.encode())))
    return pairs


def encrypt(value) -> dict:
    key_id, fernet = _keys()[0]
    token = fernet.encrypt(json.dumps(value).encode()).decode()
    return {"kid": key_id, "ct": token}


def decrypt(stored: dict):
    multi = MultiFernet([f for _, f in _keys()])
    return json.loads(multi.decrypt(stored["ct"].encode()))


class EncryptedJSONField(models.JSONField):
    """Stores {"kid": ..., "ct": ...}; exposes the decrypted Python value."""

    def get_prep_value(self, value):
        if value is None:
            return None
        return super().get_prep_value(encrypt(value))

    def from_db_value(self, value, expression, connection):
        stored = super().from_db_value(value, expression, connection)
        if stored is None:
            return None
        return decrypt(stored)
