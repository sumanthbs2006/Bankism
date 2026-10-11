"""Threat Inspection Stage for Bankism Defensive Firewall.

Analyzes input for structured adversarial signals:
- Prompt Injection & Instruction Overrides
- Roleplay Jailbreaks & Persona Exploits
- Fake System / Developer Prompts & Formatting Tags
- Policy Overrides & Guardrail Disabling
- Memo Injections (Instruction execution via metadata)
- Secret Disclosure & Exfiltration
- Token Obfuscation (flagged via normalization)

Context Awareness:
- Harmless mentions of security settings or inquiries are permitted.
- Imperative overrides, evasions, and instructions targeting guardrails are flagged.
"""

import re
from typing import List, Tuple
from backend.schemas import (
    ThreatCategory,
    RiskLevel,
    ThreatSignal,
    ThreatInspectionStageResult,
    NormalizationStageResult
)

# 1. Prompt Injection Signatures
PROMPT_INJECTION_PATTERNS = [
    (r'(?i)\b(?:ignore|disregard|forget|bypass|override|drop)\s+(?:all\s+)?(?:(?:previous|prior|above|former|initial|system|bank)\s+)?(?:instructions|prompts|rules|directives|guidelines|constraints)\b',
     "Explicit directive to disregard prior system instructions.", RiskLevel.CRITICAL),
    (r'(?i)\b(?:new\s+instructions|system\s+update|developer\s+mode|root\s+access)\s*:\s*',
     "Attempted system instruction injection header.", RiskLevel.CRITICAL),
    (r'(?i)\b(?:you\s+must\s+now|from\s+now\s+on\s+you\s+will|your\s+new\s+role\s+is\s+to)\s+(?:ignore|execute|transfer|bypass)\b',
     "Imperative instruction realignment attempting override.", RiskLevel.HIGH),
    (r'(?i)<\s*\|\s*(?:im_start|im_end|system|developer|user|assistant)\s*\|?\s*>',
     "Chat template delimiter injection attempt.", RiskLevel.CRITICAL),
    (r'(?i)\[\s*(?:system|developer|admin|root|superuser)\s*(?:override|instruction|message)?\s*\]',
     "Bracketed pseudo-system prompt tag injection.", RiskLevel.CRITICAL),
    (r'(?i)\bdo\s+not\s+follow\s+(?:any\s+)?(?:rules|policies|guardrails|safety\s+checks)\b',
     "Explicit command to drop safety guardrails.", RiskLevel.CRITICAL),
]

# 2. Jailbreak Signatures
JAILBREAK_PATTERNS = [
    (r'(?i)\b(?:you\s+are(?:\s+now)?|act\s+as|pretend\s+to\s+be)\s+(?:DAN|AIM|an\s+unrestricted|a\s+jailbroken|evil\s+AI|godmode)\b',
     "Jailbreak persona adoption pattern (e.g. DAN/unrestricted).", RiskLevel.CRITICAL),
    (r'(?i)\b(?:DAN|AIM)\s*[,:]?\s*(?:an\s+unrestricted|a\s+jailbroken)\b',
     "DAN/AIM unrestricted jailbreak persona identifier.", RiskLevel.CRITICAL),
    (r'(?i)\b(?:in\s+a\s+fictional\s+universe|hypothetically\s+speaking|for\s+a\s+movie\s+script|in\s+an\s+alternate\s+reality)\s*[,:]?\s*(?:where\s+limits\s+don\'?t\s+apply|there\s+are\s+no\s+rules|transfer)\b',
     "Fictional scenario framing attempting policy evasion.", RiskLevel.HIGH),
    (r'(?i)\b(?:grandma\s+exploit|pretend\s+my\s+grandmother|as\s+a\s+bedtime\s+story)\b',
     "Grandma/story exploit pattern.", RiskLevel.HIGH),
    (r'(?i)\bact\s+as\s+(?:the\s+)?(?:bank\s+ceo|superadmin|root\s+administrator|system\s+architect)\s+and\s+(?:authorize|send|wire)\b',
     "Executive authority impersonation jailbreak.", RiskLevel.CRITICAL),
]

# 3. Policy Override & Safety Disabling
POLICY_OVERRIDE_PATTERNS = [
    (r'(?i)\b(?:disable|turn\s+off|shut\s+down|bypass|deactivate|skip)\s+(?:the\s+)?(?:firewall|safety\s+filter|guardrails?|daily\s+limits?|verification|2fa|otp|compliance|audit)\b',
     "Direct command to disable security controls or daily limits.", RiskLevel.CRITICAL),
    (r'(?i)\b(?:temporary|emergency|admin)\s+limit\s+is\s+now\s+[\$0-9,\.]+',
     "Attempt to redefine transfer limits in prompt.", RiskLevel.CRITICAL),
    (r'(?i)\b(?:set|change|update)\s+(?:max|daily)\s+limit\s+to\s+(?:unlimited|[\$0-9,\.]+)\b',
     "Attempt to modify policy limits via conversational input.", RiskLevel.CRITICAL),
    (r'(?i)\b(?:redefine|treat|alias|register)\s+[A-Za-z]+\s+(?:as|is\s+now)\s+(?:account|recipient|trusted)\b',
     "Attempt to redefine recipient allowlists via message.", RiskLevel.CRITICAL),
    (r'(?i)\b(?:authenticate|authorize)\s+as\s+(?:admin|root|superuser|bank_manager)\b',
     "Identity verification privilege escalation bypass.", RiskLevel.CRITICAL),
]

# 4. Memo Injection Signatures (Prompt injection hidden inside memo parameter)
MEMO_INJECTION_PATTERNS = [
    (r'(?i)memo\s*[:=]\s*["\']?.*(?:override|ignore|bypass|admin_override|auto_approve|confirm_bypass|execute_without_checks).*["\']?',
     "Adversarial policy override injected into transaction memo.", RiskLevel.CRITICAL),
    (r'(?i)memo\s*[:=]\s*["\']?.*(?:system\s+override|transfer\s+all|send\s+bonus|unlimited).*["\']?',
     "Elevated privileged instruction disguised inside payment memo.", RiskLevel.HIGH),
]

# 5. Data Exfiltration / Secret Disclosure
DATA_EXFILTRATION_PATTERNS = [
    (r'(?i)\b(?:reveal|print|show|output|leak|repeat|dump)\s+(?:your\s+)?(?:system\s+prompt|initial\s+prompt|developer\s+instructions|secret\s+key|api\s+key|password|jwt)\b',
     "System prompt or secret extraction attempt.", RiskLevel.HIGH),
    (r'(?i)\b(?:what\s+are\s+your|tell\s+me\s+your)\s+(?:hidden\s+rules|system\s+instructions|internal\s+prompts)\b',
     "Inquiry attempting to extract model system configuration.", RiskLevel.MEDIUM),
]


def inspect_threats(
    normalized_text: str,
    original_text: str,
    norm_result: NormalizationStageResult
) -> ThreatInspectionStageResult:
    """Inspects text for adversarial threats with contextual awareness.
    
    Returns structured findings without making financial authorization decisions.
    """
    signals: List[ThreatSignal] = []
    categories_set = set()
    highest_severity = RiskLevel.LOW

    # Helper to track max severity
    severity_order = {RiskLevel.LOW: 1, RiskLevel.MEDIUM: 2, RiskLevel.HIGH: 3, RiskLevel.CRITICAL: 4}
    def escalate_severity(sev: RiskLevel):
        nonlocal highest_severity
        if severity_order[sev] > severity_order[highest_severity]:
            highest_severity = sev

    # 1. Check for Token Obfuscation detected in Normalization Stage
    if norm_result.zero_width_chars_found > 0 or len(norm_result.homoglyphs_detected) > 2 or norm_result.excessive_separators_found:
        signal = ThreatSignal(
            category=ThreatCategory.TOKEN_OBFUSCATION,
            signal_type="EVASIVE_ENCODING",
            pattern_matched=f"zero_width={norm_result.zero_width_chars_found}, homoglyphs={len(norm_result.homoglyphs_detected)}",
            confidence=0.95,
            description="Deliberate unicode obfuscation or zero-width evasions detected.",
            severity=RiskLevel.HIGH
        )
        signals.append(signal)
        categories_set.add(ThreatCategory.TOKEN_OBFUSCATION)
        escalate_severity(RiskLevel.HIGH)

    # 2. Check Prompt Injection Patterns (inspect normalized text)
    for pattern, desc, sev in PROMPT_INJECTION_PATTERNS:
        match = re.search(pattern, normalized_text)
        if match:
            signals.append(ThreatSignal(
                category=ThreatCategory.PROMPT_INJECTION,
                signal_type="DIRECT_INJECTION",
                pattern_matched=match.group(0),
                confidence=0.98,
                description=desc,
                severity=sev
            ))
            categories_set.add(ThreatCategory.PROMPT_INJECTION)
            escalate_severity(sev)

    # 3. Check Jailbreak Patterns
    for pattern, desc, sev in JAILBREAK_PATTERNS:
        match = re.search(pattern, normalized_text)
        if match:
            signals.append(ThreatSignal(
                category=ThreatCategory.JAILBREAK,
                signal_type="ROLEPLAY_JAILBREAK",
                pattern_matched=match.group(0),
                confidence=0.96,
                description=desc,
                severity=sev
            ))
            categories_set.add(ThreatCategory.JAILBREAK)
            escalate_severity(sev)

    # 4. Check Policy Override Patterns (Context-Aware Check)
    # If the user is merely asking "how do security settings work?" or "show my security settings",
    # that is NOT a policy override.
    is_benign_security_inquiry = bool(re.search(
        r'(?i)\b(?:check|review|view|show|what\s+are|explain)\s+(?:my\s+)?(?:account\s+)?(?:security\s+settings|security\s+status|policies)\b',
        normalized_text
    )) and not bool(re.search(r'(?i)\b(?:disable|bypass|override|turn\s+off|ignore)\b', normalized_text))

    if not is_benign_security_inquiry:
        for pattern, desc, sev in POLICY_OVERRIDE_PATTERNS:
            match = re.search(pattern, normalized_text)
            if match:
                signals.append(ThreatSignal(
                    category=ThreatCategory.POLICY_OVERRIDE,
                    signal_type="GUARDRAIL_BYPASS",
                    pattern_matched=match.group(0),
                    confidence=0.97,
                    description=desc,
                    severity=sev
                ))
                categories_set.add(ThreatCategory.POLICY_OVERRIDE)
                escalate_severity(sev)

    # 5. Check Memo Injection Patterns
    for pattern, desc, sev in MEMO_INJECTION_PATTERNS:
        match = re.search(pattern, normalized_text)
        if match:
            signals.append(ThreatSignal(
                category=ThreatCategory.MEMO_INJECTION,
                signal_type="METADATA_INJECTION",
                pattern_matched=match.group(0),
                confidence=0.95,
                description=desc,
                severity=sev
            ))
            categories_set.add(ThreatCategory.MEMO_INJECTION)
            escalate_severity(sev)

    # 6. Check Data Exfiltration Patterns
    for pattern, desc, sev in DATA_EXFILTRATION_PATTERNS:
        match = re.search(pattern, normalized_text)
        if match:
            signals.append(ThreatSignal(
                category=ThreatCategory.DATA_EXFILTRATION_ATTEMPT,
                signal_type="SYSTEM_PROMPT_LEAK",
                pattern_matched=match.group(0),
                confidence=0.92,
                description=desc,
                severity=sev
            ))
            categories_set.add(ThreatCategory.DATA_EXFILTRATION_ATTEMPT)
            escalate_severity(sev)

    # Multiple Threats Handling
    if len(categories_set) > 1:
        categories_set.add(ThreatCategory.MULTIPLE_THREATS)

    categories_list = sorted(list(categories_set), key=lambda x: x.value)
    if not categories_list:
        categories_list = [ThreatCategory.NONE]

    # Stage Status
    if highest_severity in (RiskLevel.CRITICAL, RiskLevel.HIGH):
        status = "BLOCKED"
        rationale = f"Detected {len(signals)} high-risk threat signal(s) ({', '.join(c.value for c in categories_list)})."
    elif highest_severity == RiskLevel.MEDIUM:
        status = "REVIEW"
        rationale = f"Detected potential risk signals requiring human evaluation ({', '.join(c.value for c in categories_list)})."
    else:
        status = "PASSED"
        rationale = "No adversarial threats or policy evasion attempts identified."

    return ThreatInspectionStageResult(
        signals_detected=signals,
        highest_severity=highest_severity,
        threat_categories=categories_list,
        llm_classifier_used=False,
        llm_model=None,
        status=status,
        rationale=rationale
    )
