"""Filesystem helpers: safe paths, safe names, disk checks."""
from __future__ import annotations

import re
import shutil
import unicodedata
from pathlib import Path

_UNSAFE = re.compile(r"[^A-Za-z0-9._-]+")
_WINDOWS_RESERVED = {
    "CON", "PRN", "AUX", "NUL",
    *(f"COM{i}" for i in range(1, 10)),
    *(f"LPT{i}" for i in range(1, 10)),
}


def sanitize_filename(name: str, *, fallback: str = "file", max_length: int = 80) -> str:
    """Reduce arbitrary text (video titles!) to a safe filename component.

    Titles come from YouTube, i.e. from a stranger. They can contain slashes,
    null bytes, right-to-left overrides and 300 emoji. Everything that isn't a
    plain ASCII word character is stripped.
    """
    if not name:
        return fallback
    normalized = unicodedata.normalize("NFKD", str(name))
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    cleaned = _UNSAFE.sub("_", ascii_only).strip("._-")
    cleaned = re.sub(r"_{2,}", "_", cleaned)
    if not cleaned:
        return fallback
    cleaned = cleaned[:max_length].strip("._-") or fallback
    # Applied last: an earlier prefix would be removed by the strip above.
    if cleaned.split(".")[0].upper() in _WINDOWS_RESERVED:
        cleaned = f"file_{cleaned}"
    return cleaned


def safe_join(root: Path, *parts: str) -> Path:
    """Join under `root` and guarantee the result stays inside it.

    Defeats `../` traversal and absolute-path injection.
    """
    root = Path(root).resolve()
    candidate = root
    for part in parts:
        candidate = candidate / str(part)
    resolved = candidate.resolve()
    if resolved != root and root not in resolved.parents:
        raise ValueError("Resolved path escapes its root directory")
    return resolved


def is_within(root: Path, path: Path) -> bool:
    try:
        root_r = Path(root).resolve()
        path_r = Path(path).resolve()
    except OSError:
        return False
    return path_r == root_r or root_r in path_r.parents


def free_disk_mb(path: Path) -> int:
    target = Path(path)
    while not target.exists() and target != target.parent:
        target = target.parent
    usage = shutil.disk_usage(target)
    return usage.free // (1024 * 1024)


def dir_size_bytes(path: Path) -> int:
    total = 0
    for item in Path(path).rglob("*"):
        if item.is_file():
            try:
                total += item.stat().st_size
            except OSError:
                pass
    return total


def remove_tree(path: Path) -> None:
    shutil.rmtree(Path(path), ignore_errors=True)


def format_timestamp(seconds: float) -> str:
    """0:48 / 1:02:33 - for display."""
    seconds = max(0, int(round(seconds)))
    hours, remainder = divmod(seconds, 3600)
    minutes, secs = divmod(remainder, 60)
    if hours:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes}:{secs:02d}"
