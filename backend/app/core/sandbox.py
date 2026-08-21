"""
Execution Sandboxing & Isolation Manager.
Handles worker process limits, directory isolation, and Docker sandbox configuration.
"""

import logging
import os
import shutil
from pathlib import Path
from typing import Dict, Optional

from app.config import settings

logger = logging.getLogger(__name__)


class SandboxManager:
    """
    Manages isolated execution environments for evaluation tasks.
    """

    def __init__(self, runs_dir: Optional[Path] = None):
        self.runs_dir = runs_dir or settings.runs_dir

    def create_run_environment(self, eval_id: str) -> Path:
        """Creates a dedicated filesystem workspace for an evaluation run."""
        run_path = self.runs_dir / eval_id
        run_path.mkdir(parents=True, exist_ok=True)
        return run_path

    def cleanup_run_environment(self, eval_id: str, keep_logs: bool = True) -> None:
        """Cleans up temporary artifacts while preserving logs."""
        run_path = self.runs_dir / eval_id
        if not run_path.exists():
            return

        if not keep_logs:
            shutil.rmtree(run_path, ignore_errors=True)
        else:
            # Clean up ephemeral temp files only
            for item in run_path.glob("tmp_*"):
                if item.is_file():
                    item.unlink(missing_ok=True)
                elif item.is_dir():
                    shutil.rmtree(item, ignore_errors=True)

    def get_sandbox_env_vars(self) -> Dict[str, str]:
        """Returns sanitized environment variables for worker subprocess."""
        env = os.environ.copy()
        # Pass Vertex AI ADC variables
        env["GOOGLE_GENAI_USE_VERTEXAI"] = "true" if settings.google_genai_use_vertexai else "false"
        env["GOOGLE_CLOUD_PROJECT"] = settings.google_cloud_project
        env["GOOGLE_CLOUD_LOCATION"] = settings.google_cloud_location
        env["PYTHONPATH"] = f".:{env.get('PYTHONPATH', '')}"
        return env


sandbox_manager = SandboxManager()
