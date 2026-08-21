"""
Unit tests for Dataset API Router and CRUD operations.
"""

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_synthesize_and_crud_workflow():
    # 1. Synthesize dataset
    payload = {
        "use_case": "Customer Support Agent",
        "domain_rules": ["30 day returns", "No opened hygiene item refunds"],
        "sample_count": 21,
    }
    synth_res = client.post("/api/dataset/synthesize", json=payload)
    assert synth_res.status_code == 200
    dataset = synth_res.json()
    dataset_id = dataset["id"]
    assert dataset["total_count"] == 21
    assert len(dataset["samples"]) == 21

    # 2. Get dataset by ID
    get_res = client.get(f"/api/dataset/{dataset_id}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == dataset["name"]

    # 3. Update sample
    target_sample_id = dataset["samples"][0]["id"]
    update_payload = {
        "input": "Modified prompt test query",
        "target": "Modified expected target",
        "difficulty": "hard",
    }
    put_res = client.put(
        f"/api/dataset/{dataset_id}/samples/{target_sample_id}",
        json=update_payload,
    )
    assert put_res.status_code == 200
    updated_sample = put_res.json()
    assert updated_sample["input"] == "Modified prompt test query"
    assert updated_sample["metadata"]["difficulty"] == "hard"

    # 4. Add custom sample
    add_payload = {
        "input": "Custom manual test case",
        "target": "Custom ground truth",
        "category": "edge_case",
        "grading_rubric": "Verify edge case handling",
        "expected_tools": ["lookup_order"],
    }
    add_res = client.post(f"/api/dataset/{dataset_id}/samples", json=add_payload)
    assert add_res.status_code == 200
    new_sample = add_res.json()
    assert new_sample["input"] == "Custom manual test case"

    # Verify total count increased
    get_res2 = client.get(f"/api/dataset/{dataset_id}")
    assert get_res2.json()["total_count"] == 22

    # 5. Delete sample
    del_res = client.delete(f"/api/dataset/{dataset_id}/samples/{new_sample['id']}")
    assert del_res.status_code == 200
    assert del_res.json()["remaining_count"] == 21
