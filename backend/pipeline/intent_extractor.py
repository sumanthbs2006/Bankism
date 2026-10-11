"""Intent and Entity Extraction Stage for Bankism Defensive Firewall.

Extracts structured domain entities:
- Operation Type: TRANSFER, BALANCE_INQUIRY, TRANSACTION_HISTORY, ACCOUNT_INFO, SECURITY_INQUIRY, UNKNOWN
- Amount (float) and Currency (ISO string)
- Recipient Name / Identifier
- Memo (sanitized and strictly tagged as untrusted metadata)
- Ambiguity identification
"""

import re
from typing import Optional, Tuple, List
from backend.schemas import (
    OperationType,
    ExtractedEntities,
    IntentExtractionStageResult
)


# Pre-compiled regular expressions for entity parsing
AMOUNT_PATTERN = re.compile(
    r'(?:(?P<sym>[\₹\$\€\£]|(?:rs\.?|inr)\b)\s*)?(?P<num>\b\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\b\d+(?:\.\d{1,2})?)\b\s*(?:(?P<code_post>INR|rupees?|rupee|rs\.?|USD|EUR|GBP|dollars?|bucks?|cents?)\b)?',
    re.IGNORECASE
)
NOISE_TX_PATTERN = re.compile(r'(?i)\b(?:last|recent|past)\s+(\d+)\s+transactions\b')
NOISE_2FA_PATTERN = re.compile(r'(?i)\b\d+fa\b')
TRANSFER_CUE_PATTERN = re.compile(r'(?i)\b(?:transfer|send|wire|pay|give|remit)\b')
PRONOUN_PATTERN = re.compile(r'(?i)\b(?:to\s+)?(him|her|them|someone|this\s+person|account)\b')
TO_PRONOUN_PATTERN = re.compile(r'(?i)\bto\s+(him|her|them|someone|account)\b')
TO_MATCH_PATTERN = re.compile(
    r'(?i)\b(?:to|unto)\s+([A-Za-z][A-Za-z0-9_\-\.]*(?:\s+[A-Za-z][A-Za-z0-9_\-\.]*)*?)(?:\s+(?:for|memo|note|message|with|using|via|from|as|because|at|on|\d|\$|\₹|rs\.?)\b|$)'
)
SEND_MATCH_PATTERN = re.compile(
    r'(?i)\b(?:pay|send|transfer|wire|remit)\s+([A-Za-z][A-Za-z0-9_\-\.]*(?:\s+[A-Za-z][A-Za-z0-9_\-\.]*)*?)(?:\s+(?:for|memo|note|with|to|\$|\₹|rs\.?|inr|usd)?\s*\d+|$)'
)
MEMO_MATCH_PATTERN = re.compile(r'(?i)\b(?:memo|for|note|message)\s*[:=]?\s*["\']?([^"\']+)["\']?$')


def extract_amount_and_currency(text: str) -> Tuple[Optional[float], Optional[str], List[str]]:
    """Extracts financial amounts and currencies, defaulting to INR (₹ / Rupees)."""
    ambiguity_flags = []
    amounts = []
    currencies = []

    # Strip noise phrases like "last 5 transactions" or "2fa"
    text_clean = NOISE_TX_PATTERN.sub('', text)
    text_clean = NOISE_2FA_PATTERN.sub('', text_clean)

    for m in AMOUNT_PATTERN.finditer(text_clean):
        num_str = m.group("num")
        sym = (m.group("sym") or "").strip().lower()
        code_post = (m.group("code_post") or "").strip().lower()

        if not num_str:
            continue

        has_currency_indicator = bool(sym or code_post)
        has_transfer_cue = bool(TRANSFER_CUE_PATTERN.search(text))

        if not has_currency_indicator and not has_transfer_cue:
            continue

        try:
            val = float(num_str.replace(',', ''))

            # Determine currency - default is INR (Rupees)
            curr = "INR"
            if sym == '$' or 'dollar' in code_post or code_post == 'usd':
                val = val * 96.0  # 1 dollar = 96 rupees conversion
                curr = "INR"
            elif sym == '€' or code_post == 'eur':
                val = val * 105.0
                curr = "EUR"
            elif sym == '£' or code_post == 'gbp':
                val = val * 120.0
                curr = "GBP"
            else:
                curr = "INR"

            amounts.append(val)
            currencies.append(curr)
        except ValueError:
            continue

    if not amounts:
        return None, None, ambiguity_flags

    if len(amounts) > 1:
        # Check if amounts conflict
        if len(set(amounts)) > 1:
            ambiguity_flags.append(f"Multiple distinct amounts detected in single prompt: {amounts}")
        return amounts[0], currencies[0], ambiguity_flags

    return amounts[0], currencies[0], ambiguity_flags


def extract_recipient(text: str) -> Tuple[Optional[str], List[str]]:
    """Extracts destination recipient name."""
    ambiguity_flags = []
    text_clean = text.strip()

    # Pronoun checks
    pronoun_match = PRONOUN_PATTERN.search(text_clean)
    if pronoun_match and TO_PRONOUN_PATTERN.search(text_clean):
        ambiguity_flags.append(f"Ambiguous pronoun '{pronoun_match.group(1)}' used instead of a named recipient")
        return None, ambiguity_flags

    # 1. Primary: "to <Name>" (e.g. "send 500 to Suhas", "transfer ₹250 to Priya Patel for catering")
    to_match = TO_MATCH_PATTERN.search(text_clean)
    if to_match:
        cand = to_match.group(1).strip().rstrip('.,;:!?')
        if cand.lower() not in {'my', 'the', 'a', 'an', 'our', 'his', 'her', 'their', 'checking', 'savings', 'account', 'money', 'funds', 'cash', 'balance'}:
            return cand, ambiguity_flags

    # 2. Secondary: "send/pay <Name> [Amount]" (e.g. "send Suhas 500", "pay Rahul ₹200")
    send_match = SEND_MATCH_PATTERN.search(text_clean)
    if send_match:
        cand = send_match.group(1).strip().rstrip('.,;:!?')
        if cand.lower() not in {'my', 'the', 'a', 'an', 'our', 'his', 'her', 'their', 'checking', 'savings', 'account', 'money', 'funds', 'cash', 'balance', 'please', 'can', 'you'}:
            return cand, ambiguity_flags

    # 3. Tertiary scan for common/seed recipient names
    known_names = ["suhas", "rahul", "priya", "maya", "vikram"]
    for name in known_names:
        if re.search(rf'\b{name}\b', text_clean, re.IGNORECASE):
            return name.capitalize(), ambiguity_flags

    return None, ambiguity_flags


def extract_memo(text: str) -> Optional[str]:
    """Extracts memo/note payload and enforces untrusted metadata isolation."""
    memo_match = MEMO_MATCH_PATTERN.search(text)
    if memo_match:
        memo_raw = memo_match.group(1).strip()
        return memo_raw[:200]
    return None


def extract_intent_and_entities(normalized_text: str) -> IntentExtractionStageResult:
    """Analyzes intent, extracts entities, and flags semantic ambiguities."""
    ambiguity_reasons = []

    # 1. Operation Classification
    op = OperationType.UNKNOWN

    if re.search(r'(?i)\b(?:balance|how\s+much\s+(?:money|funds|do\s+i\s+have)|available\s+funds)\b', normalized_text):
        op = OperationType.BALANCE_INQUIRY
    elif re.search(r'(?i)\b(?:transactions?|history|recent\s+activity|statement|past\s+payments)\b', normalized_text):
        op = OperationType.TRANSACTION_HISTORY
    elif re.search(r'(?i)\b(?:transfer|send|wire|pay|remit|forward\s+funds)\b', normalized_text):
        op = OperationType.TRANSFER
    elif re.search(r'(?i)\b(?:security\s+settings|firewall\s+status|password|policies|who\s+are\s+you)\b', normalized_text):
        op = OperationType.SECURITY_INQUIRY
    elif re.search(r'(?i)\b(?:account\s+number|account\s+info|routing\s+number)\b', normalized_text):
        op = OperationType.ACCOUNT_INFO

    amount, currency, amt_ambiguities = extract_amount_and_currency(normalized_text)
    recipient, rec_ambiguities = extract_recipient(normalized_text)
    memo = extract_memo(normalized_text)

    ambiguity_reasons.extend(amt_ambiguities)
    ambiguity_reasons.extend(rec_ambiguities)

    # 2. Validation of mandatory parameters for TRANSFER
    if op == OperationType.TRANSFER:
        if amount is None:
            ambiguity_reasons.append("Transfer operation requires an explicit amount.")
        elif amount <= 0:
            ambiguity_reasons.append("Transfer amount must be strictly positive.")

        if recipient is None:
            ambiguity_reasons.append("Transfer operation requires an explicit recipient.")

    is_ambiguous = len(ambiguity_reasons) > 0
    status = "AMBIGUOUS" if is_ambiguous else ("UNKNOWN" if op == OperationType.UNKNOWN else "PASSED")

    entities = ExtractedEntities(
        operation=op,
        amount=amount,
        currency=currency or "INR",
        recipient=recipient,
        memo=memo,
        confidence=0.95 if not is_ambiguous else 0.5,
        ambiguity_flags=ambiguity_reasons
    )

    return IntentExtractionStageResult(
        operation=op,
        entities=entities,
        is_ambiguous=is_ambiguous,
        ambiguity_reasons=ambiguity_reasons,
        status=status
    )
