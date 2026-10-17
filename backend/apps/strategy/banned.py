"""
Banned vague words and phrases (rulebook-builder.md §2.7, SL-3). Each comes
with the question the builder asks and the blocks that make it precise.
Matching is case-insensitive on whole words; some words are allowed in fixed
precise phrases ("major pair", "closes above"). Mirrored in banned.ts.
"""

import re

# (phrase, question, suggested block types)
BANNED: list[tuple[str, str, list[str]]] = [
    ("strong", "Strong compared with what? A candle range above some multiple of ATR, or one average above another?", ["candle_size", "ma_order"]),
    ("weak", "Weak by what measure: RSI below a value, or a small candle range?", ["rsi", "candle_size"]),
    ("clear", "What would two people both see? Try a close beyond a level, or a swing structure.", ["level", "structure"]),
    ("clearly", "What would two people both see? Try a close beyond a level, or a swing structure.", ["level", "structure"]),
    ("obvious", "What makes it obvious, in prices? Name the level or the pattern.", ["level", "candle_pattern"]),
    ("good", "Good by which number?", []),
    ("nice", "Which measurable feature makes it nice?", []),
    ("clean", "Clean meaning what: no candle closing through the level for a number of candles?", ["level"]),
    ("looks like", "What exactly would it need to be? Name the pattern or the level.", ["candle_pattern"]),
    ("seems", "What would you measure to know?", []),
    ("seem", "What would you measure to know?", []),
    ("feels", "Which price fact sits behind the feeling?", []),
    ("feel", "Which price fact sits behind the feeling?", []),
    ("significant", "Significant by size (pips or ATR) or by being a prior-day or swing level?", ["level", "candle_size"]),
    ("key level", "Which level: prior day high or low, prior week, a swing, or a round number?", ["level"]),
    ("major level", "Which level: prior day high or low, prior week, a swing, or a round number?", ["level"]),
    ("big", "How big, in pips or ATR?", ["candle_size"]),
    ("small", "How small, in pips or ATR?", ["candle_size"]),
    ("sharp", "Sharp meaning a range above how many ATR?", ["candle_size"]),
    ("momentum is", "Momentum measured how: RSI above a value, or MACD above its signal line?", ["rsi", "macd"]),
    ("trending", "Trending by structure (higher highs and lows) or by a moving average?", ["structure", "price_vs_ma", "ma_order"]),
    ("choppy", "Choppy meaning ATR below a value?", ["atr"]),
    ("overextended", "Overextended meaning how far from which average, in pips or ATR?", ["distance"]),
    ("confirmation", "What exactly confirms it: a close beyond a level, or a named candle pattern?", ["level", "candle_pattern"]),
    ("confirms", "What exactly confirms it: a close beyond a level, or a named candle pattern?", ["level", "candle_pattern"]),
    ("near", "Within how many pips or ATR?", ["level", "distance"]),
    ("close to", "Within how many pips or ATR?", ["level", "distance"]),
    ("around", "Within how many pips of what price?", ["distance"]),
    ("approximately", "Give the number and the tolerance.", []),
    ("roughly", "Give the number and the tolerance.", []),
    ("about", "Give the number and the tolerance.", []),
    ("enough", "How much is enough, as a number?", []),
    ("a lot", "How many, as a number?", []),
    ("lots", "How many, as a number?", []),
    ("usually", "A rule applies every time. Which condition decides when?", []),
    ("often", "A rule applies every time. Which condition decides when?", []),
    ("sometimes", "A rule applies every time. Which condition decides when?", []),
    ("probably", "Rules don't predict. What do you see on the chart?", []),
    ("likely", "Rules don't predict. What do you see on the chart?", []),
    ("should", "Rules describe what you do. Which condition triggers it?", []),
    ("healthy pullback", "A pullback of how much: to which average, or within how many ATR?", ["distance"]),
    ("solid", "Solid meaning what, in prices?", []),
    ("important", "Which level, defined how?", ["level"]),
    ("high probability", "Probability is what testing measures. Which conditions define the setup?", []),
    ("textbook", "Which parts of the definition must be true?", ["candle_pattern"]),
    ("perfect", "Which parts of the definition must be true?", ["candle_pattern"]),
    ("when it makes sense", "What would you be looking at when you decide? Describe it in prices.", []),
    ("at my discretion", "What would you be looking at when you decide? Describe it in prices.", []),
    ("gut", "What would you be looking at when you decide? Describe it in prices.", []),
    ("intuition", "What would you be looking at when you decide? Describe it in prices.", []),
    ("smart money", "Which price behaviour do you mean? Describe it as levels, structure or candles.", ["level", "structure"]),
    ("institutional", "Which price behaviour do you mean? Describe it as levels, structure or candles.", ["level", "structure"]),
    ("fakeout", "Define it: a close beyond a level that reverses within a number of candles?", ["level"]),
    ("fake out", "Define it: a close beyond a level that reverses within a number of candles?", ["level"]),
]

# Precise phrases that contain a banned word but aren't vague.
ALLOWED = ["major pair", "major pairs", "closes above", "closes below", "close above", "close below"]


def _pattern(phrase: str) -> re.Pattern:
    words = r"\s+".join(re.escape(w) for w in phrase.split())
    return re.compile(rf"(?<![\w'’]){words}(?![\w'’])", re.IGNORECASE)


_COMPILED = [(phrase, _pattern(phrase), question, blocks) for phrase, question, blocks in BANNED]
_ALLOWED = [_pattern(p) for p in ALLOWED]


def find_vague(text: str) -> list[dict]:
    """Every banned word or phrase in `text`, in order of first appearance, without repeats."""
    cleaned = text
    for allowed in _ALLOWED:
        cleaned = allowed.sub(lambda m: " " * len(m.group(0)), cleaned)
    hits = []
    for phrase, pattern, question, blocks in _COMPILED:
        m = pattern.search(cleaned)
        if m:
            hits.append({"word": phrase, "at": m.start(), "question": question, "blocks": blocks})
    # A phrase hit hides its single-word parts ("key level" isn't also reported as nothing else).
    hits.sort(key=lambda h: (h["at"], -len(h["word"])))
    seen_spans: list[tuple[int, int]] = []
    result = []
    for h in hits:
        span = (h["at"], h["at"] + len(h["word"]))
        if any(s <= span[0] and span[1] <= e for s, e in seen_spans):
            continue
        seen_spans.append(span)
        result.append(h)
    return result
