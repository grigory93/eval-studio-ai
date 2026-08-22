"""
EvalStudio AI - FastAPI Application Entrypoint
"""

import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.core.logging_config import setup_logging
from app.core.tracing import init_tracer_provider
from app.routers import ingest, elicitation, dataset, evaluate, scorecard

# Initialize Structured JSON Logging with PII Redaction
setup_logging(
    log_level=settings.log_level,
    json_format=settings.log_json_format,
    redact_pii_enabled=settings.redact_pii_in_logs,
)

# Initialize OpenTelemetry Distributed Tracing Provider
if settings.enable_opentelemetry:
    init_tracer_provider()

app = FastAPI(
    title="EvalStudio AI API",
    description="Agentic evaluation workbench for GenAI and LLM applications",
    version="0.1.0",
)

# Instrument FastAPI for OpenTelemetry if enabled
if settings.enable_opentelemetry:
    try:
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        FastAPIInstrumentor.instrument_app(app)
    except Exception as otel_err:
        import logging
        logging.getLogger(__name__).warning(f"Could not instrument FastAPI with OpenTelemetry: {otel_err}")

# Enable CORS for local Vite development and external frontends
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(ingest.router)
app.include_router(elicitation.router)
app.include_router(dataset.router)
app.include_router(evaluate.router)
app.include_router(scorecard.router)


@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "app": "EvalStudio AI",
        "version": "0.1.0",
        "inspect_compatible": True,
    }


# Static Frontend Assets Mounting for Production
frontend_dist = Path("frontend/dist")
if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Allow API routes to pass through
        if full_path.startswith("api/"):
            return None
        index_file = frontend_dist / "index.html"
        if index_file.exists():
            return FileResponse(str(index_file))
        return {"status": "ok", "app": "EvalStudio AI"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
