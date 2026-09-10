"""Optional LLM re-ranking. Entirely off by default.

The heuristic scorer above is the product. This module can ask a model to
re-rank the top candidates and write better titles, but:

  * it is only used when a key is configured AND LLM_RANKING_ENABLED=1;
  * it never invents timestamps - the model chooses from a numbered list of
    candidates we generated, and any index we don't recognise is discarded;
  * every returned range is re-validated against the real candidate before it
    is rendered;
  * any failure (no key, network error, bad JSON, hallucinated index) falls
    silently back to the heuristic ranking.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass

from ..config import settings
from ..utils.logging import get_logger
from .types import Candidate

log = get_logger(__name__)

MAX_CANDIDATES_SENT = 24
MAX_EXCERPT_CHARS = 420
REQUEST_TIMEOUT = 60.0

_PROMPT = """You are helping choose short clips from a longer video.

Below are {count} candidate clips, each already validated to be between
{min_s:.0f} and {max_s:.0f} seconds long. Choose the {want} that work best as
standalone short-form videos: a strong opening line, one coherent idea, and a
satisfying ending. Prefer variety - do not pick several clips about the same
point.

Reply with JSON only, in exactly this shape:
{{"picks": [{{"id": <candidate id>, "title": "<max 60 chars>"}}]}}

Candidates:
{candidates}
"""


@dataclass
class RankedPick:
    candidate: Candidate
    title: str | None


def _excerpt(text: str) -> str:
    collapsed = " ".join(text.split())
    if len(collapsed) <= MAX_EXCERPT_CHARS:
        return collapsed
    return collapsed[:MAX_EXCERPT_CHARS].rsplit(" ", 1)[0] + "…"


def is_enabled() -> bool:
    return settings.llm_ranking_enabled and settings.llm_available


def _build_prompt(candidates: list[Candidate], want: int) -> str:
    lines = []
    for i, cand in enumerate(candidates):
        lines.append(
            f"[{i}] {cand.duration:.0f}s @ {cand.start:.0f}s — {_excerpt(cand.text)}"
        )
    return _PROMPT.format(
        count=len(candidates),
        want=want,
        min_s=settings.min_clip_seconds,
        max_s=settings.max_clip_seconds,
        candidates="\n".join(lines),
    )


def _call_anthropic(prompt: str) -> str | None:
    import httpx

    response = httpx.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": settings.anthropic_api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": "claude-sonnet-5",
            "max_tokens": 1200,
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=REQUEST_TIMEOUT,
    )
    response.raise_for_status()
    blocks = response.json().get("content", [])
    return "".join(b.get("text", "") for b in blocks if b.get("type") == "text")


def _call_openai(prompt: str) -> str | None:
    import httpx

    response = httpx.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {settings.openai_api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "gpt-4o-mini",
            "max_tokens": 1200,
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=REQUEST_TIMEOUT,
    )
    response.raise_for_status()
    choices = response.json().get("choices", [])
    return choices[0]["message"]["content"] if choices else None


def _extract_json(raw: str) -> dict | None:
    if not raw:
        return None
    match = re.search(r"\{.*\}", raw, re.S)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return None


def rerank(candidates: list[Candidate], *, want: int) -> list[RankedPick] | None:
    """Return LLM-chosen picks, or None to mean 'use the heuristic result'."""
    if not is_enabled() or not candidates:
        return None

    shortlist = candidates[:MAX_CANDIDATES_SENT]
    prompt = _build_prompt(shortlist, want)

    try:
        if settings.anthropic_api_key:
            raw = _call_anthropic(prompt)
        else:
            raw = _call_openai(prompt)
    except Exception as exc:
        log.warning("LLM ranking failed, using heuristic ranking: %s", exc)
        return None

    payload = _extract_json(raw or "")
    if not payload or not isinstance(payload.get("picks"), list):
        log.warning("LLM returned unusable output, using heuristic ranking")
        return None

    picks: list[RankedPick] = []
    seen: set[int] = set()
    for entry in payload["picks"]:
        if not isinstance(entry, dict):
            continue
        try:
            index = int(entry.get("id"))
        except (TypeError, ValueError):
            continue
        # Hard validation: the index must be one we actually offered.
        if index < 0 or index >= len(shortlist) or index in seen:
            log.info("discarding out-of-range LLM pick: %r", entry.get("id"))
            continue
        seen.add(index)

        candidate = shortlist[index]
        # Re-check the duration we already know to be true. The model cannot
        # widen a clip beyond what we generated.
        if not (settings.min_clip_seconds - 0.5 <= candidate.duration <= settings.max_clip_seconds + 0.5):
            continue

        title = entry.get("title")
        title = str(title).strip()[:80] if isinstance(title, str) and title.strip() else None
        picks.append(RankedPick(candidate=candidate, title=title))
        if len(picks) >= want:
            break

    if len(picks) < max(1, want // 2):
        log.warning("LLM returned too few valid picks, using heuristic ranking")
        return None
    return picks
