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
from task import customer_support_e2e_task

async def main():
    print(f"[WORKER] Starting isolated evaluation for customer_support_e2e_task with 50 samples...", flush=True)
    try:
        task_instance = customer_support_e2e_task()
        logs = eval(
            task_instance,
            model="google/gemini-2.5-flash",
            log_dir="/usr/local/google/home/gkanevsky/projects/eval-studio-ai/data/runs/eval-c7226ad0",
            fail_on_error=False,
        )
        print(f"[WORKER] Evaluation completed successfully.", flush=True)
    except Exception as e:
        print(f"[WORKER ERROR] Evaluation runner error: {e}", file=sys.stderr, flush=True)

if __name__ == "__main__":
    asyncio.run(main())
