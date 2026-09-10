"""Shared request dependencies: ownership and file serving."""
from __future__ import annotations

import mimetypes
import re
from pathlib import Path

from fastapi import HTTPException, Request, Response, status
from fastapi.responses import FileResponse, StreamingResponse

from ..config import settings
from ..models import Clip, Job
from ..utils.files import is_within, sanitize_filename

OWNER_COOKIE = "clipgen_owner"
OWNER_HEADER = "x-owner-token"
CHUNK_SIZE = 512 * 1024
_RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)")


def owner_token_from(request: Request) -> str | None:
    """Accept the capability token from a header, a query param or a cookie.

    Media elements and download links cannot set headers, hence the query
    param; the header is what the app itself uses.
    """
    token = request.headers.get(OWNER_HEADER)
    if token:
        return token.strip()[:64]
    token = request.query_params.get("t")
    if token:
        return token.strip()[:64]
    token = request.cookies.get(OWNER_COOKIE)
    return token.strip()[:64] if token else None


def check_owner(job: Job, request: Request) -> None:
    """Job IDs are unguessable, but we still check the token - defence in depth."""
    if not job.owner_token:
        return
    provided = owner_token_from(request)
    if provided != job.owner_token:
        # 404 rather than 403: don't confirm the job exists to a stranger.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found.")


def resolve_media_path(raw_path: str | None, *, kind: str = "file") -> Path:
    """Turn a stored path into a real one, refusing anything outside our roots.

    Paths in the database were written by us, but a corrupted row or a future
    bug must not become an arbitrary-file-read.
    """
    if not raw_path:
        raise HTTPException(status_code=404, detail=f"This {kind} is no longer available.")
    path = Path(raw_path)
    if not (is_within(settings.output_dir, path) or is_within(settings.temp_dir, path)):
        raise HTTPException(status_code=404, detail=f"This {kind} is no longer available.")
    if not path.is_file():
        raise HTTPException(
            status_code=410,
            detail=f"This {kind} has been cleaned up. Generate the clips again.",
        )
    return path


def attachment_response(path: Path, filename: str, media_type: str | None = None) -> FileResponse:
    safe_name = sanitize_filename(filename, fallback="download", max_length=120)
    return FileResponse(
        path,
        media_type=media_type or mimetypes.guess_type(path.name)[0] or "application/octet-stream",
        filename=safe_name,
        headers={"Cache-Control": "private, max-age=600"},
    )


def range_response(path: Path, request: Request, media_type: str = "video/mp4") -> Response:
    """Serve a file with HTTP Range support so <video> can seek.

    Starlette's FileResponse does not negotiate ranges, and without it seeking
    in the preview player silently does nothing.
    """
    file_size = path.stat().st_size
    range_header = request.headers.get("range")

    base_headers = {
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=600",
    }

    if not range_header:
        return FileResponse(
            path,
            media_type=media_type,
            headers={**base_headers, "Content-Length": str(file_size)},
        )

    match = _RANGE_RE.fullmatch(range_header.strip())
    if not match:
        return Response(status_code=416, headers={"Content-Range": f"bytes */{file_size}"})

    start_raw, end_raw = match.groups()
    if start_raw:
        start = int(start_raw)
        end = int(end_raw) if end_raw else file_size - 1
    elif end_raw:
        # "bytes=-500" means the last 500 bytes.
        length = int(end_raw)
        start = max(0, file_size - length)
        end = file_size - 1
    else:
        return Response(status_code=416, headers={"Content-Range": f"bytes */{file_size}"})

    if start >= file_size or start > end:
        return Response(status_code=416, headers={"Content-Range": f"bytes */{file_size}"})
    end = min(end, file_size - 1)
    length = end - start + 1

    def iterator():
        with path.open("rb") as handle:
            handle.seek(start)
            remaining = length
            while remaining > 0:
                chunk = handle.read(min(CHUNK_SIZE, remaining))
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk

    return StreamingResponse(
        iterator(),
        status_code=206,
        media_type=media_type,
        headers={
            **base_headers,
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Content-Length": str(length),
        },
    )


def clip_or_404(session, clip_id: str, request: Request) -> tuple[Clip, Job]:
    clip = session.get(Clip, clip_id)
    if clip is None:
        raise HTTPException(status_code=404, detail="Clip not found.")
    job = session.get(Job, clip.job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Clip not found.")
    check_owner(job, request)
    return clip, job


def job_or_404(session, job_id: str, request: Request) -> Job:
    job = session.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    check_owner(job, request)
    return job
