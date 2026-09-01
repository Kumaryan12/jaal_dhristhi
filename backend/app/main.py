"""FastAPI application factory and ASGI entrypoint."""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.application_service import APIApplicationService
from app.api.routes import router
from app.core import APISettings
from app.core.errors import install_error_handlers
from app.core.request_ids import RequestIDMiddleware
from app.repositories import SQLiteDemoStore
from app.schemas import HealthResponse


def create_app(settings: APISettings | None = None) -> FastAPI:
    settings = settings or APISettings()
    application = FastAPI(
        title=settings.api_title,
        version=settings.api_version,
        description=(
            "Explainable lending ecosystem risk intelligence. "
            "All bundled demo records are synthetic."
        ),
    )
    application.state.settings = settings
    application.state.application_service = APIApplicationService(
        SQLiteDemoStore(settings.database_path), settings.model_path
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
    )
    application.add_middleware(RequestIDMiddleware)
    install_error_handlers(application)
    application.include_router(router)

    @application.get("/health", response_model=HealthResponse, tags=["operations"])
    def health(request: Request) -> dict[str, object]:
        service = request.app.state.application_service
        return {
            "status": "ok",
            "service": "jaaldrishti-api",
            "version": settings.api_version,
            "dataset_ready": service.store.has_active_dataset(),
        }

    return application


app = create_app()
