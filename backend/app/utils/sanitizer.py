"""
PII Redaction & Sanitization Utility.
Provides regex-based detection and masking for sensitive data (emails, phone numbers,
SSNs, credit cards, API keys/tokens) and a logging filter to prevent PII leakage.
"""

import logging
import re
from typing import Any, Dict, List, Optional, Union

# Common PII and Secret Detection Regex Patterns (Ordered: specific tokens/keys first)
PII_PATTERNS: Dict[str, re.Pattern] = {
    "bearer_token": re.compile(
        r"(?i)\b(bearer\s+[a-zA-Z0-9_\-\.]{20,})\b"
    ),
    "api_key": re.compile(
        r"(?i)\b((?:api[_-]?key|secret|token|password|auth)\s*[:=]\s*['\"]?[a-zA-Z0-9_\-]{8,}['\"]?)\b"
    ),
    "email": re.compile(
        r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
        re.IGNORECASE,
    ),
    "ssn": re.compile(
        r"\b\d{3}-\d{2}-\d{4}\b"
    ),
    "credit_card": re.compile(
        r"\b(?:\d{4}[-\s]?){3}\d{4}\b"
    ),
    "phone": re.compile(
        r"(?:\+?1[-.\s]?)?(?:\([0-9]{3}\)|[0-9]{3})[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b"
    ),
    "emp_id": re.compile(
        r"\bEMP-\d{3,6}\b",
        re.IGNORECASE,
    ),
}


def redact_pii(
    text: Optional[str],
    mask: str = "[REDACTED]",
    categories: Optional[List[str]] = None,
) -> str:
    """
    Redacts Personally Identifiable Information (PII) and secret credentials from text.

    Args:
        text (Optional[str]): Source string to redact.
        mask (str): Replacement mask (default: '[REDACTED]').
        categories (Optional[List[str]]): Specific PII categories to redact, or all if None.

    Returns:
        str: Text with sensitive entities replaced by typed redaction placeholders.
    """
    if not text:
        return "" if text is None else text

    redacted = str(text)
    target_patterns = {
        k: v for k, v in PII_PATTERNS.items()
        if categories is None or k in categories
    }

    for pii_type, pattern in target_patterns.items():
        placeholder = f"[{pii_type.upper()}_{mask}]"
        redacted = pattern.sub(placeholder, redacted)

    return redacted


def sanitize_data_structure(data: Any, mask: str = "[REDACTED]") -> Any:
    """
    Recursively redacts PII strings within nested dictionaries, lists, and primitives.

    Args:
        data (Any): Dict, list, or primitive data structure.
        mask (str): Replacement mask.

    Returns:
        Any: Sanitized data structure with PII redacted.
    """
    if isinstance(data, str):
        return redact_pii(data, mask=mask)
    elif isinstance(data, dict):
        return {k: sanitize_data_structure(v, mask=mask) for k, v in data.items()}
    elif isinstance(data, list):
        return [sanitize_data_structure(item, mask=mask) for item in data]
    elif isinstance(data, tuple):
        return tuple(sanitize_data_structure(item, mask=mask) for item in data)
    return data


class PIIRedactingFilter(logging.Filter):
    """
    Logging filter that sanitizes message bodies, arguments, and exception strings
    before emission to prevent log-based PII leakage.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = redact_pii(record.msg)

        if record.args:
            if isinstance(record.args, dict):
                record.args = {k: redact_pii(str(v)) if isinstance(v, str) else v for k, v in record.args.items()}
            elif isinstance(record.args, tuple):
                record.args = tuple(redact_pii(str(arg)) if isinstance(arg, str) else arg for arg in record.args)

        return True
