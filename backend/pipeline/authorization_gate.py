"""Authorization Gate Stage for Bankism Defensive Firewall.

THE CENTRAL SECURITY INVARIANT:
This module contains the SOLE authorized code path permitted to invoke
privileged mock banking actions (transfers). 

Rules:
1. BLOCK and REVIEW verdicts can NEVER pass under any circumstance.
2. Even an APPROVE verdict requires explicit human confirmation.
3. Re-validates state deterministically at the moment of execution.
4. Raw natural language or memo text has zero authority.
"""

from typing import Tuple, Optional
from backend.schemas import (
    Decision,
    AuthorizationGateStageResult,
    FirewallPolicy,
    ThreatInspectionStageResult,
    DeterministicValidationStageResult,
    OperationType,
    ExtractedEntities
)
from backend.mock_bank import MockBankingService
from backend.db import get_db_connection


class SecurityGateViolation(Exception):
    """Raised when an unauthorized execution attempt reaches the gate."""
    pass


def evaluate_gate_decision(
    threat_result: ThreatInspectionStageResult,
    validation_result: DeterministicValidationStageResult,
    entities: ExtractedEntities,
    policy: FirewallPolicy
) -> AuthorizationGateStageResult:
    """Evaluates the gate policy for inspection (prior to human execution confirmation)."""
    reasons = []

    # Rule 1: High/Critical threat leads to unconditional BLOCK
    if threat_result.status == "BLOCKED":
        return AuthorizationGateStageResult(
            gate_passed=False,
            decision=Decision.BLOCK,
            reasons=[threat_result.rationale],
            requires_human_confirmation=False,
            transaction_authorized=False
        )

    # Rule 2: Medium threat leads to REVIEW
    if threat_result.status == "REVIEW":
        return AuthorizationGateStageResult(
            gate_passed=False,
            decision=Decision.REVIEW,
            reasons=[threat_result.rationale],
            requires_human_confirmation=True,
            transaction_authorized=False
        )

    # Rule 3: Deterministic validation failure
    if not validation_result.passed_all_checks:
        # Check if error is related to unknown recipient with REVIEW policy, or ambiguity/missing details
        is_review_case = any(
            "Policy: REVIEW" in err or
            "Ambiguity error" in err or
            "Transfer operation requires an explicit amount" in err or
            "Transfer operation requires an explicit recipient" in err or
            "Transfer amount must be specified" in err
            for err in validation_result.errors
        )
        decision = Decision.REVIEW if is_review_case else Decision.BLOCK

        return AuthorizationGateStageResult(
            gate_passed=False,
            decision=decision,
            reasons=validation_result.errors,
            requires_human_confirmation=False,
            transaction_authorized=False
        )

    # Rule 4: Read-only operations (Balance, History, Security Inquiry)
    if entities.operation in (OperationType.BALANCE_INQUIRY, OperationType.TRANSACTION_HISTORY, OperationType.ACCOUNT_INFO, OperationType.SECURITY_INQUIRY):
        return AuthorizationGateStageResult(
            gate_passed=True,
            decision=Decision.APPROVE,
            reasons=["Read-only operation verified safe."],
            requires_human_confirmation=False,
            transaction_authorized=False  # Read-only inquiries do not authorize financial transactions
        )

    # Rule 5: Transfer with all checks passed
    if entities.operation == OperationType.TRANSFER:
        # Requires explicit confirmation before privileged execution
        return AuthorizationGateStageResult(
            gate_passed=True,
            decision=Decision.APPROVE,
            reasons=["All deterministic constraints and threat inspections passed. Pending user confirmation."],
            requires_human_confirmation=policy.require_explicit_confirmation,
            transaction_authorized=False  # Inspection verdict only; execution requires explicit /execute step
        )

    return AuthorizationGateStageResult(
        gate_passed=False,
        decision=Decision.BLOCK,
        reasons=["Unknown operation state."],
        requires_human_confirmation=False,
        transaction_authorized=False
    )


class PrivilegedAuthorizationGate:
    """Gatekeeper enforcing privileged execution invariants."""

    @classmethod
    def execute_transfer_through_gate(
        cls,
        request_id: str,
        confirmation: bool,
        session_id: str = "demo-session-1"
    ) -> Tuple[bool, str, Optional[str], Optional[float], Optional[str]]:
        """The ONLY authorized pathway to execute a mock bank transfer.
        
        Returns:
            (success: bool, message: str, transaction_id: Optional[str], new_balance: Optional[float], account_id: Optional[str])
        """
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM audit_logs WHERE request_id = ?", (request_id,))
        audit_row = cursor.fetchone()

        if not audit_row:
            conn.close()
            return False, f"Request ID '{request_id}' not found in audit logs.", None, None, None

        audit = dict(audit_row)

        # INVARIANT 1: Decision MUST be APPROVE
        if audit["decision"] != Decision.APPROVE.value:
            conn.close()
            raise SecurityGateViolation(
                f"SECURITY GATE BREACH BLOCKED: Attempted to execute request {request_id} with verdict {audit['decision']}!"
            )

        # INVARIANT 2: Confirmation MUST be True
        if not confirmation:
            conn.close()
            return False, "Execution rejected: Explicit human confirmation was not granted.", None, None, None

        # INVARIANT 3: Idempotency - cannot execute twice
        if audit["mock_executed"] == 1:
            conn.close()
            return False, "Request has already been executed. Replay attack blocked.", audit.get("transaction_id"), None, None

        # INVARIANT 4: Operation must be TRANSFER
        if audit["operation"] != OperationType.TRANSFER.value:
            conn.close()
            return False, f"Operation {audit['operation']} is not an executable transfer.", None, None, None

        # Source account extraction (defaulting to standard CHK-9021 if not specified)
        source_account_id = "CHK-9021"
        recipient = audit["recipient"]
        amount = audit["amount"]
        currency = audit["currency"] or "USD"
        memo = audit["memo"]

        if not recipient or not amount:
            conn.close()
            return False, "Missing critical transaction parameters (recipient or amount).", None, None, None

        # Privileged transfer invocation
        success, msg, tx_id, new_balance = MockBankingService.execute_mock_transfer(
            source_account_id=source_account_id,
            recipient=recipient,
            amount=amount,
            currency=currency,
            memo=memo,
            request_id=request_id
        )

        if success and tx_id:
            # Update audit record to reflect verified mock execution
            cursor.execute("""
                UPDATE audit_logs 
                SET mock_executed = 1, transaction_id = ? 
                WHERE request_id = ?
            """, (tx_id, request_id))
            conn.commit()

        conn.close()
        return success, msg, tx_id, new_balance, source_account_id
