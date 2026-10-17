"""
Screenshot uploads (JR-11, spec §15–16).

1. POST /uploads/presign {content_type, size}: refuses non-images and files
   over 5 MB; returns a short-lived URL the browser PUTs the file to.
2. POST /uploads/{key}/confirm: reads the stored object, re-encodes it as
   WebP (max 1600 px wide), which strips EXIF and anything hidden in the file.
3. GET /uploads/{key}: the owner's image, never public.

Objects live in Cloudflare R2 when it is configured; in development they go
to local storage through the API instead. Unconfirmed uploads are swept
after 24 hours.
"""

import io
import logging
import uuid

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.http import HttpResponse
from django.utils import timezone
from PIL import Image, UnidentifiedImageError
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.parsers import BaseParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import UploadIntent

log = logging.getLogger(__name__)
ALLOWED = {"image/webp", "image/png", "image/jpeg"}
MAX_WIDTH = 1600
Image.MAX_IMAGE_PIXELS = 40_000_000  # refuse decompression bombs


def r2_enabled() -> bool:
    return bool(settings.R2["endpoint_url"] and settings.R2["access_key_id"])


def _r2():
    import boto3

    return boto3.client(
        "s3",
        endpoint_url=settings.R2["endpoint_url"],
        aws_access_key_id=settings.R2["access_key_id"],
        aws_secret_access_key=settings.R2["secret_access_key"],
        region_name="auto",
    )


def read_object(key: str) -> bytes:
    if r2_enabled():
        return _r2().get_object(Bucket=settings.R2["bucket"], Key=key)["Body"].read()
    with default_storage.open(key, "rb") as f:
        return f.read()


def write_object(key: str, data: bytes) -> None:
    if r2_enabled():
        _r2().put_object(Bucket=settings.R2["bucket"], Key=key, Body=data, ContentType="image/webp")
        return
    if default_storage.exists(key):
        default_storage.delete(key)
    default_storage.save(key, ContentFile(data))


def delete_object(key: str) -> None:
    if r2_enabled():
        _r2().delete_object(Bucket=settings.R2["bucket"], Key=key)
    elif default_storage.exists(key):
        default_storage.delete(key)


def discard_uploads(user, keys) -> None:
    """Deletes the user's stored files and their upload records."""
    for intent in UploadIntent.objects.owned_by(user).filter(key__in=list(keys)):
        try:
            delete_object(intent.key)
        except Exception:  # noqa: BLE001
            log.info("upload %s already gone", intent.key)
        intent.delete()


def owned_intent(user, key: str) -> UploadIntent:
    intent = UploadIntent.objects.owned_by(user).filter(key=key).first()
    if not intent:
        raise NotFound("Upload not found.")
    return intent


def reencode(data: bytes) -> tuple[bytes, int, int]:
    try:
        img = Image.open(io.BytesIO(data))
        img.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise ValidationError({"file": ["That file isn't an image we can read."]}) from exc
    img = img.convert("RGB")
    if img.width > MAX_WIDTH:
        img = img.resize((MAX_WIDTH, round(img.height * MAX_WIDTH / img.width)), Image.LANCZOS)
    out = io.BytesIO()
    img.save(out, "WEBP", quality=78, method=4)  # no exif passed, so none is written
    return out.getvalue(), img.width, img.height


class PresignView(APIView):
    def post(self, request):
        content_type = str(request.data.get("content_type", ""))
        try:
            size = int(request.data.get("size", 0))
        except (TypeError, ValueError):
            size = 0
        if content_type not in ALLOWED:
            raise ValidationError({"content_type": ["Screenshots must be WebP, PNG or JPEG."]})
        if not 0 < size <= settings.R2["max_upload_bytes"]:
            raise ValidationError({"size": ["Screenshots can be up to 5 MB."]})
        key = f"u/{request.user.id}/{uuid.uuid4().hex}.webp"
        UploadIntent.objects.create(user=request.user, key=key, content_type=content_type, size=size)
        if r2_enabled():
            url = _r2().generate_presigned_url(
                "put_object",
                Params={"Bucket": settings.R2["bucket"], "Key": key, "ContentType": content_type},
                ExpiresIn=settings.R2["signed_url_seconds"],
            )
            return Response({"key": key, "url": url, "method": "PUT", "headers": {"Content-Type": content_type}, "auth": False})
        return Response({"key": key, "url": f"/api/v1/uploads/{key}/local", "method": "PUT", "headers": {"Content-Type": content_type}, "auth": True})


class RawBodyParser(BaseParser):
    media_type = "*/*"

    def parse(self, stream, media_type=None, parser_context=None):
        return stream.read(settings.R2["max_upload_bytes"] + 1)


class LocalUploadView(APIView):
    """Development stand-in for the R2 presigned PUT."""

    parser_classes = [RawBodyParser]

    def put(self, request, key):
        if r2_enabled():
            raise NotFound()
        intent = owned_intent(request.user, key)
        data = request.data
        if not isinstance(data, bytes) or len(data) > intent.size or len(data) > settings.R2["max_upload_bytes"]:
            raise ValidationError({"file": ["The file is larger than declared."]})
        write_object(key, data)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ConfirmUploadView(APIView):
    def post(self, request, key):
        intent = owned_intent(request.user, key)
        try:
            data = read_object(key)
        except Exception as exc:  # missing object: the PUT never arrived
            raise ValidationError({"file": ["The upload didn't arrive. Try again."]}) from exc
        if len(data) > settings.R2["max_upload_bytes"]:
            delete_object(key)
            raise ValidationError({"file": ["Screenshots can be up to 5 MB."]})
        webp, width, height = reencode(data)
        write_object(key, webp)
        intent.content_type, intent.size, intent.confirmed_at = "image/webp", len(webp), timezone.now()
        intent.save(update_fields=["content_type", "size", "confirmed_at", "updated_at"])
        return Response({"key": key, "width": width, "height": height, "size": len(webp)})


class UploadView(APIView):
    def get(self, request, key):
        intent = owned_intent(request.user, key)
        if not intent.confirmed_at:
            raise NotFound("Upload not found.")
        response = HttpResponse(read_object(key), content_type="image/webp")
        response["Cache-Control"] = "private, max-age=86400"
        response["X-Content-Type-Options"] = "nosniff"
        return response
