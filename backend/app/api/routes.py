"""Thin HTTP handlers for the versioned JaalDrishti API."""

from __future__ import annotations

from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Query, Request, status

from app.schemas import (
    AnalyseRequest,
    AnalysisResponse,
    AnalyticsResponse,
    DashboardSummaryResponse,
    ErrorResponse,
    ExplanationResponse,
    GenerateDemoDataRequest,
    GenerateDemoDataResponse,
    NetworkResponse,
)

router = APIRouter(prefix="/api/v1")

ERROR_RESPONSES = {
    400: {"model": ErrorResponse, "description": "Invalid bounded query"},
    404: {"model": ErrorResponse, "description": "Entity not found"},
    409: {"model": ErrorResponse, "description": "Dataset or analysis state conflict"},
    422: {"model": ErrorResponse, "description": "Contract validation failed"},
    500: {"model": ErrorResponse, "description": "Internal error without leaked details"},
}


def _service(request: Request):
    return request.app.state.application_service


def _request_id(request: Request) -> str:
    return str(request.state.request_id)


@router.post(
    "/generate_demo_data",
    response_model=GenerateDemoDataResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["demo data"],
    responses=ERROR_RESPONSES,
)
def generate_demo_data(payload: GenerateDemoDataRequest, request: Request) -> dict[str, object]:
    result = _service(request).generate_demo_data(**payload.model_dump())
    return {**result, "request_id": _request_id(request)}


@router.post(
    "/analyse",
    response_model=AnalysisResponse,
    tags=["risk intelligence"],
    responses=ERROR_RESPONSES,
)
def analyse(payload: AnalyseRequest, request: Request) -> dict[str, object]:
    stored = _service(request).analyse(payload.application_id, force_refresh=payload.force_refresh)
    return _service(request).analysis_payload(stored, _request_id(request))


@router.get(
    "/risk_score/{application_id}",
    response_model=AnalysisResponse,
    tags=["risk intelligence"],
    responses=ERROR_RESPONSES,
)
def risk_score(application_id: str, request: Request) -> dict[str, object]:
    stored = _service(request).risk_score(application_id)
    return _service(request).analysis_payload(stored, _request_id(request))


@router.get(
    "/network/{customer_id}",
    response_model=NetworkResponse,
    tags=["network intelligence"],
    responses=ERROR_RESPONSES,
)
def network(
    customer_id: str,
    request: Request,
    depth: Annotated[int, Query(ge=1, le=3)] = 2,
    max_nodes: Annotated[int, Query(ge=25, le=500)] = 150,
    as_of: datetime | None = None,
) -> dict[str, object]:
    return _service(request).network(
        customer_id,
        depth=depth,
        max_nodes=max_nodes,
        as_of=as_of,
        request_id=_request_id(request),
    )


@router.get(
    "/explanation/{application_id}",
    response_model=ExplanationResponse,
    tags=["risk intelligence"],
    responses=ERROR_RESPONSES,
)
def explanation(application_id: str, request: Request) -> dict[str, object]:
    return _service(request).explanation(application_id, _request_id(request))


@router.get(
    "/dashboard/summary",
    response_model=DashboardSummaryResponse,
    tags=["dashboard"],
    responses=ERROR_RESPONSES,
)
def dashboard_summary(request: Request, as_of: datetime | None = None) -> dict[str, object]:
    return _service(request).dashboard_summary(_request_id(request), as_of)


@router.get(
    "/analytics",
    response_model=AnalyticsResponse,
    tags=["dashboard"],
    responses=ERROR_RESPONSES,
)
def analytics(
    request: Request,
    from_date: Annotated[date | None, Query(alias="from")] = None,
    to_date: Annotated[date | None, Query(alias="to")] = None,
) -> dict[str, object]:
    return _service(request).analytics(from_date, to_date, _request_id(request))
