export type Decision = 'APPROVE' | 'BLOCK' | 'REVIEW';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ThreatCategory =
  | 'NONE'
  | 'PROMPT_INJECTION'
  | 'JAILBREAK'
  | 'POLICY_OVERRIDE'
  | 'MEMO_INJECTION'
  | 'TOKEN_OBFUSCATION'
  | 'AMBIGUOUS_TRANSACTION'
  | 'RECIPIENT_VALIDATION_FAILURE'
  | 'AMOUNT_POLICY_VIOLATION'
  | 'AUTHORIZATION_FAILURE'
  | 'DATA_EXFILTRATION_ATTEMPT'
  | 'MULTIPLE_THREATS';

export type OperationType =
  | 'TRANSFER'
  | 'BALANCE_INQUIRY'
  | 'TRANSACTION_HISTORY'
  | 'ACCOUNT_INFO'
  | 'SECURITY_INQUIRY'
  | 'UNKNOWN';

export interface ThreatSignal {
  category: ThreatCategory;
  signal_type: string;
  pattern_matched: string;
  confidence: number;
  description: string;
  severity: RiskLevel;
}

export interface NormalizationStageResult {
  original_text: string;
  normalized_text: string;
  length_original: number;
  length_normalized: number;
  zero_width_chars_found: number;
  unusual_whitespace_found: number;
  homoglyphs_detected: string[];
  leetspeak_detected: string[];
  excessive_separators_found: boolean;
  status: string;
  notes: string[];
}

export interface ThreatInspectionStageResult {
  signals_detected: ThreatSignal[];
  highest_severity: RiskLevel;
  threat_categories: ThreatCategory[];
  llm_classifier_used: boolean;
  llm_model?: string | null;
  status: string;
  rationale: string;
}

export interface ExtractedEntities {
  operation: OperationType;
  amount: number | null;
  currency: string | null;
  recipient: string | null;
  memo: string | null;
  confidence: number;
  ambiguity_flags: string[];
}

export interface IntentExtractionStageResult {
  operation: OperationType;
  entities: ExtractedEntities;
  is_ambiguous: boolean;
  ambiguity_reasons: string[];
  status: string;
}

export interface DeterministicValidationStageResult {
  passed_all_checks: boolean;
  errors: string[];
  checks: Record<string, any>;
  status: string;
}

export interface AuthorizationGateStageResult {
  gate_passed: boolean;
  decision: Decision;
  reasons: string[];
  requires_human_confirmation: boolean;
  transaction_authorized: boolean;
}

export interface PipelineStages {
  normalization: NormalizationStageResult;
  threat_inspection: ThreatInspectionStageResult;
  intent_extraction: IntentExtractionStageResult;
  deterministic_validation: DeterministicValidationStageResult;
  authorization_gate: AuthorizationGateStageResult;
}

export interface AIExplainability {
  provider_name: string;
  provider_id: string;
  model_name: string;
  turn_number: number;
  is_malicious: boolean;
  risk_level: string;
  threat_category: string;
  plain_english_verdict: string;
  assessment_summary: string;
  risk_factors: string[];
  mitigation_advice: string;
  confidence: number;
  timestamp: string;
}

export interface FirewallVerdict {
  request_id: string;
  decision: Decision;
  risk_level: RiskLevel;
  threat_categories: ThreatCategory[];
  operation: OperationType;
  requires_human_review: boolean;
  transaction_authorized: boolean;
  normalized_request: string;
  detected_signals: string[];
  validation_errors: string[];
  rationale: string;
  timestamp: string;
  policy_version: string;
  simulation_mode: boolean;
  pipeline_stages?: PipelineStages;
  extracted_entities?: ExtractedEntities;
  original_request?: string;
  session_id?: string;
  source_account_id?: string;
  ai_explainability?: AIExplainability;
}

export interface ExecuteResponse {
  success: boolean;
  transaction_id: string | null;
  message: string;
  account_id: string | null;
  new_balance: number | null;
  timestamp: string;
  simulation_mode: boolean;
}

export interface FirewallPolicy {
  max_single_transfer: number;
  daily_transfer_limit: number;
  approved_recipients: string[];
  unknown_recipient_action: 'BLOCK' | 'REVIEW';
  block_high_risk: boolean;
  require_explicit_confirmation: boolean;
  max_input_length: number;
  strict_homoglyph_filtering: boolean;
  version: string;
  updated_at: string;
  simulation_mode: boolean;
}

export interface DashboardMetrics {
  total_inspected: number;
  approved_count: number;
  blocked_count: number;
  review_count: number;
  detection_rate_pct: number;
  total_mock_transferred_today: number;
  threat_distribution: Record<string, number>;
  decision_distribution: Record<string, number>;
  risk_distribution: Record<string, number>;
  volume_by_hour: Array<{ hour: string; requests: number; blocks: number }>;
  firewall_status: string;
  uptime_seconds: number;
  active_policy_version: string;
  simulation_mode: boolean;
}

export interface AuditLogEntry {
  id: number;
  request_id: string;
  timestamp: string;
  session_id: string;
  raw_input: string;
  normalized_input: string;
  decision: Decision;
  risk_level: RiskLevel;
  threat_categories: string[];
  operation: string;
  amount: number | null;
  currency: string | null;
  recipient: string | null;
  memo: string | null;
  detected_signals: string[];
  validation_errors: string[];
  rationale: string;
  mock_executed: boolean;
  transaction_id: string | null;
  policy_version: string;
  simulation_mode: boolean;
}

export interface AccountInfo {
  account_id: string;
  account_type: string;
  account_name: string;
  balance: number;
  currency: string;
  status: string;
  daily_transferred_today: number;
}

export interface RecipientInfo {
  id: string;
  name: string;
  handle: string;
  account_number: string;
  is_trusted: boolean;
  category: string;
}

export interface MockTransaction {
  transaction_id: string;
  timestamp: string;
  source_account_id: string;
  recipient: string;
  amount: number;
  currency: string;
  memo: string | null;
  status: string;
  request_id: string | null;
  simulation_mode: boolean;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  picture?: string;
  provider: 'google' | 'demo';
  signedInAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  provider_used?: string;
  provider_id?: 'gemini' | 'groq' | 'openai';
  model_name?: string;
  turn_number?: number;
  fallback_triggered?: boolean;
  fallback_reason?: string;
  timestamp: string;
}

export interface ChatResponsePayload {
  response: string;
  provider_used: string;
  provider_id: 'gemini' | 'groq' | 'openai';
  model_name: string;
  turn_number: number;
  fallback_triggered: boolean;
  fallback_reason?: string;
  timestamp: string;
  stats: {
    total_queries: number;
    turn_counter: number;
    next_scheduled_provider: string;
    distribution: Record<string, number>;
    token_conservation_rate: string;
  };
}

export interface ChatStatusPayload {
  session_id?: string;
  active_session_provider?: 'gemini' | 'groq' | 'openai';
  providers: {
    gemini: { name: string; configured: boolean; model: string; status: string };
    groq: { name: string; configured: boolean; model: string; status: string };
    openai: { name: string; configured: boolean; model: string; status: string };
  };
  stats: {
    total_queries: number;
    turn_counter: number;
    next_scheduled_provider: string;
    distribution: Record<string, number>;
    token_conservation_rate: string;
  };
}


