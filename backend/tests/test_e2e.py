"""
End-to-End Integration Test Suite for EvalStudio AI.
Executes the full 6-step lifecycle:
Ingest -> Socratic Elicitation -> Dataset Synthesis -> Task Compilation -> Execution -> Scorecard & Diagnostics.
"""

import pytest
import asyncio
import httpx
from app.main import app


@pytest.mark.asyncio
async def test_complete_e2e_evaluation_workflow():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # -------------------------------------------------------------
        # 1. Document Ingestion
        # -------------------------------------------------------------
        policy_md = """# Customer Support Return & Refund Policy
1. Return window is 30 calendar days with original receipt.
2. Hygiene and personal care items (underwear, skincare) are strictly non-refundable once opened.
3. Refunds over $100 require human supervisor escalation.
"""
        ingest_res = await client.post(
            "/api/ingest/text",
            json={"title": "E-Commerce Refund Policy", "text": policy_md},
        )
        assert ingest_res.status_code == 200
        doc = ingest_res.json()
        doc_id = doc["doc_id"]
        assert doc_id.startswith("doc-")

        # -------------------------------------------------------------
        # 2. Socratic Elicitation & Clarification
        # -------------------------------------------------------------
        init_res = await client.post("/api/elicitation/initiate", json={"doc_id": doc_id})
        assert init_res.status_code == 200
        elicitation = init_res.json()
        criteria = elicitation["criteria"]
        assert criteria["criteria_id"].startswith("crit-")

        # User answers probing question to confirm criteria
        chat_res = await client.post(
            "/api/elicitation/chat",
            json={
                "session_id": criteria["criteria_id"],
                "message": "Hygiene items are strictly non-refundable under all circumstances.",
                "doc_id": doc_id,
                "existing_criteria": criteria,
            },
        )
        assert chat_res.status_code == 200
        updated_criteria = chat_res.json()["updated_criteria"]

        confirm_res = await client.post("/api/elicitation/confirm", json=updated_criteria)
        assert confirm_res.status_code == 200
        confirmed_criteria = confirm_res.json()
        assert confirmed_criteria["is_confirmed"] is True

        # -------------------------------------------------------------
        # 3. Multi-Category Dataset Synthesis (50 Samples)
        # -------------------------------------------------------------
        synth_res = await client.post(
            "/api/dataset/synthesize",
            json={
                "confirmed_criteria_id": confirmed_criteria["criteria_id"],
                "use_case": confirmed_criteria["use_case"],
                "domain_rules": confirmed_criteria["domain_rules"],
                "sample_count": 50,
            },
        )
        assert synth_res.status_code == 200
        dataset = synth_res.json()
        assert dataset["total_count"] == 50
        assert len(dataset["samples"]) == 50

        # -------------------------------------------------------------
        # 4. Inspect AI Task Compilation & Mermaid Generation
        # -------------------------------------------------------------
        compile_res = await client.post(
            "/api/eval/compile",
            json={
                "dataset_id": dataset["id"],
                "target_agent_path": "examples/customer_support_adk/agent.py:root_agent",
                "task_name": "customer_support_e2e_task",
                "fail_on_error": False,
            },
        )
        assert compile_res.status_code == 200
        compiled_task = compile_res.json()
        assert "sequenceDiagram" in compiled_task["mermaid_diagram"]["diagram_code"]
        assert "DATASET = MemoryDataset" in compiled_task["task_code"]

        # -------------------------------------------------------------
        # 5. Live Evaluation Execution in Sandbox Subprocess
        # -------------------------------------------------------------
        start_res = await client.post(
            "/api/eval/start",
            json={
                "task_id": compiled_task["task_id"],
                "dataset_id": dataset["id"],
                "target_agent_path": "examples/customer_support_adk/agent.py:root_agent",
            },
        )
        assert start_res.status_code == 200
        eval_id = start_res.json()["eval_id"]

        # -------------------------------------------------------------
        # 6. Scorecard & Diagnostic Verification
        # -------------------------------------------------------------
        scorecard = None
        for _ in range(40):
            status_res = await client.get(f"/api/eval/{eval_id}/status")
            if status_res.status_code == 200 and status_res.json().get("has_scorecard"):
                sc_res = await client.get(f"/api/scorecard/{eval_id}")
                if sc_res.status_code == 200:
                    scorecard = sc_res.json()
                    break
            await asyncio.sleep(0.5)

        assert scorecard is not None, "Scorecard generation timed out."
        assert scorecard["eval_id"] == eval_id
        assert scorecard["metrics"]["total_samples"] == 50
        assert scorecard["metrics"]["overall_pass_rate"] > 0.50

        # Diagnostic quality check: Failure cluster identified the hygiene refund flaw in the sample agent
        assert len(scorecard["failure_clusters"]) >= 1
        assert any(
            "hygiene" in c["title"].lower() or "policy" in c["category"].lower()
            for c in scorecard["failure_clusters"]
        )
        assert len(scorecard["actionable_recommendations"]) >= 1

        # Export check
        md_res = await client.get(f"/api/scorecard/{eval_id}/export/markdown")
        assert md_res.status_code == 200
        assert eval_id in md_res.text
