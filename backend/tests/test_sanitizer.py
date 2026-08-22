"""
Unit tests for PII Redaction and Logging Sanitizer.
"""

import logging
from app.utils.sanitizer import (
    PIIRedactingFilter,
    redact_pii,
    sanitize_data_structure,
)


def test_redact_pii_email():
    raw = "Please contact alice.smith@example.com or bob@company.org regarding order ORD-101."
    redacted = redact_pii(raw)
    assert "[EMAIL_[REDACTED]]" in redacted
    assert "alice.smith@example.com" not in redacted
    assert "bob@company.org" not in redacted


def test_redact_pii_phone():
    raw = "Call customer support at 555-123-4567 or +1 (800) 555-0199 for assistance."
    redacted = redact_pii(raw)
    assert "[PHONE_[REDACTED]]" in redacted
    assert "555-123-4567" not in redacted


def test_redact_pii_ssn_and_credit_card():
    raw = "Customer SSN is 123-45-6789 and Card is 4111 2222 3333 4444."
    redacted = redact_pii(raw)
    assert "[SSN_[REDACTED]]" in redacted
    assert "[CREDIT_CARD_[REDACTED]]" in redacted
    assert "123-45-6789" not in redacted
    assert "4111 2222 3333 4444" not in redacted


def test_redact_pii_auth_tokens_and_api_keys():
    raw = "Authorization: Bearer abcdef1234567890abcdef1234567890 and api_key='sk-live-999988887777'"
    redacted = redact_pii(raw)
    assert "[BEARER_TOKEN_[REDACTED]]" in redacted
    assert "[API_KEY_[REDACTED]]" in redacted
    assert "sk-live-999988887777" not in redacted


def test_sanitize_nested_data_structure():
    data = {
        "user": {
            "email": "sarah@company.com",
            "phone": "555-987-6543",
            "metadata": ["Contact: john@example.com", 12345],
        },
        "status": "active",
    }
    sanitized = sanitize_data_structure(data)
    assert "[EMAIL_[REDACTED]]" in sanitized["user"]["email"]
    assert "[PHONE_[REDACTED]]" in sanitized["user"]["phone"]
    assert "[EMAIL_[REDACTED]]" in sanitized["user"]["metadata"][0]
    assert sanitized["user"]["metadata"][1] == 12345
    assert sanitized["status"] == "active"


def test_pii_redacting_logging_filter():
    pii_filter = PIIRedactingFilter()
    record = logging.LogRecord(
        name="test_logger",
        level=logging.INFO,
        pathname="test.py",
        lineno=10,
        msg="Error processing refund for user test@example.com with phone 555-000-1111",
        args=(),
        exc_info=None,
    )
    result = pii_filter.filter(record)
    assert result is True
    assert "[EMAIL_[REDACTED]]" in record.msg
    assert "test@example.com" not in record.msg
    assert "[PHONE_[REDACTED]]" in record.msg
