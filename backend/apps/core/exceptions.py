"""Errors return {code, message, fields} (spec §15 "Conventions")."""

from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_handler


class GateLocked(exceptions.PermissionDenied):
    default_code = "gate_locked"
    default_detail = "This step unlocks when its gate passes."


class Conflict(exceptions.APIException):
    status_code = status.HTTP_409_CONFLICT
    default_code = "conflict"
    default_detail = "This change conflicts with the current state."


def exception_handler(exc, context):
    response = drf_handler(exc, context)
    if response is None:
        return None

    data = response.data
    fields: dict[str, list[str]] = {}
    message = ""
    if isinstance(data, dict) and "detail" in data and len(data) == 1:
        message = str(data["detail"])
    elif isinstance(data, dict):
        for key, value in data.items():
            items = value if isinstance(value, list) else [value]
            if key == "non_field_errors":
                message = str(items[0])
            else:
                fields[key] = [str(v) for v in items]
        message = message or "Some fields need attention."
    elif isinstance(data, list):
        message = str(data[0]) if data else "Request failed."

    code = getattr(exc, "default_code", "error")
    if isinstance(exc, exceptions.APIException):
        codes = exc.get_codes()
        if isinstance(codes, str):
            code = codes
    return Response({"code": code, "message": message, "fields": fields}, status=response.status_code)
