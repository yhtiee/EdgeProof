from rest_framework.pagination import CursorPagination


class CreatedCursorPagination(CursorPagination):
    """Cursor pagination for every list endpoint (spec §15)."""

    ordering = "-created_at"
    page_size_query_param = "limit"
    max_page_size = 200
