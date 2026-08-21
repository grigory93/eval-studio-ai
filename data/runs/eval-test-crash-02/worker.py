"""Worker runner executing inspect evaluation."""
import asyncio
import json
import os
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, "/usr/local/google/home/gkanevsky/projects/eval-studio-ai")

from inspect_ai import eval
from app.agents.compiler import TaskCompiler
from task import test_crash_eval

async def main():
    print(f"[WORKER] Starting isolated evaluation for test_crash_eval with 1 samples...", flush=True)
    try:
        task_instance = test_crash_eval()
        logs = eval(
            task_instance,
            model="google/gemini-2.5-flash",
            log_dir="/usr/local/google/home/gkanevsky/projects/eval-studio-ai/data/runs/eval-test-crash-02",
            fail_on_error=False,
        )
        print(f"[WORKER] Evaluation completed successfully.", flush=True)
    except Exception as e:
        print(f"[WORKER ERROR] Evaluation runner error: {e}", file=sys.stderr, flush=True)

if __name__ == "__main__":
    asyncio.run(main())
