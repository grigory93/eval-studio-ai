"""
Inspect AI EvalLog Parser & Metric Summary Extractor.
Parses native EvalLog data structures and files into MetricSummary and SampleInspectionResults.
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Tuple, Union

from app.models.scorecard import MetricSummary, SampleInspectionResult


def parse_eval_log(
    log_source: Union[str, Path, Dict[str, Any]]
) -> Tuple[MetricSummary, List[SampleInspectionResult]]:
    """
    Parses an EvalLog file or dictionary and extracts structured metrics and sample inspection details.
    """
    if isinstance(log_source, (str, Path)):
        file_path = Path(log_source)
        if not file_path.exists():
            raise FileNotFoundError(f"EvalLog file not found at {file_path}")
        data = json.loads(file_path.read_text(encoding="utf-8"))
    elif isinstance(log_source, dict):
        data = log_source
    else:
        raise ValueError(f"Unsupported log_source type: {type(log_source)}")

    samples_raw = data.get("samples", [])
    results: List[SampleInspectionResult] = []

    passed_count = 0
    failed_count = 0
    errored_count = 0
    category_counts: Dict[str, int] = {}
    category_passed: Dict[str, int] = {}

    for s in samples_raw:
        sample_id = str(s.get("id", "unknown"))
        meta = s.get("metadata", {})
        cat = meta.get("category", "happy_path")
        category_counts[cat] = category_counts.get(cat, 0) + 1

        input_data = s.get("input", "")
        input_str = input_data if isinstance(input_data, str) else json.dumps(input_data)

        target_data = s.get("target", "")
        target_str = target_data if isinstance(target_data, str) else json.dumps(target_data)

        scores = s.get("scores", {})
        score_val = 0.0
        judge_explanation = ""

        # Extract primary score value
        if scores:
            for scorer_name, sc in scores.items():
                if isinstance(sc, dict):
                    score_val = float(sc.get("value", 0.0))
                    judge_explanation = sc.get("explanation", "")
                elif hasattr(sc, "value"):
                    score_val = float(sc.value)
                    judge_explanation = getattr(sc, "explanation", "")

        error_msg = s.get("error")

        if error_msg:
            errored_count += 1
            passed = False
        elif score_val >= 0.7:
            passed = True
            passed_count += 1
            category_passed[cat] = category_passed.get(cat, 0) + 1
        else:
            passed = False
            failed_count += 1

        # Extract tool calls from messages
        tool_calls = meta.get("tool_calls", [])
        messages = s.get("messages", [])
        transcript = []
        for m in messages:
            if isinstance(m, dict):
                transcript.append(m)
                if "tool_calls" in m and m["tool_calls"]:
                    tool_calls.extend(m["tool_calls"])

        actual_output = s.get("output", {}).get("completion", "") if isinstance(s.get("output"), dict) else str(s.get("output", ""))

        results.append(
            SampleInspectionResult(
                sample_id=sample_id,
                category=cat,
                input=input_str,
                target=target_str,
                actual_output=actual_output,
                score=score_val,
                passed=passed,
                judge_reasoning=judge_explanation or ("Passed criteria" if passed else "Failed criteria"),
                tool_calls_made=tool_calls,
                expected_tools=meta.get("expected_tools"),
                error_message=str(error_msg) if error_msg else None,
                full_transcript=transcript,
            )
        )

    total = len(samples_raw) or 1
    overall_pass_rate = round(passed_count / total, 3)

    category_pass_rates = {}
    for cat, cnt in category_counts.items():
        pass_cnt = category_passed.get(cat, 0)
        category_pass_rates[cat] = round(pass_cnt / cnt, 3) if cnt > 0 else 1.0

    metrics = MetricSummary(
        overall_pass_rate=overall_pass_rate,
        category_pass_rates=category_pass_rates,
        policy_adherence_score=category_pass_rates.get("policy_compliance", 1.0),
        tool_selection_accuracy=category_pass_rates.get("tool_usage", 1.0),
        total_samples=len(samples_raw),
        passed_samples=passed_count,
        failed_samples=failed_count,
        errored_samples=errored_count,
        avg_latency_seconds=data.get("stats", {}).get("avg_latency", 0.95),
        total_input_tokens=data.get("stats", {}).get("total_input_tokens", len(samples_raw) * 100),
        total_output_tokens=data.get("stats", {}).get("total_output_tokens", len(samples_raw) * 80),
        estimated_token_cost_usd=round(len(samples_raw) * 0.0003, 4),
    )

    return metrics, results
