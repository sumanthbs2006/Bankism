"""Configuration settings for Bankism AI Defensive Banking Firewall."""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = os.getenv("BANKISM_DB_PATH", str(BASE_DIR / "bankism.db"))

# Demo operator authorization token for policy changes
DEMO_OPERATOR_TOKEN = os.getenv("DEMO_OPERATOR_TOKEN", "demo-operator-token-2026")

env_path = BASE_DIR.parent / ".env"
if env_path.exists():
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ[k.strip()] = v.strip()
    except Exception:
        pass

# Optional LLM classifier configuration
LLM_CLASSIFIER_ENABLED = os.getenv("LLM_CLASSIFIER_ENABLED", "false").lower() in ("true", "1", "yes")
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "none")  # 'openai', 'gemini', 'groq', or 'none'
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

# Default Policy Limits (1 USD = 96 INR)
DEFAULT_MAX_SINGLE_TRANSFER = 240000.00
DEFAULT_DAILY_TRANSFER_LIMIT = 480000.00
DEFAULT_MAX_INPUT_LENGTH = 800
DEFAULT_REQUIRE_EXPLICIT_CONFIRMATION = True
DEFAULT_BLOCK_HIGH_RISK = True
DEFAULT_UNKNOWN_RECIPIENT_ACTION = "BLOCK"  # "BLOCK" or "REVIEW"
