"""
Fast JSON responses for large payloads.

FastAPI's default path for a route with a declared response_model walks the
returned object several times: once to dump the model, once more through
jsonable_encoder, and finally through the stdlib json encoder. On this codebase
that is pydantic v1, whose dump is pure Python, and the stdlib encoder is roughly
two orders of magnitude slower than orjson on a megabyte-scale payload.

For the handful of endpoints that return whole courses (hundreds of kilobytes to
megabytes of map state and activity content) that overhead runs on the event
loop and becomes the throughput ceiling for the entire API. These helpers dump
once and encode with orjson instead.

Routes using them should declare `response_model=None` and document the real
shape via `responses={200: {'model': ...}}` so the OpenAPI schema stays honest.
"""

from typing import Any

import orjson
from fastapi import Response


def _dump(model: Any, by_alias: bool) -> Any:
    # SQLModel on pydantic v1 exposes both; model_dump is the forward-compatible
    # spelling and simply delegates to dict().
    dump = getattr(model, 'model_dump', None) or getattr(model, 'dict', None)
    if dump is None:
        return model
    return dump(by_alias=by_alias)


def orjson_response(
    payload: Any,
    *,
    by_alias: bool = True,
    status_code: int = 200,
) -> Response:
    """
    Serialize a pydantic model, or a sequence of them, straight to JSON bytes.

    `by_alias` defaults to True to match what FastAPI's response_model path
    emits, so callers keep field aliases such as `tabStore` and `tabMetadata`.
    """
    # Only real sequences are treated as collections. Do not fall back to a
    # generic Iterable check: pydantic v1 models define __iter__ (it yields
    # field name/value pairs), so a single model would be mistaken for a list
    # of its own fields.
    if isinstance(payload, (list, tuple)):
        content = [_dump(item, by_alias) for item in payload]
    else:
        content = _dump(payload, by_alias)

    return Response(
        content=orjson.dumps(content),
        media_type='application/json',
        status_code=status_code,
    )
