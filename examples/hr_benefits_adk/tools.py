"""
Tools for HR Benefits QA Agent.
"""

from typing import Dict, Any

MOCK_EMPLOYEES: Dict[str, Dict[str, Any]] = {
    "EMP-100": {"name": "Sarah Connor", "pto_accrued": 14.5, "pto_used": 6.0, "plan": "Premium HMO"},
    "EMP-200": {"name": "John Doe", "pto_accrued": 18.0, "pto_used": 12.0, "plan": "Standard PPO"},
}

def lookup_employee_pto(employee_id: str) -> Dict[str, Any]:
    emp = MOCK_EMPLOYEES.get(employee_id.upper())
    if not emp:
        return {"error": f"Employee {employee_id} not found."}
    return {"employee_id": employee_id, "pto_balance": emp["pto_accrued"] - emp["pto_used"]}

def submit_leave_request(employee_id: str, days: float, leave_type: str) -> Dict[str, Any]:
    return {"status": "submitted", "request_id": f"LV-{employee_id}-01", "days": days, "type": leave_type}
