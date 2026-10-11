"""Input Normalization Stage for Bankism Defensive Firewall.

Performs:
- Unicode NFKC normalization
- Detection and removal of zero-width and invisible characters
- Unusual whitespace normalization
- Homoglyph and confusable character detection & mapping
- Suspicious token separator / de-obfuscation detection
- Length bounds checking
"""

import unicodedata
import re
from typing import Tuple, List, Dict
from backend.schemas import NormalizationStageResult

# Confusable / Homoglyph mapping (Cyrillic, Greek, fullwidth, mathematical lookalikes)
HOMOGLYPH_MAP: Dict[str, str] = {
    # Cyrillic lookalikes to Latin
    '\u0430': 'a', '\u0410': 'A',  # а, А
    '\u0435': 'e', '\u0415': 'E',  # е, Е
    '\u043e': 'o', '\u041e': 'O',  # о, О
    '\u0440': 'p', '\u0420': 'P',  # р, Р
    '\u0441': 'c', '\u0421': 'C',  # с, С
    '\u0443': 'y', '\u0423': 'Y',  # у, У
    '\u0445': 'x', '\u0425': 'X',  # х, Х
    '\u0456': 'i', '\u0406': 'I',  # і, І
    '\u0458': 'j', '\u0408': 'J',  # ј, Ј
    '\u0455': 's', '\u0405': 'S',  # ѕ, Ѕ
    '\u0432': 'b', '\u0412': 'B',  # в, В
    '\u043d': 'h', '\u041d': 'H',  # н, Н
    '\u0442': 't', '\u0422': 'T',  # т, Т
    # Greek lookalikes
    '\u0391': 'A', '\u03b1': 'a',
    '\u0392': 'B',
    '\u0395': 'E', '\u03b5': 'e',
    '\u0397': 'H',
    '\u0399': 'I', '\u03b9': 'i',
    '\u039a': 'K', '\u03ba': 'k',
    '\u039c': 'M',
    '\u039d': 'N',
    '\u039f': 'O', '\u03bf': 'o',
    '\u03a1': 'P', '\u03c1': 'p',
    '\u03a4': 'T',
    '\u03a5': 'Y', '\u03c5': 'y',
    '\u03a7': 'X', '\u03c7': 'x',
}

# Zero-width and invisible unicode codepoints
ZERO_WIDTH_CHARS = set([
    '\u200b',  # zero-width space
    '\u200c',  # zero-width non-joiner
    '\u200d',  # zero-width joiner
    '\ufeff',  # zero-width no-break space / byte order mark
    '\u2060',  # word joiner
    '\u200e',  # LTR mark
    '\u200f',  # RTL mark
    '\u202a',  # LTR embedding
    '\u202b',  # RTL embedding
    '\u202c',  # pop directional formatting
    '\u202d',  # LTR override
    '\u202e',  # RTL override
    '\u00ad',  # soft hyphen
])

# Unusual whitespaces
UNUSUAL_WHITESPACES = {
    '\u00a0': ' ',  # non-breaking space
    '\u1680': ' ',  # ogham space mark
    '\u2000': ' ',  # en quad
    '\u2001': ' ',  # em quad
    '\u2002': ' ',  # en space
    '\u2003': ' ',  # em space
    '\u2004': ' ',  # three-per-em space
    '\u2005': ' ',  # four-per-em space
    '\u2006': ' ',  # six-per-em space
    '\u2007': ' ',  # figure space
    '\u2008': ' ',  # punctuation space
    '\u2009': ' ',  # thin space
    '\u200a': ' ',  # hair space
    '\u202f': ' ',  # narrow no-break space
    '\u205f': ' ',  # medium mathematical space
    '\u3000': ' ',  # ideographic space
}

LEET_REPLACEMENTS = {
    r'\b1gn0r[e3]\b': 'ignore',
    r'\bbyp4ss\b': 'bypass',
    r'\b0v3rr1d[e3]\b': 'override',
    r'\btr4nsf[e3]r\b': 'transfer',
    r'\bsy5t[e3]m\b': 'system',
}

# Pre-compiled regex for token separation evasion (e.g. "t.r.a.n.s.f.e.r", "i-g-n-o-r-e")
SEP_PATTERN = re.compile(r'\b([a-zA-Z])[\.\-_ ]([a-zA-Z])[\.\-_ ]([a-zA-Z])[\.\-_ ]([a-zA-Z])(?:[\.\-_ ]([a-zA-Z]))*\b')
PUNCT_CLEAN_RE = re.compile(r'[\.\-_ ]')


def normalize_input(raw_text: str, max_length: int = 800) -> Tuple[str, NormalizationStageResult]:
    """Normalizes raw user input and reports all detected anomalies."""
    notes: List[str] = []
    homoglyphs_detected: List[str] = []
    leetspeak_detected: List[str] = []
    zero_width_count = 0
    unusual_ws_count = 0
    status = "PASSED"

    if not raw_text:
        return "", NormalizationStageResult(
            original_text="",
            normalized_text="",
            length_original=0,
            length_normalized=0,
            status="PASSED",
            notes=["Empty input"]
        )

    orig_len = len(raw_text)

    # 1. Length check
    truncated = False
    text = raw_text
    if len(text) > max_length:
        notes.append(f"Input exceeded max length ({len(text)} > {max_length}). Truncated to safe boundary.")
        text = text[:max_length]
        truncated = True

    # 2. Count & Strip zero-width characters
    cleaned_chars = []
    for ch in text:
        if ch in ZERO_WIDTH_CHARS:
            zero_width_count += 1
        else:
            cleaned_chars.append(ch)

    if zero_width_count > 0:
        notes.append(f"Detected and stripped {zero_width_count} zero-width / hidden characters.")
        status = "FLAGGED"

    text = "".join(cleaned_chars)

    # 3. Unicode NFKC Normalization (standardizes compatibility characters, fullwidth Latin, etc.)
    text_nfkc = unicodedata.normalize("NFKC", text)
    if text_nfkc != text:
        notes.append("Applied Unicode NFKC canonical decomposition & composition.")
    text = text_nfkc

    # 4. Count and replace unusual whitespaces
    new_chars = []
    for ch in text:
        if ch in UNUSUAL_WHITESPACES:
            unusual_ws_count += 1
            new_chars.append(UNUSUAL_WHITESPACES[ch])
        else:
            new_chars.append(ch)

    if unusual_ws_count > 0:
        notes.append(f"Normalized {unusual_ws_count} unusual whitespace characters.")
        if status != "REJECTED":
            status = "FLAGGED"

    text = "".join(new_chars)

    # 5. Detect Homoglyphs / Confusables
    mapped_chars = []
    for ch in text:
        if ch in HOMOGLYPH_MAP:
            replacement = HOMOGLYPH_MAP[ch]
            homoglyphs_detected.append(f"'{ch}' (U+{ord(ch):04X}) -> '{replacement}'")
            mapped_chars.append(replacement)
        else:
            mapped_chars.append(ch)

    if homoglyphs_detected:
        notes.append(f"Detected {len(homoglyphs_detected)} confusable / homoglyph characters: {', '.join(homoglyphs_detected[:5])}")
        text = "".join(mapped_chars)
        status = "FLAGGED"

    # 6. Check for excessive token separators (e.g. "t.r.a.n.s.f.e.r", "i-g-n-o-r-e")
    excessive_separators = False
    matches = SEP_PATTERN.findall(text)
    if matches:
        excessive_separators = True
        notes.append("Detected deliberate token separation (spaced or punctuated letters attempting evasion).")
        def collapse_match(m):
            raw = m.group(0)
            return PUNCT_CLEAN_RE.sub('', raw)

        text = SEP_PATTERN.sub(collapse_match, text)
        status = "FLAGGED"

    # 7. Check for known leetspeak evasions
    for leet_re, standard_word in LEET_REPLACEMENTS.items():
        if re.search(leet_re, text, re.IGNORECASE):
            leetspeak_detected.append(standard_word)
            text = re.sub(leet_re, standard_word, text, flags=re.IGNORECASE)

    if leetspeak_detected:
        notes.append(f"De-obfuscated leetspeak keywords: {', '.join(leetspeak_detected)}")
        status = "FLAGGED"

    # 8. Clean up excess whitespace
    text = re.sub(r'[ \t]+', ' ', text).strip()

    result = NormalizationStageResult(
        original_text=raw_text,
        normalized_text=text,
        length_original=orig_len,
        length_normalized=len(text),
        zero_width_chars_found=zero_width_count,
        unusual_whitespace_found=unusual_ws_count,
        homoglyphs_detected=homoglyphs_detected,
        leetspeak_detected=leetspeak_detected,
        excessive_separators_found=excessive_separators,
        status=status,
        notes=notes
    )

    return text, result
