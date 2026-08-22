"""
Unit tests for Tool and Interface Design in EvalStudio AI.
Verifies:
1. Complete docstrings with detailed parameter descriptions.
2. Pydantic models for input/output validation and JSON schema exports.
3. Structured error handling with explicit recovery instructions for the LLM.
"""

import pytest
import inspect
from pydantic import BaseModel, ValidationError

# HR Benefits Tools & Models
from examples.hr_benefits_adk.tools import (
    lookup_employee_pto,
    submit_leave_request,
    LookupEmployeePTOInput,
    SubmitLeaveRequestInput,
    EmployeePTOResponse,
    SubmitLeaveResponse,
    HRToolErrorResponse,
    LOOKUP_EMPLOYEE_PTO_SCHEMA,
    SUBMIT_LEAVE_REQUEST_SCHEMA,
    HR_TOOLS_SCHEMAS,
)

# Customer Support Tools & Models
from examples.customer_support_adk.tools import (
    lookup_order,
    process_refund,
    escalate_to_human,
    LookupOrderInput,
    ProcessRefundInput,
    EscalateToHumanInput,
    OrderDetailsResponse,
    RefundResponse,
    EscalationResponse,
    CustomerSupportToolErrorResponse,
    LOOKUP_ORDER_SCHEMA,
    PROCESS_REFUND_SCHEMA,
    ESCALATE_TO_HUMAN_SCHEMA,
    CUSTOMER_SUPPORT_TOOL_SCHEMAS,
)


class TestDocstringsAndInterfaceDesign:
    """Test Shortcoming 1: Docstrings and detailed parameter descriptions."""

    def test_hr_tools_docstrings(self):
        # lookup_employee_pto docstring
        doc_pto = inspect.getdoc(lookup_employee_pto)
        assert doc_pto is not None, "lookup_employee_pto must have a docstring"
        assert "Args:" in doc_pto or "Parameters" in doc_pto
        assert "employee_id" in doc_pto
        assert "Returns:" in doc_pto
        assert "Errors and Recovery:" in doc_pto or "Recovery" in doc_pto

        # submit_leave_request docstring
        doc_leave = inspect.getdoc(submit_leave_request)
        assert doc_leave is not None, "submit_leave_request must have a docstring"
        assert "employee_id" in doc_leave
        assert "days" in doc_leave
        assert "leave_type" in doc_leave
        assert "Returns:" in doc_leave

    def test_customer_support_tools_docstrings(self):
        doc_order = inspect.getdoc(lookup_order)
        assert doc_order is not None
        assert "order_id" in doc_order
        assert "Returns:" in doc_order
        assert "Errors and Recovery:" in doc_order or "Recovery" in doc_order

        doc_refund = inspect.getdoc(process_refund)
        assert doc_refund is not None
        assert "order_id" in doc_refund
        assert "amount" in doc_refund
        assert "Returns:" in doc_refund

        doc_esc = inspect.getdoc(escalate_to_human)
        assert doc_esc is not None
        assert "reason" in doc_esc
        assert "Returns:" in doc_esc


class TestPydanticSchemasAndValidation:
    """Test Shortcoming 2: Pydantic models for validation and explicit JSON schemas."""

    def test_hr_pydantic_input_models(self):
        # Valid input
        inp = LookupEmployeePTOInput(employee_id="EMP-100")
        assert inp.employee_id == "EMP-100"

        # Invalid pattern
        with pytest.raises(ValidationError):
            LookupEmployeePTOInput(employee_id="INVALID-ID")

        # Submit leave valid
        leave_inp = SubmitLeaveRequestInput(employee_id="EMP-100", days=2.5, leave_type="pto")
        assert leave_inp.days == 2.5

        # Submit leave invalid days (must be > 0)
        with pytest.raises(ValidationError):
            SubmitLeaveRequestInput(employee_id="EMP-100", days=0, leave_type="pto")

    def test_customer_support_pydantic_input_models(self):
        # Valid order ID
        inp = LookupOrderInput(order_id="ORD-101")
        assert inp.order_id == "ORD-101"

        # Invalid order ID format
        with pytest.raises(ValidationError):
            LookupOrderInput(order_id="101")

        # Valid refund input
        ref_inp = ProcessRefundInput(order_id="ORD-101", amount=50.0)
        assert ref_inp.amount == 50.0

        # Non-positive refund amount
        with pytest.raises(ValidationError):
            ProcessRefundInput(order_id="ORD-101", amount=-10.0)

        # Empty escalation reason
        with pytest.raises(ValidationError):
            EscalateToHumanInput(reason=" ")

    def test_json_schema_exports(self):
        # Verify JSON schemas are dictionaries with properties
        assert isinstance(LOOKUP_EMPLOYEE_PTO_SCHEMA, dict)
        assert "properties" in LOOKUP_EMPLOYEE_PTO_SCHEMA
        assert "employee_id" in LOOKUP_EMPLOYEE_PTO_SCHEMA["properties"]

        assert isinstance(SUBMIT_LEAVE_REQUEST_SCHEMA, dict)
        assert "days" in SUBMIT_LEAVE_REQUEST_SCHEMA["properties"]

        assert isinstance(LOOKUP_ORDER_SCHEMA, dict)
        assert "order_id" in LOOKUP_ORDER_SCHEMA["properties"]

        assert isinstance(PROCESS_REFUND_SCHEMA, dict)
        assert "amount" in PROCESS_REFUND_SCHEMA["properties"]

        assert isinstance(ESCALATE_TO_HUMAN_SCHEMA, dict)
        assert "reason" in ESCALATE_TO_HUMAN_SCHEMA["properties"]

        # Tool schema collections
        assert "lookup_employee_pto" in HR_TOOLS_SCHEMAS
        assert "submit_leave_request" in HR_TOOLS_SCHEMAS
        assert "lookup_order" in CUSTOMER_SUPPORT_TOOL_SCHEMAS
        assert "process_refund" in CUSTOMER_SUPPORT_TOOL_SCHEMAS
        assert "escalate_to_human" in CUSTOMER_SUPPORT_TOOL_SCHEMAS


class TestStructuredErrorRecovery:
    """Test Shortcoming 3: Error handling returns structured messages with recovery instructions."""

    def test_hr_lookup_employee_not_found(self):
        res = lookup_employee_pto("EMP-999")
        assert res["status"] == "error"
        assert res["error_code"] == "EMPLOYEE_NOT_FOUND"
        assert "error" in res
        assert "recovery_instruction" in res
        assert len(res["recovery_instruction"]) > 10
        assert "details" in res

    def test_hr_lookup_employee_invalid_format(self):
        res = lookup_employee_pto("invalid_id_format")
        assert res["status"] == "error"
        assert res["error_code"] == "INVALID_EMPLOYEE_ID_FORMAT"
        assert "recovery_instruction" in res

    def test_hr_submit_leave_invalid_days(self):
        res = submit_leave_request("EMP-100", days=-5.0, leave_type="pto")
        assert res["status"] == "error"
        assert res["error_code"] == "INVALID_INPUT"
        assert "recovery_instruction" in res

    def test_hr_submit_leave_employee_not_found(self):
        res = submit_leave_request("EMP-999", days=2.0, leave_type="pto")
        assert res["status"] == "error"
        assert res["error_code"] == "EMPLOYEE_NOT_FOUND"
        assert "recovery_instruction" in res

    def test_customer_support_order_not_found(self):
        res = lookup_order("ORD-999")
        assert res["status"] in ["error", "failed"]
        assert res["error_code"] == "ORDER_NOT_FOUND"
        assert "error" in res
        assert "recovery_instruction" in res
        assert "ORD-999" in res["recovery_instruction"] or "database" in res["recovery_instruction"]

    def test_customer_support_order_invalid_format(self):
        res = lookup_order("not-an-order")
        assert res["status"] in ["error", "failed"]
        assert res["error_code"] == "INVALID_ORDER_ID_FORMAT"
        assert "recovery_instruction" in res

    def test_customer_support_refund_nonexistent_order(self):
        res = process_refund("ORD-999", amount=50.0)
        assert res["status"] == "failed"
        assert res["error_code"] == "ORDER_NOT_FOUND"
        assert "recovery_instruction" in res
        assert "lookup_order" in res["recovery_instruction"]

    def test_customer_support_refund_invalid_amount(self):
        res = process_refund("ORD-101", amount=-25.0)
        assert res["status"] == "failed"
        assert res["error_code"] == "INVALID_INPUT"
        assert "recovery_instruction" in res

    def test_customer_support_escalate_empty_reason(self):
        res = escalate_to_human("")
        assert res["status"] == "failed"
        assert res["error_code"] == "INVALID_ESCALATION_REASON"
        assert "recovery_instruction" in res


class TestHappyPaths:
    """Verify tool success outputs maintain backward compatibility and full payload fidelity."""

    def test_hr_lookup_success(self):
        res = lookup_employee_pto("EMP-100")
        assert res["status"] == "success"
        assert res["employee_id"] == "EMP-100"
        assert res["name"] == "Sarah Connor"
        assert res["pto_balance"] == 8.5
        assert res["pto_accrued"] == 14.5
        assert res["pto_used"] == 6.0
        assert res["plan"] == "Premium HMO"

    def test_hr_submit_leave_success(self):
        res = submit_leave_request("EMP-100", 3.0, "pto")
        assert res["status"] == "submitted"
        assert res["request_id"] == "LV-EMP-100-01"
        assert res["employee_id"] == "EMP-100"
        assert res["days"] == 3.0
        assert res["type"] == "pto"

    def test_customer_support_lookup_success(self):
        res = lookup_order("ORD-101")
        assert res["order_id"] == "ORD-101"
        assert res["customer"] == "Alice Smith"
        assert res["item"] == "Winter Jacket"
        assert res["price"] == 85.00
        assert res["status"] == "delivered"

    def test_customer_support_refund_success(self):
        res = process_refund("ORD-101", 85.00)
        assert res["status"] == "success"
        assert res["order_id"] == "ORD-101"
        assert res["refund_amount"] == 85.00
        assert res["transaction_id"] == "TXN-REF-ORD-101"

    def test_customer_support_escalate_success(self):
        res = escalate_to_human("Order ORD-777 exceeds $100 refund limit.")
        assert res["status"] == "escalated"
        assert res["ticket_id"] == "TICKET-HUMAN-992"
        assert "ORD-777" in res["reason"]
