"""
Tools for HR Benefits QA Agent.
Provides employee PTO balance lookup, leave submission, and benefit policy queries
with strict Pydantic input/output validation, rich JSON schemas, and structured error recovery.
"""

from enum import Enum
from typing import Any, Dict, List, Literal, Optional, Union
from pydantic import BaseModel, Field, ValidationError

# ---------------------------------------------------------------------------
# Mock Database
# ---------------------------------------------------------------------------

MOCK_EMPLOYEES: Dict[str, Dict[str, Any]] = {
    "EMP-100": {
        "name": "Sarah Connor",
        "pto_accrued": 14.5,
        "pto_used": 6.0,
        "plan": "Premium HMO",
    },
    "EMP-200": {
        "name": "John Doe",
        "pto_accrued": 18.0,
        "pto_used": 12.0,
        "plan": "Standard PPO",
    },
}


# ---------------------------------------------------------------------------
# Pydantic Schemas for Tool Input and Output Validation
# ---------------------------------------------------------------------------

class LeaveTypeEnum(str, Enum):
    PTO = "pto"
    SICK = "sick"
    PARENTAL = "parental"
    BEREAVEMENT = "bereavement"
    UNPAID = "unpaid"


class LookupEmployeePTOInput(BaseModel):
    """Input parameters for looking up an employee's PTO balance."""
    employee_id: str = Field(
        ...,
        description="Unique employee identifier in 'EMP-XXX' format (e.g., 'EMP-100', 'EMP-200').",
        pattern=r"^EMP-\d+$",
        examples=["EMP-100", "EMP-200"],
    )


class SubmitLeaveRequestInput(BaseModel):
    """Input parameters for submitting an employee leave request."""
    employee_id: str = Field(
        ...,
        description="Unique employee identifier in 'EMP-XXX' format (e.g., 'EMP-100', 'EMP-200').",
        pattern=r"^EMP-\d+$",
        examples=["EMP-100"],
    )
    days: float = Field(
        ...,
        gt=0,
        le=365,
        description="Number of leave days requested. Must be a positive number greater than 0.",
        examples=[1.0, 3.5, 5.0],
    )
    leave_type: str = Field(
        default="pto",
        description="Type of leave requested ('pto', 'sick', 'parental', 'bereavement', 'unpaid').",
        examples=["pto", "sick", "parental"],
    )


class EmployeePTOResponse(BaseModel):
    """Successful response schema for employee PTO lookup."""
    status: Literal["success"] = "success"
    employee_id: str = Field(..., description="The verified employee identifier.")
    name: str = Field(..., description="Full legal name of the employee.")
    pto_balance: float = Field(..., description="Remaining unused PTO days (accrued minus used).")
    pto_accrued: float = Field(..., description="Total accrued PTO days to date.")
    pto_used: float = Field(..., description="Total PTO days taken so far.")
    plan: str = Field(..., description="Active healthcare benefits plan enrolled.")


class SubmitLeaveResponse(BaseModel):
    """Successful response schema for submitted leave request."""
    status: Literal["submitted"] = "submitted"
    request_id: str = Field(..., description="Generated confirmation tracking ID for the leave request.")
    employee_id: str = Field(..., description="Employee identifier who submitted the request.")
    days: float = Field(..., description="Number of leave days submitted.")
    type: str = Field(..., description="Category of leave submitted.")


class HRToolErrorResponse(BaseModel):
    """Structured error schema providing actionable recovery instructions for the LLM."""
    status: Literal["error"] = "error"
    error_code: str = Field(..., description="Machine-readable error category code.")
    error: str = Field(..., description="Human-readable description of what failed.")
    recovery_instruction: str = Field(
        ...,
        description="Explicit recovery action instructing the LLM on how to resolve the error.",
    )
    details: Optional[Dict[str, Any]] = Field(
        default=None, description="Optional diagnostic context or allowed parameter values."
    )


# ---------------------------------------------------------------------------
# Exported JSON Schemas for Tool Declarations
# ---------------------------------------------------------------------------

LOOKUP_EMPLOYEE_PTO_SCHEMA = LookupEmployeePTOInput.model_json_schema()
SUBMIT_LEAVE_REQUEST_SCHEMA = SubmitLeaveRequestInput.model_json_schema()

HR_TOOLS_SCHEMAS = {
    "lookup_employee_pto": {
        "name": "lookup_employee_pto",
        "description": "Look up an employee's accrued PTO, used PTO, remaining PTO balance, and active health plan.",
        "parameters": LOOKUP_EMPLOYEE_PTO_SCHEMA,
    },
    "submit_leave_request": {
        "name": "submit_leave_request",
        "description": "Submit a formal leave request for an employee with specified days and leave category.",
        "parameters": SUBMIT_LEAVE_REQUEST_SCHEMA,
    },
}


# ---------------------------------------------------------------------------
# Tool Implementations
# ---------------------------------------------------------------------------

def lookup_employee_pto(employee_id: str) -> Dict[str, Any]:
    """
    Look up an employee's accrued PTO, used PTO, net remaining PTO balance, and enrolled benefits plan.

    Args:
        employee_id (str): The unique employee ID formatted as 'EMP-XXX' (e.g. 'EMP-100', 'EMP-200').
            Case-insensitive; will be normalized to uppercase.

    Returns:
        Dict[str, Any]: On success, returns a dictionary containing:
            - status (str): "success"
            - employee_id (str): Normalized employee ID (e.g. "EMP-100")
            - name (str): Full name of the employee
            - pto_balance (float): Net remaining PTO days available (pto_accrued - pto_used)
            - pto_accrued (float): Total PTO days accrued
            - pto_used (float): Total PTO days used
            - plan (str): Healthcare plan name (e.g. "Premium HMO")

        On error, returns a structured error dictionary containing:
            - status (str): "error"
            - error_code (str): "INVALID_EMPLOYEE_ID_FORMAT" or "EMPLOYEE_NOT_FOUND"
            - error (str): Descriptive error message (e.g. "Employee EMP-999 not found.")
            - recovery_instruction (str): Clear instruction for the LLM on how to resolve the issue
            - details (dict, optional): Additional troubleshooting context

    Errors and Recovery:
        - INVALID_EMPLOYEE_ID_FORMAT: Occurs if the employee_id does not match the 'EMP-XXX' pattern.
          Recovery: Ask the user to provide their employee ID in the correct 'EMP-XXX' format.
        - EMPLOYEE_NOT_FOUND: Occurs if the employee ID is valid in format but not in the database.
          Recovery: Inform the user that the ID was not found and ask them to verify their badge number or contact HR.

    Example:
        >>> lookup_employee_pto("EMP-100")
        {'status': 'success', 'employee_id': 'EMP-100', 'name': 'Sarah Connor', 'pto_balance': 8.5, 'pto_accrued': 14.5, 'pto_used': 6.0, 'plan': 'Premium HMO'}
    """
    # 1. Pydantic validation
    try:
        validated_input = LookupEmployeePTOInput(employee_id=str(employee_id).strip())
    except ValidationError as ve:
        return HRToolErrorResponse(
            status="error",
            error_code="INVALID_EMPLOYEE_ID_FORMAT",
            error=f"Invalid employee ID format: '{employee_id}'. Expected format is 'EMP-XXX' with numeric suffix (e.g., 'EMP-100').",
            recovery_instruction="Ask the user to check their employee badge or HR profile and provide an ID matching the format 'EMP-XXX' (e.g. 'EMP-100').",
            details={"validation_errors": ve.errors()},
        ).model_dump()

    # 2. Database lookup
    clean_id = validated_input.employee_id.upper()
    emp = MOCK_EMPLOYEES.get(clean_id)
    if not emp:
        return HRToolErrorResponse(
            status="error",
            error_code="EMPLOYEE_NOT_FOUND",
            error=f"Employee {clean_id} not found in the HR database.",
            recovery_instruction=f"The employee ID '{clean_id}' does not exist in the records. Ask the user to verify their employee ID (e.g., EMP-100, EMP-200) or check if they are a registered active employee.",
            details={"searched_id": clean_id, "example_valid_ids": list(MOCK_EMPLOYEES.keys())},
        ).model_dump()

    # 3. Successful response
    pto_balance = round(emp["pto_accrued"] - emp["pto_used"], 2)
    response = EmployeePTOResponse(
        status="success",
        employee_id=clean_id,
        name=emp["name"],
        pto_balance=pto_balance,
        pto_accrued=emp["pto_accrued"],
        pto_used=emp["pto_used"],
        plan=emp["plan"],
    )
    return response.model_dump()


def submit_leave_request(employee_id: str, days: float, leave_type: str = "pto") -> Dict[str, Any]:
    """
    Submit a formal leave request for an employee for a designated duration and leave category.

    Args:
        employee_id (str): Unique employee ID in 'EMP-XXX' format (e.g., 'EMP-100').
        days (float): Number of days of leave requested. Must be positive (> 0) and <= 365.
        leave_type (str, optional): Category of leave ('pto', 'sick', 'parental', 'bereavement', 'unpaid').
            Defaults to "pto".

    Returns:
        Dict[str, Any]: On success, returns a dictionary containing:
            - status (str): "submitted"
            - request_id (str): Unique tracking ID for the leave request (e.g., "LV-EMP-100-01")
            - employee_id (str): The employee ID associated with the request
            - days (float): The approved requested days
            - type (str): The leave category

        On error, returns a structured error dictionary containing:
            - status (str): "error"
            - error_code (str): Machine-readable code ("INVALID_INPUT", "EMPLOYEE_NOT_FOUND")
            - error (str): Descriptive error message
            - recovery_instruction (str): Clear instructions for the LLM on how to resolve the error
            - details (dict, optional): Diagnostic parameters and constraints

    Errors and Recovery:
        - INVALID_INPUT: Occurs if arguments fail type or schema validation (e.g. days <= 0 or invalid leave_type).
          Recovery: Re-prompt the user or supply arguments satisfying Pydantic constraints.
        - EMPLOYEE_NOT_FOUND: Occurs if the employee is not found in the HR database.
          Recovery: Check the employee ID with lookup_employee_pto before submitting leave.

    Example:
        >>> submit_leave_request("EMP-100", 2.0, "pto")
        {'status': 'submitted', 'request_id': 'LV-EMP-100-01', 'employee_id': 'EMP-100', 'days': 2.0, 'type': 'pto'}
    """
    # 1. Pydantic validation
    try:
        validated_input = SubmitLeaveRequestInput(
            employee_id=str(employee_id).strip(),
            days=float(days),
            leave_type=str(leave_type).strip().lower(),
        )
    except (ValidationError, ValueError, TypeError) as exc:
        return HRToolErrorResponse(
            status="error",
            error_code="INVALID_INPUT",
            error=f"Invalid leave request parameters: {str(exc)}",
            recovery_instruction="Ensure 'employee_id' matches 'EMP-XXX' format, 'days' is a positive number (> 0), and 'leave_type' is one of ['pto', 'sick', 'parental', 'bereavement', 'unpaid'].",
            details={"provided": {"employee_id": employee_id, "days": days, "leave_type": leave_type}},
        ).model_dump()

    clean_id = validated_input.employee_id.upper()
    emp = MOCK_EMPLOYEES.get(clean_id)
    if not emp:
        return HRToolErrorResponse(
            status="error",
            error_code="EMPLOYEE_NOT_FOUND",
            error=f"Cannot submit leave request: Employee {clean_id} not found.",
            recovery_instruction=f"Employee '{clean_id}' does not exist in the HR database. Ask the employee to verify their employee ID before submitting a leave request.",
            details={"searched_id": clean_id},
        ).model_dump()

    response = SubmitLeaveResponse(
        status="submitted",
        request_id=f"LV-{clean_id}-01",
        employee_id=clean_id,
        days=validated_input.days,
        type=validated_input.leave_type,
    )
    return response.model_dump()

