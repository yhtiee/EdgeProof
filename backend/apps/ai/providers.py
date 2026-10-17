"""
AI providers behind one interface (spec §10 "The provider sits behind an
interface so it can be swapped"). Gemini and Groq are both supported; the
main one is AI_PROVIDER and the other can be the fallback (AI_FALLBACK_PROVIDER).
Each provider tries its models in order. Streaming is plain HTTP + server-sent
events with the standard library, so there's no SDK to keep up with.

stream(system, user) yields text chunks and finally a Usage record.
"""

import json
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field

from django.conf import settings


class ProviderError(Exception):
    """The provider couldn't answer (quota, outage, timeout, bad model). Safe to try the next one."""


@dataclass
class Usage:
    provider: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    extra: dict = field(default_factory=dict)


def _post_stream(url: str, body: dict, headers: dict, deadline: float):
    """POST and yield each `data:` line of a server-sent event stream."""
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json", **headers}, method="POST")
    remaining = max(1.0, deadline - time.monotonic())
    try:
        res = urllib.request.urlopen(req, timeout=remaining)
    except urllib.error.HTTPError as exc:
        detail = exc.read(300).decode(errors="replace")
        raise ProviderError(f"HTTP {exc.code}: {detail}") from exc
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise ProviderError(str(exc)) from exc
    with res:
        for raw in res:
            if time.monotonic() > deadline:
                raise ProviderError("timed out")
            line = raw.decode("utf-8", errors="replace").strip()
            if line.startswith("data:"):
                data = line[5:].strip()
                if data and data != "[DONE]":
                    yield json.loads(data)


class Gemini:
    name = "gemini"
    URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse"

    def __init__(self, key: str, models: list[str]):
        self.key, self.models = key, models

    def stream_model(self, model: str, system: str, user: str, deadline: float, temperature: float):
        body = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {"temperature": temperature, "maxOutputTokens": 4096},  # thinking tokens count here too
        }
        usage = Usage(self.name, model)
        for event in _post_stream(self.URL.format(model=model), body, {"x-goog-api-key": self.key}, deadline):
            for cand in event.get("candidates", []):
                for part in cand.get("content", {}).get("parts", []):
                    if part.get("text") and not part.get("thought"):
                        yield part["text"]
            meta = event.get("usageMetadata") or {}
            usage.input_tokens = meta.get("promptTokenCount", usage.input_tokens)
            usage.output_tokens = meta.get("candidatesTokenCount", usage.output_tokens)
        yield usage


class Groq:
    name = "groq"
    URL = "https://api.groq.com/openai/v1/chat/completions"

    def __init__(self, key: str, models: list[str]):
        self.key, self.models = key, models

    def stream_model(self, model: str, system: str, user: str, deadline: float, temperature: float):
        body = {
            "model": model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "temperature": temperature,
            "max_completion_tokens": 3000,  # hidden reasoning still counts
            "stream": True,
            "stream_options": {"include_usage": True},
        }
        # Reasoning models: keep their working out of the answer.
        if model.startswith("openai/gpt-oss"):
            body["include_reasoning"] = False
            body["reasoning_effort"] = "low"
        elif "qwen" in model:
            body["reasoning_format"] = "hidden"
        usage = Usage(self.name, model)
        headers = {"Authorization": f"Bearer {self.key}", "User-Agent": "edgeproof"}
        for event in _post_stream(self.URL, body, headers, deadline):
            for choice in event.get("choices", []):
                text = (choice.get("delta") or {}).get("content")
                if text:
                    yield text
            u = event.get("usage") or (event.get("x_groq") or {}).get("usage") or {}
            usage.input_tokens = u.get("prompt_tokens", usage.input_tokens)
            usage.output_tokens = u.get("completion_tokens", usage.output_tokens)
        yield usage


def _build(name: str):
    cfg = settings.AI
    if name == "gemini" and cfg["gemini_key"]:
        return Gemini(cfg["gemini_key"], cfg["gemini_models"])
    if name == "groq" and cfg["groq_key"]:
        return Groq(cfg["groq_key"], cfg["groq_models"])
    return None


def chain() -> list:
    """Providers to try, main first, then the fallback; only ones with a key."""
    cfg = settings.AI
    names = [cfg["provider"], cfg["fallback"]]
    out, seen = [], set()
    for n in names:
        if n and n not in seen and (p := _build(n)):
            out.append(p)
            seen.add(n)
    return out


def enabled() -> bool:
    return settings.AI["provider"] != "disabled" and bool(chain())


def stream(system: str, user: str, *, temperature: float = 0.3):
    """
    Yields ("text", chunk) items, then ("usage", Usage). Tries each provider's
    models in order; once text has started flowing, a failure is raised to the
    caller (who can reset and retry) rather than silently switching mid-answer.
    """
    deadline = time.monotonic() + settings.AI["timeout_seconds"]
    errors = []
    for provider in chain():
        for model in provider.models:
            started = False
            try:
                for item in provider.stream_model(model, system, user, deadline, temperature):
                    if isinstance(item, Usage):
                        yield ("usage", item)
                    else:
                        started = True
                        yield ("text", item)
                return
            except ProviderError as exc:
                if started:
                    raise
                errors.append(f"{provider.name}/{model}: {exc}")
                if time.monotonic() > deadline:
                    break
    raise ProviderError("; ".join(errors) or "No AI provider is configured.")
