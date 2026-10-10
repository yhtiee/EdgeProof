"""
Onboarding logic (spec §4). The plan is computed here, on the server, so the
same answers always give the same plan. Wording describes options; it never
instructs (ON-4, §17 "Wording rules").
"""

import math

from django.db import transaction

from .models import NeverAgainItem, Profile, User

# Approximate session windows in UTC (they shift by an hour with daylight
# saving). The client shows them in the user's local time (ON-2).
SESSIONS = {
    "asia": {"label": "Asia", "utc_start": "00:00", "utc_end": "09:00"},
    "london": {"label": "London", "utc_start": "07:00", "utc_end": "16:00"},
    "new_york": {"label": "New York", "utc_start": "12:00", "utc_end": "21:00"},
}
MAJOR_SESSIONS = {"london", "new_york"}

STYLES = {
    "position": {"label": "Position trading", "charts": "daily and weekly charts"},
    "swing": {"label": "Swing trading", "charts": "4-hour and daily charts"},
    "day": {"label": "Day trading", "charts": "15-minute to 1-hour charts"},
}

# Draft study-time estimates per Academy level, in hours. Revised once
# outside beginners have worked through Level 1 (spec §5 "Content authoring").
LEVEL_STUDY_HOURS = {1: 12, 2: 14, 3: 10, 4: 16, 5: 10, 6: 16, 7: 12}
LEVEL_TITLES = {
    1: "Foundations",
    2: "Probability and risk",
    3: "Psychology",
    4: "Technical analysis",
    5: "Fundamentals",
    6: "Strategy design",
    7: "Advanced",
}
# Strategy Lab drafting opens after Level 2 (spec §6).
LAB_DRAFTING_AFTER_LEVEL = 2

# "What usually went wrong" options (ON-3) and the never-again rule each seeds.
MISTAKES = {
    "no_stop": ("Trading without a stop", "Never open a trade without a stop."),
    "oversized": ("Risking too much on one trade", "Never risk more than my plan allows on one trade."),
    "revenge": ("Revenge trading after a loss", "Never open a trade to win back a loss."),
    "moved_stop": ("Moving my stop further away", "Never move a stop further from entry."),
    "overtrading": ("Taking too many trades", "Never trade outside my planned setups."),
    "news": ("Trading through big news", "Never hold a new position into high-impact news without a plan."),
    "no_plan": ("No written plan", "Never trade a strategy I haven't written down."),
    "prop_rules": ("Breaking prop firm rules", "Never trade a challenge without its rules written beside me."),
}

YEARS_TRADING = {"none": "None yet", "lt1": "Under 1 year", "1to3": "1 to 3 years", "3plus": "More than 3 years"}


def suggest_style(weekly_hours: int, sessions: list[str]) -> str:
    """
    Spec §4 "Style suggestion logic": under 7 hours, or no overlap with a major
    session, suggests position or swing trading; day trading only with 15+
    hours and overlap with London or New York.
    """
    has_major = bool(MAJOR_SESSIONS & set(sessions))
    if weekly_hours < 4:
        return "position"
    if weekly_hours < 7 or not has_major:
        return "swing"
    if weekly_hours >= 15:
        return "day"
    return "swing"


def _style_reason(style: str, hours: int, sessions: list[str]) -> str:
    """One sentence on why; the chart timeframes are shown separately."""
    has_major = bool(MAJOR_SESSIONS & set(sessions))
    if style == "day":
        return f"With {hours} hours a week and time during the London or New York session, there's room to watch intraday moves."
    if not has_major:
        return "Without London or New York in your day, these timeframes let you study setups at your own pace."
    if style == "position":
        return f"With {hours} hours a week, these timeframes need the least screen time."
    return f"With {hours} hours a week, these timeframes fit the time you have without watching every candle."


def experience_is_meaningful(experience: dict) -> bool:
    return (
        experience.get("years_trading", "none") != "none"
        or (experience.get("accounts_blown") or 0) > 0
        or (experience.get("prop_challenges") or 0) > 0
    )


def build_plan(user: User) -> dict:
    """The plan shown at onboarding step 4 (ON-4)."""
    profile: Profile = user.profile
    hours = profile.weekly_hours or 0
    sessions = profile.sessions or []
    experience = (profile.answers or {}).get("experience", {})
    style = suggest_style(hours, sessions)

    def weeks(h: float) -> int:
        return math.ceil(h / hours) if hours else 0

    levels = [
        {"level": n, "title": LEVEL_TITLES[n], "hours": h, "weeks": weeks(h)} for n, h in LEVEL_STUDY_HOURS.items()
    ]
    lab_hours = sum(LEVEL_STUDY_HOURS[n] for n in range(1, LAB_DRAFTING_AFTER_LEVEL + 1))
    experienced = experience_is_meaningful(experience)

    return {
        "style": {"key": style, **STYLES[style], "reason": _style_reason(style, hours, sessions)},
        "weekly_hours": hours,
        "timezone": user.timezone,
        "sessions": [{"key": k, **SESSIONS[k]} for k in SESSIONS if k in sessions],
        "academy": {"levels": levels, "total_hours": sum(LEVEL_STUDY_HOURS.values())},
        "time_to_lab": {"after_level": LAB_DRAFTING_AFTER_LEVEL, "hours": lab_hours, "weeks": weeks(lab_hours)},
        "placement": {
            "offered": experienced,
            "pass_mark": 0.9,
            "note": (
                "You can take a placement exam for any level. Scoring 90% or more lets you skip it."
                if experienced
                else "Placement exams are open to everyone. Most people starting out begin with Level 1."
            ),
        },
        "never_again": list(NeverAgainItem.objects.owned_by(user).values_list("text", flat=True)),
    }


@transaction.atomic
def seed_never_again(user: User, mistakes: list[str], other: str = "") -> None:
    """ON-3: the experience step seeds the never-again list. Existing items are kept."""
    existing = set(NeverAgainItem.objects.owned_by(user).values_list("text", flat=True))
    texts = [MISTAKES[m][1] for m in mistakes if m in MISTAKES]
    if other.strip():
        texts.append(f"Never again: {other.strip()}")
    order = len(existing)
    for text in texts:
        if text not in existing:
            NeverAgainItem.objects.create(user=user, text=text, order=order)
            order += 1
