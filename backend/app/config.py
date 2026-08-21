"""
Configuration and GCP Vertex AI ADC Environment Settings.
Strictly adheres to Application Default Credentials (ADC) - No API keys used.
"""

import os
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "EvalStudio AI"
    app_version: str = "0.1.0"
    debug: bool = False

    # Server settings
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: list[str] = ["*"]

    # Storage paths
    data_dir: Path = Path(os.getenv("EVALSTUDIO_DATA_DIR", "./data"))
    runs_dir: Path = Path(os.getenv("EVALSTUDIO_RUNS_DIR", "./data/runs"))
    suites_dir: Path = Path(os.getenv("EVALSTUDIO_SUITES_DIR", "./data/suites"))

    # Google Cloud & Vertex AI ADC configuration
    # Note: Vertex AI uses Application Default Credentials (ADC).
    google_genai_use_vertexai: bool = os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "true").lower() == "true"
    google_cloud_project: str = os.getenv("GOOGLE_CLOUD_PROJECT", "eval-studio-demo")
    google_cloud_location: str = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
    default_model: str = os.getenv("DEFAULT_GENAI_MODEL", "gemini-2.5-flash")
    default_judge_model: str = os.getenv("DEFAULT_JUDGE_MODEL", "google/gemini-2.5-flash")

    # Execution limits & sandbox settings
    worker_timeout_seconds: int = 300
    max_eval_samples: int = 200
    docker_sandbox_enabled: bool = os.getenv("DOCKER_SANDBOX_ENABLED", "false").lower() == "true"

    def setup_directories(self) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.runs_dir.mkdir(parents=True, exist_ok=True)
        self.suites_dir.mkdir(parents=True, exist_ok=True)


settings = Settings()
settings.setup_directories()
