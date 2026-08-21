"""
HR Benefits ADK Target Agent under evaluation.
"""

from typing import Any, Dict
import re
from examples.hr_benefits_adk.tools import lookup_employee_pto, submit_leave_request


class HRBenefitsAgent:
    def __init__(self):
        self.tools = {
            "lookup_employee_pto": lookup_employee_pto,
            "submit_leave_request": submit_leave_request,
        }

    async def run(self, user_input: str) -> Dict[str, Any]:
        tool_calls = []
        response_text = ""

        emp_match = re.search(r"EMP-[0-9]+", user_input, re.IGNORECASE)
        emp_id = emp_match.group(0).upper() if emp_match else None

        if emp_id:
            pto_data = lookup_employee_pto(emp_id)
            tool_calls.append({"tool": "lookup_employee_pto", "args": {"employee_id": emp_id}, "result": pto_data})
            if "error" in pto_data:
                response_text = f"Employee {emp_id} not found."
            else:
                response_text = f"Employee {emp_id} has a remaining PTO balance of {pto_data['pto_balance']} days."
        else:
            if "pto" in user_input.lower() or "vacation" in user_input.lower():
                response_text = "Full-time employees accrue 18 days of PTO annually (1.5 days/month). Up to 5 days can roll over to next year."
            elif "401k" in user_input.lower() or "match" in user_input.lower():
                response_text = "The company matches 100% of employee contributions up to 4%, plus 50% on the next 2% (max 5% total match)."
            elif "parental" in user_input.lower() or "maternity" in user_input.lower():
                response_text = "Primary caregivers receive 16 weeks of fully paid parental leave; secondary caregivers receive 8 weeks."
            else:
                response_text = "Hello! I am your HR Benefits Assistant. How can I help with PTO, insurance, 401(k), or leave policies?"

        return {"output": response_text, "tool_calls": tool_calls}


root_agent = HRBenefitsAgent()
