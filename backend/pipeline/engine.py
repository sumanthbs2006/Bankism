"""Master Security Pipeline Engine for Bankism.

Orchestrates sequential execution of pipeline stages:
USER REQUEST
   ↓
INPUT NORMALIZATION
   ↓
THREAT INSPECTION
   ↓
INTENT EXTRACTION
   ↓
DETERMINISTIC VALIDATION
   ↓
AUTHORIZATION GATE
   ↓
VERDICT SERIALIZER & AUDIT LOGGING
"""

import uuid
import json
from datetime import datetime, timezone
from typing import List, Optional
from backend.db import get_db_connection
from backend.schemas import (
    Decision,
    RiskLevel,
    ThreatCategory,
    ThreatSignal,
    OperationType,
    FirewallPolicy,
    FirewallVerdict,
    PipelineStages
)
from backend.pipeline.normalizer import normalize_input
from backend.pipeline.threat_detector import inspect_threats
from backend.pipeline.intent_extractor import extract_intent_and_entities
from backend.pipeline.validator import validate_deterministically
from backend.pipeline.authorization_gate import evaluate_gate_decision
from backend.pipeline.llm_classifier import inspect_with_round_robin_llm


_CACHED_POLICY: Optional[FirewallPolicy] = None
_CACHED_POLICY_TIME: float = 0.0
_POLICY_TTL_SECONDS: float = 60.0


def invalidate_policy_cache() -> None:
    """Invalidates the in-memory policy cache when policies are updated."""
    global _CACHED_POLICY, _CACHED_POLICY_TIME
    _CACHED_POLICY = None
    _CACHED_POLICY_TIME = 0.0


def get_active_policy() -> FirewallPolicy:
    """Retrieves current active policy with in-memory caching to minimize database reads."""
    global _CACHED_POLICY, _CACHED_POLICY_TIME
    import time

    now = time.time()
    if _CACHED_POLICY is not None and (now - _CACHED_POLICY_TIME) < _POLICY_TTL_SECONDS:
        return _CACHED_POLICY

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM policies ORDER BY id DESC LIMIT 1")
    row = cursor.fetchone()
    conn.close()

    if not row:
        policy = FirewallPolicy(
            max_single_transfer=2500.0,
            daily_transfer_limit=5000.0,
            approved_recipients=["Rahul", "Priya", "Maya", "Vikram", "Suhas", "*"],
            unknown_recipient_action="BLOCK",
            block_high_risk=True,
            require_explicit_confirmation=True,
            max_input_length=800,
            strict_homoglyph_filtering=True,
            version="v1.2",
            updated_at=datetime.now(timezone.utc).isoformat(),
            simulation_mode=True
        )
    else:
        r = dict(row)
        approved = json.loads(r["approved_recipients"]) if isinstance(r["approved_recipients"], str) else r["approved_recipients"]
        policy = FirewallPolicy(
            max_single_transfer=float(r["max_single_transfer"]),
            daily_transfer_limit=float(r["daily_transfer_limit"]),
            approved_recipients=approved,
            unknown_recipient_action=r["unknown_recipient_action"],
            block_high_risk=bool(r["block_high_risk"]),
            require_explicit_confirmation=bool(r["require_explicit_confirmation"]),
            max_input_length=int(r["max_input_length"]),
            strict_homoglyph_filtering=bool(r["strict_homoglyph_filtering"]),
            version=r["version"],
            updated_at=r["updated_at"],
            simulation_mode=True
        )

    _CACHED_POLICY = policy
    _CACHED_POLICY_TIME = now
    return policy


def run_pipeline(
    raw_message: str,
    session_id: str = "demo-session-1",
    account_id: str = "CHK-9021",
    provider_mode: str = "round_robin"
) -> FirewallVerdict:
    """Executes the complete Bankism defensive pipeline end to end with Multi-LLM Round-Robin."""
    policy = get_active_policy()
    request_id = f"req_{uuid.uuid4().hex[:12]}"
    now_iso = datetime.now(timezone.utc).isoformat()

    # Multi-LLM Advisory Security Inspection & Explainability via 3-LLM Round Robin (Gemini -> Groq -> OpenAI)
    ai_explain = inspect_with_round_robin_llm(raw_message, provider_mode=provider_mode)

    # Stage 1: Input Normalization
    normalized_text, norm_stage = normalize_input(raw_message, max_length=policy.max_input_length)

    # Stage 2: Threat Inspection
    threat_stage = inspect_threats(normalized_text, raw_message, norm_stage)
    threat_stage.llm_classifier_used = True
    threat_stage.llm_model = f"{ai_explain.provider_name} ({ai_explain.model_name})"

    # Integrate Multi-LLM Advisory Threat Intelligence into Stage 2
    if ai_explain and (ai_explain.is_malicious or ai_explain.risk_level in ("HIGH", "CRITICAL")):
        try:
            ai_cat = ThreatCategory(ai_explain.threat_category)
        except Exception:
            text_lower = (ai_explain.plain_english_verdict + " " + ai_explain.assessment_summary).lower()
            if any(k in text_lower for k in ["override", "security", "bypass", "validation", "policy", "skip"]):
                ai_cat = ThreatCategory.POLICY_OVERRIDE
            elif any(k in text_lower for k in ["jailbreak", "dan", "persona"]):
                ai_cat = ThreatCategory.JAILBREAK
            else:
                ai_cat = ThreatCategory.PROMPT_INJECTION

        ai_sev = RiskLevel.CRITICAL if ai_explain.risk_level == "CRITICAL" else RiskLevel.HIGH

        threat_stage.signals_detected.append(ThreatSignal(
            category=ai_cat,
            signal_type="AI_DEFENSIVE_INSPECTOR",
            pattern_matched=f"{ai_explain.provider_name} ({ai_explain.model_name})",
            confidence=ai_explain.confidence or 0.95,
            description=ai_explain.plain_english_verdict,
            severity=ai_sev
        ))

        if ai_cat not in threat_stage.threat_categories:
            threat_stage.threat_categories.append(ai_cat)
        if ThreatCategory.NONE in threat_stage.threat_categories and len(threat_stage.threat_categories) > 1:
            threat_stage.threat_categories.remove(ThreatCategory.NONE)

        if threat_stage.highest_severity == RiskLevel.LOW or ai_sev == RiskLevel.CRITICAL:
            threat_stage.highest_severity = ai_sev

        threat_stage.status = "BLOCKED"
        threat_stage.rationale = f"AI Defensive Inspector flagged request as unsafe: {ai_explain.plain_english_verdict}"

    # Stage 3: Intent & Entity Extraction
    intent_stage = extract_intent_and_entities(normalized_text)

    # Stage 4: Deterministic Validation
    val_stage = validate_deterministically(intent_stage.entities, policy, account_id, session_id)

    # Stage 5: Authorization Gate
    gate_stage = evaluate_gate_decision(threat_stage, val_stage, intent_stage.entities, policy)

    # Synthesize Threat Categories
    categories_set = set(threat_stage.threat_categories)
    if ThreatCategory.NONE in categories_set and len(categories_set) > 1:
        categories_set.remove(ThreatCategory.NONE)

    # Enrich categories from deterministic validation failures
    for err in val_stage.errors:
        if "approved recipients allowlist" in err or "unverified recipient" in err or "recipient" in err.lower():
            categories_set.add(ThreatCategory.RECIPIENT_VALIDATION_FAILURE)
        if "exceeds policy maximum single transfer limit" in err or "would exceed daily limit" in err:
            categories_set.add(ThreatCategory.AMOUNT_POLICY_VIOLATION)
        if "Ambiguity error" in err or "lacks definitive amount" in err:
            categories_set.add(ThreatCategory.AMBIGUOUS_TRANSACTION)

    if ThreatCategory.NONE in categories_set and len(categories_set) > 1:
        categories_set.discard(ThreatCategory.NONE)

    if len(categories_set) > 1:
        categories_set.add(ThreatCategory.MULTIPLE_THREATS)

    final_categories: List[ThreatCategory] = sorted(list(categories_set), key=lambda x: x.value)
    if not final_categories:
        final_categories = [ThreatCategory.NONE]

    # Synthesize Risk Level
    risk_level = threat_stage.highest_severity
    if val_stage.status == "FAILED" and risk_level == RiskLevel.LOW:
        # Business rule violations without malicious intent are rated MEDIUM
        risk_level = RiskLevel.MEDIUM

    # Synthesize Decision & Invariant Enforcement
    decision = gate_stage.decision

    # MANDATORY SECURITY INVARIANT:
    # BLOCK and REVIEW must ALWAYS have transaction_authorized: false.
    # APPROVE during inspection has transaction_authorized: false
    # because privileged execution requires explicit human confirmation via the /execute endpoint,
    # and read-only operations do not authorize financial ledger mutations.
    if decision in (Decision.BLOCK, Decision.REVIEW):
        transaction_authorized = False
    elif intent_stage.operation in (OperationType.BALANCE_INQUIRY, OperationType.TRANSACTION_HISTORY, OperationType.ACCOUNT_INFO, OperationType.SECURITY_INQUIRY):
        transaction_authorized = False
    else:
        transaction_authorized = gate_stage.transaction_authorized

    requires_human_review = (decision == Decision.REVIEW)

    # Assemble Formatted Rationale
    if decision == Decision.BLOCK:
        if threat_stage.status == "BLOCKED":
            rationale = f"Firewall blocked execution: {threat_stage.rationale}"
        else:
            rationale = f"Deterministic validation blocked execution: {'; '.join(val_stage.errors[:2])}"
    elif decision == Decision.REVIEW:
        rationale = f"Flagged for human operator review: {'; '.join(val_stage.errors or [threat_stage.rationale])}"
    else:
        if intent_stage.operation == OperationType.TRANSFER:
            amt = intent_stage.entities.amount
            rec = intent_stage.entities.recipient
            rationale = f"Transfer of ₹{amt:,.2f} to {rec} approved for processing. Awaiting explicit user execution confirmation."
        else:
            rationale = f"Read-only {intent_stage.operation.value.lower().replace('_', ' ')} verified safe and approved."

    # Harmonize AI Explainability with Final Verdict for clear, unified rationale across the console
    if ai_explain:
        if decision == Decision.BLOCK:
            ai_explain.is_malicious = True
            ai_explain.risk_level = risk_level.value
            if not ai_explain.plain_english_verdict or ai_explain.plain_english_verdict == "Analyzed safe natural language request.":
                if val_stage.errors:
                    ai_explain.plain_english_verdict = f"This request was blocked by the banking firewall: {val_stage.errors[0]}"
                    ai_explain.mitigation_advice = "Resolve policy and account validation requirements before resubmitting."
                    for err in val_stage.errors:
                        if err not in ai_explain.risk_factors:
                            ai_explain.risk_factors.append(err)
                else:
                    ai_explain.plain_english_verdict = f"This request was blocked by the security firewall: {threat_stage.rationale}"
                    for sig in threat_stage.signals_detected:
                        sig_desc = f"[{sig.category.value}] {sig.description}"
                        if sig_desc not in ai_explain.risk_factors:
                            ai_explain.risk_factors.append(sig_desc)
        elif decision == Decision.REVIEW:
            ai_explain.is_malicious = False
            ai_explain.risk_level = risk_level.value
            if not ai_explain.plain_english_verdict or ai_explain.plain_english_verdict == "Analyzed safe natural language request.":
                ai_explain.plain_english_verdict = f"This request requires manual verification: {'; '.join(val_stage.errors or [threat_stage.rationale])}"
                ai_explain.mitigation_advice = "A human operator must inspect and authorize this transaction."
        elif decision == Decision.APPROVE:
            ai_explain.is_malicious = False
            ai_explain.risk_level = "LOW"

    # Signals as string summaries
    signal_strings = [
        f"[{s.category.value}] {s.description} ('{s.pattern_matched}')"
        for s in threat_stage.signals_detected
    ]

    pipeline_stages = PipelineStages(
        normalization=norm_stage,
        threat_inspection=threat_stage,
        intent_extraction=intent_stage,
        deterministic_validation=val_stage,
        authorization_gate=gate_stage
    )

    verdict = FirewallVerdict(
        request_id=request_id,
        decision=decision,
        risk_level=risk_level,
        threat_categories=final_categories,
        operation=intent_stage.operation,
        requires_human_review=requires_human_review,
        transaction_authorized=transaction_authorized,
        normalized_request=normalized_text,
        detected_signals=signal_strings,
        validation_errors=val_stage.errors,
        rationale=rationale,
        timestamp=now_iso,
        policy_version=policy.version,
        simulation_mode=True,
        pipeline_stages=pipeline_stages,
        extracted_entities=intent_stage.entities,
        original_request=raw_message,
        session_id=session_id,
        source_account_id=account_id,
        ai_explainability=ai_explain
    )

    # Persist in Audit Log (SQLite)
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO audit_logs 
        (request_id, timestamp, session_id, raw_input, normalized_input, decision, risk_level,
         threat_categories, operation, amount, currency, recipient, memo, detected_signals,
         validation_errors, rationale, mock_executed, transaction_id, policy_version, simulation_mode)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        request_id,
        now_iso,
        session_id,
        raw_message,
        normalized_text,
        decision.value,
        risk_level.value,
        json.dumps([c.value for c in final_categories]),
        intent_stage.operation.value,
        intent_stage.entities.amount,
        intent_stage.entities.currency,
        intent_stage.entities.recipient,
        intent_stage.entities.memo,
        json.dumps(signal_strings),
        json.dumps(val_stage.errors),
        rationale,
        0,  # mock_executed initially false
        None,
        policy.version,
        1
    ))
    conn.commit()
    conn.close()

    return verdict
