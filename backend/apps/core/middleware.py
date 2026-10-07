import contextvars
import logging
import uuid

_request_id = contextvars.ContextVar("request_id", default="-")


class RequestIdMiddleware:
    """Attaches a request ID to every log line and response (spec §16)."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        rid = request.headers.get("X-Request-Id") or uuid.uuid4().hex
        token = _request_id.set(rid[:64])
        try:
            response = self.get_response(request)
        finally:
            _request_id.reset(token)
        response["X-Request-Id"] = rid[:64]
        return response


class RequestIdLogFilter(logging.Filter):
    def filter(self, record):
        record.request_id = _request_id.get()
        return True
