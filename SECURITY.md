# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

---

## Architecture & Threat Model

Bankism is an AI-powered defensive security firewall positioned between natural-language user banking requests and privileged core-banking operations. The architecture is engineered around the principle of **Zero Trust Natural Language Execution**:

1. **Strict Input Normalization**:
   - Defeats zero-width character steganography, invisible Unicode delimiters, bidirectional control characters, and confusable homoglyphs.
   - Enforces a bounded input buffer (maximum 800 characters by policy, 128 KB hard payload cutoff).

2. **Defense-in-Depth Pattern & Heuristic Inspection**:
   - High-confidence regex and token inspection for prompt injections, system prompt leak attempts, jailbreaks, role hijacking, and base64/hex payload obfuscation.
   - Severity calculation with instant escalation for adversarial intent.

3. **Multi-LLM Advisory Round-Robin (Gemini, Groq, OpenAI)**:
   - Advisory security analysis with fallback resilience.
   - **Crucial Security Invariant**: Natural language analysis has **advisory status only** and **cannot authorize** fund transfers.

4. **Deterministic Authorization Gate Invariant**:
   - Fund movement decisions are governed strictly by deterministic ledger checks:
     - Recipient allowlist verification (genuine human recipient validation).
     - Single-transaction policy ceiling (`max_single_transfer`).
     - 24-hour cumulative account velocity limits (`daily_transfer_limit`).
     - Real-time ledger balance sufficiency.
   - **Zero Bypass**: Any request flagged as `BLOCK` by the pipeline is cryptographically and logically rejected with HTTP 403 at `/api/firewall/execute`.

5. **Transport & Network Protection**:
   - In-memory sliding-window rate limiting (180 req/min per IP).
   - Strict HTTP response headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Strict-Transport-Security`, `Permissions-Policy`).
   - Constant-time secret comparison (`secrets.compare_digest`) for administrative policy tokens.

---

## Reporting a Vulnerability

If you discover a security vulnerability within Bankism, please do not disclose it publicly via GitHub issues. Instead, report it through one of the following channels:

- **Email**: `security@bankism.io` (or maintainer contact)
- **Response Timeline**: Acknowledgement within 24 hours, followed by a remediation and advisory plan within 72 hours.
