"""
Tools for Customer Support ADK Agent.
Provides order lookup, refund processing, and supervisor escalation
with strict Pydantic input/output validation, rich JSON schemas, and structured error recovery.
"""

from typing import Any, Dict, List, Literal, Optional, Union
from pydantic import BaseModel, Field, ValidationError

# ---------------------------------------------------------------------------
# Mock Database
# ---------------------------------------------------------------------------

MOCK_ORDERS: Dict[str, Dict[str, Any]] = {
    "ORD-101": {
        "order_id": "ORD-101",
        "customer": "Alice Smith",
        "item": "Winter Jacket",
        "category": "apparel",
        "price": 85.00,
        "purchase_days_ago": 10,
        "opened": False,
        "status": "delivered",
    },
    "ORD-205": {
        "order_id": "ORD-205",
        "customer": "Bob Jones",
        "item": "Running Shoes",
        "category": "footwear",
        "price": 120.00,
        "purchase_days_ago": 5,
        "opened": True,
        "status": "in_transit",
    },
    "ORD-444": {
        "order_id": "ORD-444",
        "customer": "Charlie Brown",
        "item": "Luxury Skincare Serum",
        "category": "hygiene",
        "price": 65.00,
        "purchase_days_ago": 4,
        "opened": True,
        "status": "delivered",
    },
    "ORD-888": {
        "order_id": "ORD-888",
        "customer": "David Miller",
        "item": "Cotton Underwear Pack",
        "category": "hygiene",
        "price": 35.00,
        "purchase_days_ago": 8,
        "opened": True,
        "status": "delivered",
    },
    "ORD-777": {
        "order_id": "ORD-777",
        "customer": "Emma Watson",
        "item": "Designer Leather Handbag",
        "category": "accessories",
        "price": 350.00,
        "purchase_days_ago": 12,
        "opened": False,
        "status": "delivered",
    },
}


# ---------------------------------------------------------------------------
# Pydantic Schemas for Tool Input and Output Validation
# ---------------------------------------------------------------------------

class LookupOrderInput(BaseModel):
    """Input schema for looking up order information."""
    order_id: str = Field(
        ...,
        description="Unique customer order identifier in 'ORD-XXX' format (e.g., 'ORD-101', 'ORD-205').",
        pattern=r"^ORD-\d+$",
        examples=["ORD-101", "ORD-205", "ORD-444"],
    )


class ProcessRefundInput(BaseModel):
    """Input schema for processing a financial refund for an order."""
    order_id: str = Field(
        ...,
        description="Unique customer order identifier in 'ORD-XXX' format (e.g., 'ORD-101').",
        pattern=r"^ORD-\d+$",
        examples=["ORD-101"],
    )
    amount: float = Field(
        ...,
        gt=0,
        description="Positive dollar amount to refund (e.g. 85.00). Must be greater than 0.",
        examples=[35.00, 65.00, 85.00],
    )


class EscalateToHumanInput(BaseModel):
    """Input schema for escalating a ticket/issue to a human supervisor."""
    reason: str = Field(
        ...,
        min_length=3,
        description="Detailed explanation of the customer issue, order details, or policy rule requiring human supervisor intervention.",
        examples=["Order ORD-777 refund amount of $350.00 exceeds automated agent limit ($100)."],
    )


class OrderDetailsResponse(BaseModel):
    """Successful schema for order details lookup."""
    order_id: str = Field(..., description="Unique order identifier.")
    customer: str = Field(..., description="Full customer name.")
    item: str = Field(..., description="Purchased item product name.")
    category: str = Field(..., description="Product category classification (e.g. 'apparel', 'hygiene', 'accessories').")
    price: float = Field(..., description="Total purchase price in USD.")
    purchase_days_ago: int = Field(..., description="Number of days elapsed since order date.")
    opened: bool = Field(..., description="Whether the package/seal has been opened by customer.")
    status: str = Field(..., description="Current delivery status ('delivered', 'in_transit', etc.).")


class RefundResponse(BaseModel):
    """Successful schema for processed refund."""
    status: Literal["success"] = "success"
    order_id: str = Field(..., description="Order identifier that was refunded.")
    refund_amount: float = Field(..., description="Refunded dollar amount in USD.")
    transaction_id: str = Field(..., description="Unique financial transaction confirmation reference.")


class EscalationResponse(BaseModel):
    """Successful schema for escalated ticket."""
    status: Literal["escalated"] = "escalated"
    ticket_id: str = Field(..., description="Generated human manager queue ticket ID.")
    reason: str = Field(..., description="Reason for manager escalation.")


class CustomerSupportToolErrorResponse(BaseModel):
    """Structured error schema providing actionable recovery instructions for the LLM."""
    status: Literal["failed", "error"] = "failed"
    error_code: str = Field(..., description="Machine-readable error category code.")
    error: str = Field(..., description="Human-readable description of what failed.")
    recovery_instruction: str = Field(
        ...,
        description="Explicit recovery action instructing the LLM on how to proceed.",
    )
    details: Optional[Dict[str, Any]] = Field(
        default=None, description="Optional diagnostic context or parameter constraints."
    )


# ---------------------------------------------------------------------------
# Exported JSON Schemas for Tool Declarations
# ---------------------------------------------------------------------------

LOOKUP_ORDER_SCHEMA = LookupOrderInput.model_json_schema()
PROCESS_REFUND_SCHEMA = ProcessRefundInput.model_json_schema()
ESCALATE_TO_HUMAN_SCHEMA = EscalateToHumanInput.model_json_schema()

CUSTOMER_SUPPORT_TOOL_SCHEMAS = {
    "lookup_order": {
        "name": "lookup_order",
        "description": "Look up order details, item condition, delivery status, purchase date, and pricing.",
        "parameters": LOOKUP_ORDER_SCHEMA,
    },
    "process_refund": {
        "name": "process_refund",
        "description": "Process a financial refund for an eligible order up to the purchase price.",
        "parameters": PROCESS_REFUND_SCHEMA,
    },
    "escalate_to_human": {
        "name": "escalate_to_human",
        "description": "Escalate a high-value order exception, complex dispute, or policy exception to a human supervisor.",
        "parameters": ESCALATE_TO_HUMAN_SCHEMA,
    },
}


# ---------------------------------------------------------------------------
# Tool Implementations
# ---------------------------------------------------------------------------

def lookup_order(order_id: str) -> Dict[str, Any]:
    """
    Look up order details including customer name, purchased item, category, price,
    delivery status, packaging opened state, and days since purchase.

    Args:
        order_id (str): The unique order identifier formatted as 'ORD-XXX' (e.g. 'ORD-101', 'ORD-205').
            Case-insensitive; normalized to uppercase.

    Returns:
        Dict[str, Any]: On success, returns a dictionary containing:
            - order_id (str): Order identifier (e.g. "ORD-101")
            - customer (str): Customer full name
            - item (str): Name of item purchased
            - category (str): Category (e.g. "apparel", "footwear", "hygiene", "accessories")
            - price (float): Price paid in USD
            - purchase_days_ago (int): Days since purchase date
            - opened (bool): Whether packaging has been opened
            - status (str): Fulfillment status ("delivered", "in_transit")

        On error, returns a structured error dictionary containing:
            - status (str): "error"
            - error_code (str): "INVALID_ORDER_ID_FORMAT" or "ORDER_NOT_FOUND"
            - error (str): Error message (e.g. "Order ORD-999 not found.")
            - recovery_instruction (str): Explicit recovery guidance for the LLM
            - details (dict, optional): Additional troubleshooting context

    Errors and Recovery:
        - INVALID_ORDER_ID_FORMAT: Occurs if order_id is not formatted as 'ORD-XXX'.
          Recovery: Ask the user to double check their order number and provide it in 'ORD-XXX' format.
        - ORDER_NOT_FOUND: Occurs if the order does not exist in the database.
          Recovery: Inform the user that the order was not found. Prompt the user for a valid order number from their receipt or confirmation email. Do not attempt refund processing on an invalid order.

    Example:
        >>> lookup_order("ORD-101")
        {'order_id': 'ORD-101', 'customer': 'Alice Smith', 'item': 'Winter Jacket', 'category': 'apparel', 'price': 85.0, 'purchase_days_ago': 10, 'opened': False, 'status': 'delivered'}
    """
    try:
        validated = LookupOrderInput(order_id=str(order_id).strip())
    except ValidationError as ve:
        return CustomerSupportToolErrorResponse(
            status="error",
            error_code="INVALID_ORDER_ID_FORMAT",
            error=f"Invalid order ID format: '{order_id}'. Expected format is 'ORD-XXX' (e.g. 'ORD-101').",
            recovery_instruction="Ask the customer to provide their order number in 'ORD-XXX' format (found on their confirmation email or invoice) before retrying lookup_order.",
            details={"validation_errors": ve.errors()},
        ).model_dump()

    clean_id = validated.order_id.upper()
    order = MOCK_ORDERS.get(clean_id)
    if not order:
        return CustomerSupportToolErrorResponse(
            status="error",
            error_code="ORDER_NOT_FOUND",
            error=f"Order {clean_id} not found.",
            recovery_instruction=f"Order '{clean_id}' was not found in our database. Please ask the customer to check the order number on their order confirmation email or receipt. Do not attempt to process a refund without a verified order.",
            details={"searched_id": clean_id, "example_orders": list(MOCK_ORDERS.keys())},
        ).model_dump()

    return OrderDetailsResponse(**order).model_dump()


def process_refund(order_id: str, amount: float) -> Dict[str, Any]:
    """
    Process a financial refund transaction for an eligible customer order.

    Args:
        order_id (str): The unique order identifier formatted as 'ORD-XXX' (e.g. 'ORD-101').
        amount (float): The dollar amount to refund. Must be positive (> 0).

    Returns:
        Dict[str, Any]: On success, returns a dictionary containing:
            - status (str): "success"
            - order_id (str): The refunded order ID
            - refund_amount (float): The refunded dollar amount
            - transaction_id (str): Confirmation transaction reference (e.g. "TXN-REF-ORD-101")

        On failure/error, returns a structured error dictionary containing:
            - status (str): "failed"
            - error_code (str): "INVALID_INPUT", "ORDER_NOT_FOUND", or "INVALID_REFUND_AMOUNT"
            - error (str): Error message (e.g. "Order ORD-999 not found.")
            - recovery_instruction (str): Explicit recovery guidance for the LLM
            - details (dict, optional): Contextual metadata

    Errors and Recovery:
        - INVALID_INPUT: Occurs if parameters fail type/format validation.
          Recovery: Ensure order_id is 'ORD-XXX' and amount is a positive number.
        - ORDER_NOT_FOUND: Occurs if the order does not exist in the database.
          Recovery: First call lookup_order to verify that the order exists before calling process_refund.
        - INVALID_REFUND_AMOUNT: Occurs if amount <= 0.
          Recovery: Call lookup_order to inspect the order price and pass a valid positive amount.

    Example:
        >>> process_refund("ORD-101", 85.00)
        {'status': 'success', 'order_id': 'ORD-101', 'refund_amount': 85.0, 'transaction_id': 'TXN-REF-ORD-101'}
    """
    try:
        validated = ProcessRefundInput(order_id=str(order_id).strip(), amount=float(amount))
    except (ValidationError, ValueError, TypeError) as exc:
        return CustomerSupportToolErrorResponse(
            status="failed",
            error_code="INVALID_INPUT",
            error=f"Invalid refund parameters: {str(exc)}",
            recovery_instruction="Ensure 'order_id' is formatted as 'ORD-XXX' and 'amount' is a positive dollar amount (> 0).",
            details={"provided_order_id": order_id, "provided_amount": amount},
        ).model_dump()

    clean_id = validated.order_id.upper()
    order = MOCK_ORDERS.get(clean_id)
    if not order:
        return CustomerSupportToolErrorResponse(
            status="failed",
            error_code="ORDER_NOT_FOUND",
            error=f"Order {clean_id} not found.",
            recovery_instruction=f"Cannot process refund because order '{clean_id}' was not found. First call lookup_order to verify the order exists and retrieve the eligible refund amount.",
            details={"searched_id": clean_id},
        ).model_dump()

    result = RefundResponse(
        status="success",
        order_id=clean_id,
        refund_amount=validated.amount,
        transaction_id=f"TXN-REF-{clean_id}",
    )
    return result.model_dump()


def escalate_to_human(reason: str) -> Dict[str, Any]:
    """
    Escalate a customer support issue, policy exception, or high-value transaction to a human supervisor.

    Args:
        reason (str): Detailed explanation of why human intervention is required (e.g.
            "Refund for $350.00 on ORD-777 exceeds automated limit.").

    Returns:
        Dict[str, Any]: On success, returns a dictionary containing:
            - status (str): "escalated"
            - ticket_id (str): Created escalation ticket reference (e.g. "TICKET-HUMAN-992")
            - reason (str): The provided escalation explanation

        On error, returns a structured error dictionary containing:
            - status (str): "failed"
            - error_code (str): "INVALID_ESCALATION_REASON"
            - error (str): Explanation of failure
            - recovery_instruction (str): Clear instruction on providing a non-empty reason

    Errors and Recovery:
        - INVALID_ESCALATION_REASON: Occurs if the escalation reason is blank or too short.
          Recovery: Provide a specific, descriptive explanation of why the customer request must be escalated to a human supervisor (e.g., dollar threshold exceeded, complex policy exception).

    Example:
        >>> escalate_to_human("Order ORD-777 exceeds $100 refund limit.")
        {'status': 'escalated', 'ticket_id': 'TICKET-HUMAN-992', 'reason': 'Order ORD-777 exceeds $100 refund limit.'}
    """
    try:
        validated = EscalateToHumanInput(reason=str(reason).strip())
    except ValidationError as ve:
        return CustomerSupportToolErrorResponse(
            status="failed",
            error_code="INVALID_ESCALATION_REASON",
            error="Escalation reason cannot be empty or fewer than 3 characters.",
            recovery_instruction="Provide a specific, descriptive explanation of why the customer request must be escalated to a human supervisor (e.g., 'Order ORD-777 exceeds $100 automated limit').",
            details={"validation_errors": ve.errors()},
        ).model_dump()

    result = EscalationResponse(
        status="escalated",
        ticket_id="TICKET-HUMAN-992",
        reason=validated.reason,
    )
    return result.model_dump()

