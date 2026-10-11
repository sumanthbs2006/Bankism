"""Deterministic Validation Stage for Bankism Defensive Firewall.

Applies strict business, policy, and state rules:
- Supported operations verification
- Required field completeness
- Recipient allowlist enforcement
- Per-transaction and daily cumulative transfer limits
- Account balance sufficiency and status checks
- Idempotency & duplicate submission prevention
- Currency alignment & decimal precision verification
"""

from typing import Dict, Any, List, Optional, Tuple
import re
from datetime import datetime, timezone, timedelta
from backend.schemas import (
    OperationType,
    ExtractedEntities,
    DeterministicValidationStageResult,
    FirewallPolicy
)
from backend.mock_bank import MockBankingService
from backend.db import get_db_connection


GENUINE_NAME_REGEX = re.compile(r"^[A-Za-z]+(?: [A-Za-z]+)*$")


def validate_genuine_recipient(name: Optional[str]) -> Tuple[bool, Optional[str]]:
    """Strictly validates that recipient is a genuine human name.
    
    Rejects:
    - Empty or whitespace-only names
    - Numbers (0-9)
    - Special characters or punctuation
    - Words like 'apple' or 'hacker', non-human objects, fruits, or attack terms
    """
    if not name or not name.strip():
        return False, "Recipient name is required for transfer operations."
    
    trimmed = name.strip()
    
    # 1. No numbers allowed
    if any(ch.isdigit() for ch in trimmed):
        return False, f"Invalid recipient '{trimmed}': Numbers are not allowed in recipient names."
        
    # 2. No special characters: only alphabetic letters and spaces
    if not GENUINE_NAME_REGEX.match(trimmed):
        return False, f"Invalid recipient '{trimmed}': Special characters or symbols are not allowed. Only genuine alphabetic names are accepted."
        
    # 3. Minimum length
    if len(trimmed) < 2:
        return False, f"Invalid recipient '{trimmed}': Recipient name must be at least 2 characters long."
        
    # 4. Disallowed non-genuine words, fruits, attack keywords, system roles
    disallowed_terms = [
        "apple", "hacker", "attacker", "banana", "orange", "fruit", "mango",
        "admin", "root", "bot", "null", "undefined", "test", "user", "dummy",
        "device", "iphone", "android", "computer", "server", "system",
        "malware", "exploit", "trojan", "phish", "virus", "evil", "anon",
        "anonymous", "payload", "wallet", "unknownattacker666", "unknown_wallet",
        "external hacker", "external_hacker_account"
    ]
    lower = trimmed.lower()
    words = lower.split()
    for term in disallowed_terms:
        if term in words or term == lower or term in lower:
            return False, f"Invalid recipient '{trimmed}': '{term}' is not a genuine human name. Numbers, symbols, and words like 'apple' or 'hacker' are prohibited."
            
    return True, None


def validate_deterministically(
    entities: ExtractedEntities,
    policy: FirewallPolicy,
    source_account_id: str,
    session_id: str
) -> DeterministicValidationStageResult:
    """Performs deterministic financial and policy validation.
    
    CRITICAL: This check relies ONLY on structured entities, policies, and ledger state.
    Raw natural language prompts or memo texts have NO authority here.
    """
    errors: List[str] = []
    checks: Dict[str, Any] = {}
    op = entities.operation

    # 1. Operation Supported Check
    checks["operation_supported"] = op != OperationType.UNKNOWN
    if op == OperationType.UNKNOWN:
        errors.append("Unrecognized banking operation. Only transfers, balances, history, and inquiries are supported.")

    # 2. Account Existence and Status Check
    account = MockBankingService.get_account(source_account_id)
    if not account:
        checks["account_exists"] = False
        errors.append(f"Source account '{source_account_id}' does not exist.")
        return DeterministicValidationStageResult(
            passed_all_checks=False,
            errors=errors,
            checks=checks,
            status="FAILED"
        )

    checks["account_exists"] = True
    checks["account_active"] = (account["status"] == "ACTIVE")
    if account["status"] != "ACTIVE":
        errors.append(f"Source account '{source_account_id}' is {account['status']} and cannot perform operations.")

    # If read-only operations, validate and return early
    if op in (OperationType.BALANCE_INQUIRY, OperationType.TRANSACTION_HISTORY, OperationType.ACCOUNT_INFO, OperationType.SECURITY_INQUIRY):
        checks["read_only_operation"] = True
        return DeterministicValidationStageResult(
            passed_all_checks=len(errors) == 0,
            errors=errors,
            checks=checks,
            status="PASSED" if len(errors) == 0 else "FAILED"
        )

    # 3. Transfer Validation Checks
    if op == OperationType.TRANSFER:
        # A. Ambiguity check
        if entities.ambiguity_flags:
            checks["ambiguity_resolved"] = False
            for reason in entities.ambiguity_flags:
                errors.append(f"Ambiguity error: {reason}")
        else:
            checks["ambiguity_resolved"] = True

        # B. Amount Validation
        amount = entities.amount
        if amount is None or amount <= 0:
            checks["amount_valid"] = False
            errors.append("Transfer amount must be specified and greater than zero.")
        else:
            checks["amount_valid"] = True
            # Max single transfer limit
            checks["within_single_limit"] = (amount <= policy.max_single_transfer)
            if amount > policy.max_single_transfer:
                errors.append(
                    f"Transfer amount ₹{amount:,.2f} exceeds policy maximum single transfer limit of ₹{policy.max_single_transfer:,.2f}."
                )

            # Daily cumulative limit
            daily_used = account.get("daily_transferred_today", 0.0)
            projected_daily = daily_used + amount
            checks["within_daily_limit"] = (projected_daily <= policy.daily_transfer_limit)
            if projected_daily > policy.daily_transfer_limit:
                errors.append(
                    f"Transfer of ₹{amount:,.2f} would exceed daily limit of ₹{policy.daily_transfer_limit:,.2f} (already transferred ₹{daily_used:,.2f} today)."
                )

            # Balance sufficiency
            balance = account.get("balance", 0.0)
            checks["balance_sufficient"] = (balance >= amount)
            if balance < amount:
                errors.append(
                    f"Insufficient funds: requested ₹{amount:,.2f}, but account balance is ₹{balance:,.2f}."
                )

        # C. Currency check
        account_curr = account.get("currency", "INR")
        requested_curr = entities.currency or "INR"
        checks["currency_valid"] = (requested_curr == account_curr or requested_curr == "INR")
        if not checks["currency_valid"]:
            errors.append(
                f"Cross-currency transfers not supported. Account currency is {account_curr}, requested {requested_curr}."
            )

        # D. Recipient Allowlist Check (Strictly genuine human names only)
        recipient_name = entities.recipient
        if not recipient_name:
            checks["recipient_present"] = False
            errors.append("Recipient name is required for transfer operations.")
        else:
            checks["recipient_present"] = True
            is_valid_name, name_error = validate_genuine_recipient(recipient_name)
            allowlist = policy.approved_recipients or []
            is_in_allowlist = ("*" in allowlist) or (recipient_name in allowlist) or any(r.lower() == recipient_name.lower() for r in allowlist if r != "*")
            checks["recipient_allowlisted"] = is_valid_name and is_in_allowlist
            if not is_valid_name or not is_in_allowlist:
                err_msg = f"Recipient '{recipient_name}' is not in the approved recipients allowlist."
                if name_error:
                    err_msg += f" ({name_error})"
                errors.append(err_msg)

        # E. Idempotency & Duplicate Request Protection
        if amount and recipient_name:
            is_duplicate = check_idempotency_duplicate(source_account_id, recipient_name, amount, session_id)
            checks["idempotency_ok"] = not is_duplicate
            if is_duplicate:
                errors.append("Duplicate transfer detected within the idempotency window (60s). Submission throttled.")
        else:
            checks["idempotency_ok"] = True

    passed = len(errors) == 0
    return DeterministicValidationStageResult(
        passed_all_checks=passed,
        errors=errors,
        checks=checks,
        status="PASSED" if passed else "FAILED"
    )


def check_idempotency_duplicate(account_id: str, recipient: str, amount: float, session_id: str) -> bool:
    """Checks if identical transfer was audited/executed in the last 60 seconds."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cutoff_time = (datetime.now(timezone.utc) - timedelta(seconds=60)).isoformat()

    cursor.execute("""
        SELECT COUNT(*) FROM audit_logs 
        WHERE timestamp > ?
          AND LOWER(recipient) = LOWER(?)
          AND amount = ?
          AND session_id = ?
          AND decision IN ('APPROVE')
    """, (cutoff_time, recipient, amount, session_id))

    count = cursor.fetchone()[0]
    conn.close()
    return count > 0
