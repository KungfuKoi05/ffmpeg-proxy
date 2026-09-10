"""Small text helpers used by the scorer. No external NLP dependency."""
from __future__ import annotations

import math
import re
from collections import Counter

TERMINAL_PUNCT = ".!?"

WORD_RE = re.compile(r"[a-z0-9']+")

# Words that carry no topic information - excluded from similarity/density.
STOPWORDS = frozenset(
    """
a about above after again against all am an and any are aren't as at be because been
before being below between both but by can cannot could couldn't did didn't do does
doesn't doing don't down during each few for from further had hadn't has hasn't have
haven't having he he'd he'll he's her here here's hers herself him himself his how
how's i i'd i'll i'm i've if in into is isn't it it's its itself let's me more most
mustn't my myself no nor not of off on once only or other ought our ours ourselves
out over own same shan't she she'd she'll she's should shouldn't so some such than
that that's the their theirs them themselves then there there's these they they'd
they'll they're they've this those through to too under until up very was wasn't we
we'd we'll we're we've were weren't what what's when when's where where's which while
who who's whom why why's with won't would wouldn't you you'd you'll you're you've
your yours yourself yourselves just really actually gonna kind sort like okay yeah
uh um oh right well going get got go going one two thing things lot
""".split()
)

# Openings that signal a self-contained hook.
HOOK_STARTERS = (
    "here's", "here is", "the truth", "most people", "nobody", "everybody", "everyone",
    "the biggest", "the number one", "the reason", "the problem", "the secret",
    "what if", "imagine", "let me tell you", "i want to", "you need to", "you should",
    "the thing is", "look", "listen", "the first", "the best", "the worst",
    "this is why", "that's why", "the key", "one of the", "there are", "there's a",
    "i learned", "i realized", "i used to", "when i", "so i", "my favorite",
    "a lot of people", "if you", "you can", "never", "always", "stop",
)

# Openings that clearly continue a previous thought - bad clip starts.
DANGLING_STARTERS = (
    "and", "so", "but", "because", "which", "or", "then", "also", "plus", "anyway",
    "however", "therefore", "though", "although", "that", "it", "this", "they",
    "he", "she", "those", "these", "them",
)

QUESTION_WORDS = ("what", "why", "how", "when", "where", "who", "which", "is", "are", "do", "does", "can", "should", "would")

# Words that tend to mark a charged or high-stakes moment.
EMOTION_WORDS = frozenset(
    """
amazing incredible insane crazy shocking unbelievable terrible awful horrible best
worst love hate fear scared terrified excited thrilled devastated furious angry
brilliant genius stupid ridiculous hilarious funny wild nuts massive huge enormous
tiny disaster catastrophe miracle breakthrough failure fail win lose died death
never always everyone nobody everything nothing must critical vital essential
dangerous risky proud ashamed regret grateful painful beautiful ugly perfect
""".split()
)

# Words that signal explanation / information density.
INSIGHT_WORDS = frozenset(
    """
because reason why means result therefore so basically essentially specifically
example instead however although actually turns realize realized discovered found
learned understand understanding key point important difference between compared
first second third finally conclusion lesson takeaway rule principle strategy
method process step approach mistake solution answer secret truth fact evidence
research study data percent percentage number
""".split()
)

NUMBER_RE = re.compile(r"\b\d+([.,]\d+)?%?\b")
LAUGH_RE = re.compile(r"\[(laughter|laughs|applause|music)\]", re.I)


def tokenize(text: str) -> list[str]:
    return WORD_RE.findall(text.lower())


def content_words(text: str) -> list[str]:
    return [t for t in tokenize(text) if t not in STOPWORDS and len(t) > 2]


def term_vector(text: str) -> Counter:
    return Counter(content_words(text))


def cosine(a: Counter, b: Counter) -> float:
    if not a or not b:
        return 0.0
    common = set(a) & set(b)
    if not common:
        return 0.0
    dot = sum(a[t] * b[t] for t in common)
    norm_a = math.sqrt(sum(v * v for v in a.values()))
    norm_b = math.sqrt(sum(v * v for v in b.values()))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def starts_with_any(text: str, prefixes: tuple[str, ...]) -> bool:
    lowered = text.strip().lower()
    return any(lowered.startswith(p) for p in prefixes)


def first_word(text: str) -> str:
    tokens = tokenize(text)
    return tokens[0] if tokens else ""


def ends_sentence(text: str) -> bool:
    stripped = text.strip()
    return bool(stripped) and stripped[-1] in TERMINAL_PUNCT


def is_question(text: str) -> bool:
    stripped = text.strip()
    if stripped.endswith("?"):
        return True
    return first_word(stripped) in QUESTION_WORDS and len(tokenize(stripped)) > 3


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def bell(value: float, center: float, width: float) -> float:
    """1.0 at `center`, decaying smoothly. Used for 'ideal duration' style scores."""
    if width <= 0:
        return 1.0 if value == center else 0.0
    return math.exp(-((value - center) ** 2) / (2 * width * width))
