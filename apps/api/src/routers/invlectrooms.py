from typing import Any, Dict

from fastapi import APIRouter, HTTPException
from pydantic import AnyUrl, BaseModel
from starlette.concurrency import run_in_threadpool

from src.services.invlectrooms import (
    InvlectRoomsScrapeError,
    scrape_invlectrooms,
)


router = APIRouter()


class InvlectRoomsScrapeRequest(BaseModel):
    url: AnyUrl


class InvlectRoomsScrapeResponse(BaseModel):
    url: AnyUrl
    structure: Dict[str, Any]


@router.post("", response_model=InvlectRoomsScrapeResponse)
async def scrape(payload: InvlectRoomsScrapeRequest) -> Dict[str, Any]:
    try:
        return await run_in_threadpool(scrape_invlectrooms, str(payload.url))
    except InvlectRoomsScrapeError as error:
        status_code = error.status_code or 502
        raise HTTPException(status_code=status_code, detail=error.message) from error
