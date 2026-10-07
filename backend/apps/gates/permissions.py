"""
Gates are enforced on the server (spec §8); the interface lock is only a
convenience. Use `RequiresGate(2)` on user-scoped endpoints.
"""

from rest_framework.permissions import BasePermission

from apps.core.exceptions import GateLocked

from .services import has_gate


def RequiresGate(gate: int):  # noqa: N802 - reads like a class at the call site
    class _RequiresGate(BasePermission):
        message = f"Gate {gate} hasn't been passed yet."

        def has_permission(self, request, view):
            if not request.user.is_authenticated:
                return False
            if not has_gate(request.user, gate):
                raise GateLocked(self.message)
            return True

    _RequiresGate.__name__ = f"RequiresGate{gate}"
    return _RequiresGate

