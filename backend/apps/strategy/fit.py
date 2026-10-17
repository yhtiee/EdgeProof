"""
Profile fit check (SL-2): warnings when a rulebook asks more than the
trader's onboarding profile allows. Never blocks anything. Pure; mirrored in
fit.ts.

profile = {"weekly_hours": int | None, "sessions": [...], "timezone": "Africa/Lagos"}
"""

from datetime import date, datetime
from zoneinfo import ZoneInfo

from .vocabulary import TF_RANK

# Weekly hours a strategy on this lowest timeframe usually needs (rulebook-builder.md §3.4).
HOURS_NEEDED = {"M5": 15, "M15": 10, "M30": 6, "H1": 6, "H4": 3, "D1": 1, "W1": 1}
TF_WORDS = {"M5": "5-minute", "M15": "15-minute", "M30": "30-minute", "H1": "1-hour", "H4": "4-hour", "D1": "daily", "W1": "weekly"}
SESSION_WORDS = {"asia": "Asia", "london": "London", "new_york": "New York"}
# A fixed winter date, so the local-time check doesn't depend on today's date.
REFERENCE_DAY = date(2026, 1, 14)


def _join(names):
    words = [SESSION_WORDS.get(n, n) for n in names]
    return words[0] if len(words) == 1 else ", ".join(words[:-1]) + " and " + words[-1]


def profile_fit(rules: dict, profile: dict) -> list[dict]:
    out = []
    market = rules.get("market") or {}
    tfs = [tf for tf in market.get("timeframes") or [] if tf in TF_RANK]
    hours = profile.get("weekly_hours")
    if not tfs:
        return out
    low = min(tfs, key=TF_RANK.get)
    if not hours:
        out.append({"code": "FIT_NO_PROFILE", "message": "Add your weekly hours in your profile to check fit."})
    elif hours < HOURS_NEEDED[low]:
        out.append({
            "code": "FIT_HOURS_TF",
            "message": f"This strategy uses {TF_WORDS[low]} charts. Your plan has {hours} hours a week; "
                       f"{TF_WORDS[low]} strategies usually need about {HOURS_NEEDED[low]}.",
        })

    mine = profile.get("sessions") or []
    extra = [s for s in market.get("sessions") or [] if s not in mine]
    if mine and extra and TF_RANK[low] <= TF_RANK["H4"]:
        out.append({"code": "FIT_SESSIONS", "message": f"This strategy trades the {_join(extra)} session. Your profile lists {_join(mine)}."})

    try:
        local = ZoneInfo(profile.get("timezone") or "UTC")
    except Exception:  # noqa: BLE001 (unknown zone: skip the local-time check)
        local = None
    for cond in (rules.get("setup") or {}).get("conditions") or []:
        if cond.get("type") != "time_window" or local is None:
            continue
        p = cond.get("params") or {}
        try:
            zone = ZoneInfo(p["zone"])
            d = REFERENCE_DAY
            start = datetime(d.year, d.month, d.day, int(p["from"][:2]), int(p["from"][3:]), tzinfo=zone).astimezone(local)
            end = datetime(d.year, d.month, d.day, int(p["to"][:2]), int(p["to"][3:]), tzinfo=zone).astimezone(local)
        except (KeyError, ValueError, TypeError):
            continue
        night = lambda t: t.hour >= 23 or t.hour < 6
        if night(start) or night(end):
            out.append({
                "code": "FIT_WINDOW_LOCAL",
                "message": f"{p['from']}–{p['to']} {p['zone'].split('/')[-1].replace('_', ' ')} time is "
                           f"{start:%H:%M}–{end:%H:%M} where you are.",
            })
    return out
