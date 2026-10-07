def suggest_style(weekly_hours: int, sessions: list[str]) -> str:
    """
    Style suggestion for learning purposes (spec §4 "Style suggestion logic").
    Under 7 hours, or no overlap with a major session, suggests position or
    swing trading; day trading only with 15+ hours and London or New York.
    """
    major = {"london", "new_york"} & set(sessions)
    if weekly_hours < 7 or not major:
        return "position" if weekly_hours < 4 else "swing"
    if weekly_hours >= 15:
        return "day"
    return "swing"
