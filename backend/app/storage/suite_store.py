"""
Persistent Evaluation Suite and Run Storage.
Enables repeatable testing, regression tracking, and baseline comparisons.
"""

import json
import logging
from pathlib import Path
from typing import Dict, List, Optional
from pydantic import BaseModel, Field

from app.config import settings
from app.models.dataset import EvalDatasetModel
from app.models.scorecard import ComparativeRunDelta, ExecutiveScorecardReport

logger = logging.getLogger(__name__)


class SuiteRecord(BaseModel):
    suite_id: str
    name: str
    description: str
    dataset: EvalDatasetModel
    target_agent_path: str
    created_at: str
    updated_at: str
    run_ids: List[str] = Field(default_factory=list)


class SuiteStore:
    """
    Filesystem-backed JSON store for evaluation suites and run reports.
    """

    def __init__(self, suites_dir: Optional[Path] = None, runs_dir: Optional[Path] = None):
        self.suites_dir = suites_dir or settings.suites_dir
        self.runs_dir = runs_dir or settings.runs_dir
        self.suites_dir.mkdir(parents=True, exist_ok=True)
        self.runs_dir.mkdir(parents=True, exist_ok=True)

    def save_suite(self, suite: SuiteRecord) -> None:
        file_path = self.suites_dir / f"{suite.suite_id}.json"
        file_path.write_text(suite.model_dump_json(indent=2), encoding="utf-8")

    def get_suite(self, suite_id: str) -> Optional[SuiteRecord]:
        file_path = self.suites_dir / f"{suite_id}.json"
        if not file_path.exists():
            return None
        try:
            data = json.loads(file_path.read_text(encoding="utf-8"))
            return SuiteRecord.model_validate(data)
        except Exception as e:
            logger.error(f"Error loading suite {suite_id}: {e}")
            return None

    def list_suites(self) -> List[SuiteRecord]:
        suites = []
        for file in self.suites_dir.glob("*.json"):
            try:
                data = json.loads(file.read_text(encoding="utf-8"))
                suites.append(SuiteRecord.model_validate(data))
            except Exception as e:
                logger.warning(f"Failed to load suite file {file}: {e}")
        return suites

    def save_run_report(self, report: ExecutiveScorecardReport) -> None:
        run_folder = self.runs_dir / report.eval_id
        run_folder.mkdir(parents=True, exist_ok=True)
        report_file = run_folder / "scorecard_report.json"
        report_file.write_text(report.model_dump_json(indent=2), encoding="utf-8")

        # Update suite run list if suite exists
        if report.suite_id:
            suite = self.get_suite(report.suite_id)
            if suite and report.eval_id not in suite.run_ids:
                suite.run_ids.append(report.eval_id)
                self.save_suite(suite)

    def get_run_report(self, eval_id: str) -> Optional[ExecutiveScorecardReport]:
        report_file = self.runs_dir / eval_id / "scorecard_report.json"
        if not report_file.exists():
            return None
        try:
            data = json.loads(report_file.read_text(encoding="utf-8"))
            return ExecutiveScorecardReport.model_validate(data)
        except Exception as e:
            logger.error(f"Error loading scorecard report {eval_id}: {e}")
            return None

    def list_runs(self, suite_id: Optional[str] = None) -> List[ExecutiveScorecardReport]:
        reports = []
        for report_file in self.runs_dir.glob("*/scorecard_report.json"):
            try:
                data = json.loads(report_file.read_text(encoding="utf-8"))
                report = ExecutiveScorecardReport.model_validate(data)
                if not suite_id or report.suite_id == suite_id:
                    reports.append(report)
            except Exception as e:
                logger.warning(f"Error reading report {report_file}: {e}")
        return sorted(reports, key=lambda r: r.timestamp, reverse=True)

    def compute_regression_delta(
        self, current: ExecutiveScorecardReport, baseline: ExecutiveScorecardReport
    ) -> ComparativeRunDelta:
        """Computes score differences and identifies newly regressed test samples."""
        current_map = {s.sample_id: s.passed for s in current.sample_details}
        baseline_map = {s.sample_id: s.passed for s in baseline.sample_details}

        newly_failed = [
            sid for sid, passed in current_map.items() if not passed and baseline_map.get(sid, True)
        ]
        newly_passed = [
            sid for sid, passed in current_map.items() if passed and not baseline_map.get(sid, False)
        ]

        overall_delta = round(current.metrics.overall_pass_rate - baseline.metrics.overall_pass_rate, 3)

        category_deltas = {}
        for cat, rate in current.metrics.category_pass_rates.items():
            base_rate = baseline.metrics.category_pass_rates.get(cat, 0.0)
            category_deltas[cat] = round(rate - base_rate, 3)

        return ComparativeRunDelta(
            baseline_eval_id=baseline.eval_id,
            baseline_timestamp=baseline.timestamp,
            overall_pass_rate_delta=overall_delta,
            category_deltas=category_deltas,
            newly_failed_sample_ids=newly_failed,
            newly_passed_sample_ids=newly_passed,
        )


suite_store = SuiteStore()
