"""
EvalStudio AI - FastAPI Application Entrypoint
"""

import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.routers import ingest, elicitation, dataset, evaluate, scorecard

app = FastAPI(
    title="EvalStudio AI API",
    description="Agentic evaluation workbench for GenAI and LLM applications",
    version="0.1.0",
)

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
