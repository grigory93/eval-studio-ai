"""
Executive Scorecard, Diagnostics, and Regression Comparison Router.
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel

from app.agents.diagnostics import diagnostic_agent
from app.models.scorecard import ComparativeRunDelta, ExecutiveScorecardReport
from app.routers.evaluate import get_scorecard_by_id
from app.storage.suite_store import suite_store

router = APIRouter(prefix="/api/scorecard", tags=["Scorecard"])


@router.get("/{eval_id}", response_model=ExecutiveScorecardReport)
async def get_scorecard(eval_id: str):
    """Retrieves an executive scorecard report by eval_id."""
    report = get_scorecard_by_id(eval_id) or suite_store.get_run_report(eval_id)
    if not report:
        raise HTTPException(
            status_code=404, detail=f"Scorecard report for evaluation {eval_id} not found."
        )
    return report


@router.get("/{eval_id}/compare/{baseline_id}", response_model=ExecutiveScorecardReport)
async def compare_runs(eval_id: str, baseline_id: str):
    """Computes comparative regression delta against a baseline run."""
    current = get_scorecard_by_id(eval_id) or suite_store.get_run_report(eval_id)
    if not current:
        raise HTTPException(status_code=404, detail=f"Current evaluation {eval_id} not found.")

    baseline = suite_store.get_run_report(baseline_id)
    if not baseline:
        raise HTTPException(status_code=404, detail=f"Baseline evaluation {baseline_id} not found.")

    delta = suite_store.compute_regression_delta(current, baseline)
    comparative_report = current.model_copy(update={"comparative_delta": delta})
    return comparative_report


@router.get("/history/list", response_model=List[ExecutiveScorecardReport])
async def list_eval_history(suite_id: Optional[str] = None):
    """Lists historical evaluation runs."""
    return suite_store.list_runs(suite_id=suite_id)


@router.get("/{eval_id}/export/markdown")
async def export_scorecard_markdown(eval_id: str):
    """Exports executive scorecard as human-readable Markdown report."""
    report = get_scorecard_by_id(eval_id) or suite_store.get_run_report(eval_id)
    if not report:
        raise HTTPException(status_code=404, detail="Scorecard not found.")

    md = f"""# Executive Evaluation Scorecard: {report.task_name}
**Eval ID**: `{report.eval_id}`  
**Timestamp**: {report.timestamp}  
**Overall Pass Rate**: **{int(report.metrics.overall_pass_rate * 100)}%** ({report.metrics.passed_samples}/{report.metrics.total_samples} samples passed)

---

## Executive Summary
{report.executive_summary}

---

## KPI Metrics
| Metric | Value |
|---|---|
| **Overall Pass Rate** | {int(report.metrics.overall_pass_rate * 100)}% |
| **Policy Adherence Score** | {int(report.metrics.policy_adherence_score * 100)}% |
| **Tool Selection Accuracy** | {int(report.metrics.tool_selection_accuracy * 100)}% |
| **Total Samples** | {report.metrics.total_samples} |
| **Passed Samples** | {report.metrics.passed_samples} |
| **Failed Samples** | {report.metrics.failed_samples} |
| **Errored Samples** | {report.metrics.errored_samples} |
| **Avg Latency** | {report.metrics.avg_latency_seconds}s |
| **Estimated Cost** | ${report.metrics.estimated_token_cost_usd} USD |

---

## Category Breakdown
"""
    for cat, rate in report.metrics.category_pass_rates.items():
        md += f"- **{cat}**: {int(rate * 100)}%\n"

    md += "\n---\n\n## Failure Clusters & Root Causes\n"
    if not report.failure_clusters:
        md += "_No systematic failure clusters detected._\n"
    else:
        for c in report.failure_clusters:
            md += f"### ⚠️ {c.title} ({c.failure_count} failures)\n"
            md += f"- **Category**: `{c.category}`\n"
            md += f"- **Description**: {c.description}\n"
            md += f"- **Root Cause**: {c.root_cause}\n"
            md += f"- **Suggested Fix**: `{c.suggested_fix}`\n\n"

    md += "---\n\n## Actionable Recommendations\n"
    for idx, rec in enumerate(report.actionable_recommendations):
        md += f"{idx+1}. {rec}\n"

    return Response(
        content=md,
        media_type="text/markdown",
        headers={"Content-Disposition": f"attachment; filename=scorecard_{eval_id}.md"},
    )
