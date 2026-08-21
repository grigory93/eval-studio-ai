"""
Tools for Customer Support ADK Agent.
"""

from typing import Dict, Any

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


def lookup_order(order_id: str) -> Dict[str, Any]:
    """Look up order details, item condition, delivery status, and purchase date."""
    order = MOCK_ORDERS.get(order_id.upper())
    if not order:
        return {"error": f"Order {order_id} not found."}
    return order


def process_refund(order_id: str, amount: float) -> Dict[str, Any]:
    """Process a financial refund for an eligible order."""
    order = MOCK_ORDERS.get(order_id.upper())
    if not order:
        return {"status": "failed", "error": f"Order {order_id} not found."}
    return {
        "status": "success",
        "order_id": order_id,
        "refund_amount": amount,
        "transaction_id": f"TXN-REF-{order_id}",
    }


def escalate_to_human(reason: str) -> Dict[str, Any]:
    """Escalate a customer issue or high-value exception to a human manager."""
    return {
        "status": "escalated",
        "ticket_id": "TICKET-HUMAN-992",
        "reason": reason,
    }
