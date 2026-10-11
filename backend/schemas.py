"""Pydantic schemas and strict data contracts for Bankism Firewall."""

from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class Decision(str, Enum):
    APPROVE = "APPROVE"
    BLOCK = "BLOCK"
    REVIEW = "REVIEW"


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ThreatCategory(str, Enum):
    NONE = "NONE"
    PROMPT_INJECTION = "PROMPT_INJECTION"
    JAILBREAK = "JAILBREAK"
    POLICY_OVERRIDE = "POLICY_OVERRIDE"
    MEMO_INJECTION = "MEMO_INJECTION"
    TOKEN_OBFUSCATION = "TOKEN_OBFUSCATION"
    AMBIGUOUS_TRANSACTION = "AMBIGUOUS_TRANSACTION"
    RECIPIENT_VALIDATION_FAILURE = "RECIPIENT_VALIDATION_FAILURE"
    AMOUNT_POLICY_VIOLATION = "AMOUNT_POLICY_VIOLATION"
    AUTHORIZATION_FAILURE = "AUTHORIZATION_FAILURE"
    DATA_EXFILTRATION_ATTEMPT = "DATA_EXFILTRATION_ATTEMPT"
    MULTIPLE_THREATS = "MULTIPLE_THREATS"


class OperationType(str, Enum):
    TRANSFER = "TRANSFER"
    BALANCE_INQUIRY = "BALANCE_INQUIRY"
    TRANSACTION_HISTORY = "TRANSACTION_HISTORY"
    ACCOUNT_INFO = "ACCOUNT_INFO"
    SECURITY_INQUIRY = "SECURITY_INQUIRY"
    UNKNOWN = "UNKNOWN"


# Pipeline Stage Results
class NormalizationStageResult(BaseModel):
    original_text: str
    normalized_text: str
    length_original: int
    length_normalized: int
    zero_width_chars_found: int = 0
    unusual_whitespace_found: int = 0
    homoglyphs_detected: List[str] = Field(default_factory=list)
    leetspeak_detected: List[str] = Field(default_factory=list)
    excessive_separators_found: bool = False
    status: str = "PASSED"  # PASSED, FLAGGED, REJECTED
    notes: List[str] = Field(default_factory=list)


class ThreatSignal(BaseModel):
    category: ThreatCategory
    signal_type: str
    pattern_matched: str
    confidence: float
    description: str
    severity: RiskLevel


class ThreatInspectionStageResult(BaseModel):
    signals_detected: List[ThreatSignal] = Field(default_factory=list)
    highest_severity: RiskLevel = RiskLevel.LOW
    threat_categories: List[ThreatCategory] = Field(default_factory=list)
    llm_classifier_used: bool = False
    llm_model: Optional[str] = None
    status: str = "PASSED"  # PASSED, REVIEW, BLOCKED
    rationale: str = "No adversarial patterns detected."


class ExtractedEntities(BaseModel):
    operation: OperationType = OperationType.UNKNOWN
    amount: Optional[float] = None
    currency: Optional[str] = None
    recipient: Optional[str] = None
    memo: Optional[str] = None
    confidence: float = 1.0
    ambiguity_flags: List[str] = Field(default_factory=list)


class IntentExtractionStageResult(BaseModel):
    operation: OperationType
    entities: ExtractedEntities
    is_ambiguous: bool = False
    ambiguity_reasons: List[str] = Field(default_factory=list)
    status: str = "PASSED"  # PASSED, AMBIGUOUS, UNKNOWN


class DeterministicValidationStageResult(BaseModel):
    passed_all_checks: bool = False
    errors: List[str] = Field(default_factory=list)
    checks: Dict[str, Any] = Field(default_factory=dict)
    # Checks include: operation_supported, recipient_allowlisted, amount_within_limits,
    # daily_limit_remaining, balance_sufficient, idempotency_ok, permissions_ok
    status: str = "PASSED"  # PASSED, FAILED


class AuthorizationGateStageResult(BaseModel):
    gate_passed: bool = False
    decision: Decision
    reasons: List[str] = Field(default_factory=list)
    requires_human_confirmation: bool = True
    transaction_authorized: bool = False


class PipelineStages(BaseModel):
    normalization: NormalizationStageResult
    threat_inspection: ThreatInspectionStageResult
    intent_extraction: IntentExtractionStageResult
    deterministic_validation: DeterministicValidationStageResult
    authorization_gate: AuthorizationGateStageResult


class AIExplainability(BaseModel):
    provider_name: str = "Google Gemini"
    provider_id: str = "gemini"  # "gemini", "groq", "openai"
    model_name: str = "gemini-flash-latest"
    turn_number: int = 1
    is_malicious: bool = False
    risk_level: str = "LOW"
    threat_category: str = "NONE"
    plain_english_verdict: str = ""
    assessment_summary: str = ""
    risk_factors: List[str] = Field(default_factory=list)
    mitigation_advice: str = ""
    confidence: float = 0.95
    timestamp: str = ""


# Core Verdict Schema (Mandatory Fields Exact Match)
class FirewallVerdict(BaseModel):
    request_id: str
    decision: Decision
    risk_level: RiskLevel
    threat_categories: List[ThreatCategory]
    operation: OperationType
    requires_human_review: bool
    transaction_authorized: bool
    normalized_request: str
    detected_signals: List[str] = Field(default_factory=list)
    validation_errors: List[str] = Field(default_factory=list)
    rationale: str
    timestamp: str
    policy_version: str
    simulation_mode: bool = True

    # Extended transparent details for UI & pipeline inspection
    pipeline_stages: Optional[PipelineStages] = None
    extracted_entities: Optional[ExtractedEntities] = None
    original_request: Optional[str] = None
    session_id: Optional[str] = None
    source_account_id: Optional[str] = None
    ai_explainability: Optional[AIExplainability] = None


# API Request / Response Models
class InspectRequest(BaseModel):
    message: str = Field(..., max_length=5000, description="Natural language banking request")
    session_id: str = Field(default="demo-session-1", description="Session identifier")
    account_id: str = Field(default="CHK-9021", description="Source mock bank account")
    provider_mode: Optional[str] = Field(default="round_robin", description="AI Provider: round_robin, gemini, groq, openai")


class ExecuteRequest(BaseModel):
    request_id: str = Field(..., description="ID of the previously inspected request")
    confirmation: bool = Field(..., description="User explicit confirmation boolean")
    session_id: str = Field(default="demo-session-1", description="Session identifier")


class ExecuteResponse(BaseModel):
    success: bool
    transaction_id: Optional[str] = None
    message: str
    account_id: Optional[str] = None
    new_balance: Optional[float] = None
    timestamp: str
    simulation_mode: bool = True


# Policy Models
class FirewallPolicy(BaseModel):
    max_single_transfer: float = Field(default=2500.0, ge=1.0)
    daily_transfer_limit: float = Field(default=5000.0, ge=1.0)
    approved_recipients: List[str] = Field(default_factory=lambda: ["Rahul", "Priya", "Maya", "Vikram", "Suhas", "*"])
    unknown_recipient_action: str = Field(default="BLOCK", pattern="^(BLOCK|REVIEW)$")
    block_high_risk: bool = True
    require_explicit_confirmation: bool = True
    max_input_length: int = Field(default=800, ge=50, le=5000)
    strict_homoglyph_filtering: bool = True
    version: str = "v1.2"
    updated_at: str
    simulation_mode: bool = True


class PolicyUpdateRequest(BaseModel):
    max_single_transfer: Optional[float] = Field(None, ge=1.0)
    daily_transfer_limit: Optional[float] = Field(None, ge=1.0)
    approved_recipients: Optional[List[str]] = None
    unknown_recipient_action: Optional[str] = Field(None, pattern="^(BLOCK|REVIEW)$")
    block_high_risk: Optional[bool] = None
    require_explicit_confirmation: Optional[bool] = None
    max_input_length: Optional[int] = Field(None, ge=50, le=5000)
    strict_homoglyph_filtering: Optional[bool] = None


# Mock Banking Domain Models
class AccountInfo(BaseModel):
    account_id: str
    account_type: str
    account_name: str
    balance: float
    currency: str = "INR"
    status: str = "ACTIVE"
    daily_transferred_today: float = 0.0


class RecipientInfo(BaseModel):
    id: str
    name: str
    handle: str
    account_number: str
    is_trusted: bool = True
    category: str = "Personal"


class MockTransaction(BaseModel):
    transaction_id: str
    timestamp: str
    source_account_id: str
    recipient: str
    amount: float
    currency: str
    memo: Optional[str] = None
    status: str = "COMPLETED"
    request_id: Optional[str] = None
    simulation_mode: bool = True


# Audit Log Model
class AuditLogEntry(BaseModel):
    id: int
    request_id: str
    timestamp: str
    session_id: str
    raw_input: str
    normalized_input: str
    decision: Decision
    risk_level: RiskLevel
    threat_categories: List[str]
    operation: str
    amount: Optional[float] = None
    currency: Optional[str] = None
    recipient: Optional[str] = None
    memo: Optional[str] = None
    detected_signals: List[str]
    validation_errors: List[str]
    rationale: str
    mock_executed: bool = False
    transaction_id: Optional[str] = None
    policy_version: str
    simulation_mode: bool = True


# Dashboard Metrics Model
class DashboardMetrics(BaseModel):
    total_inspected: int
    approved_count: int
    blocked_count: int
    review_count: int
    detection_rate_pct: float
    total_mock_transferred_today: float
    threat_distribution: Dict[str, int]
    decision_distribution: Dict[str, int]
    risk_distribution: Dict[str, int]
    volume_by_hour: List[Dict[str, Any]]
    firewall_status: str
    uptime_seconds: float
    active_policy_version: str
    simulation_mode: bool = True
