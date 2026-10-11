"""FastAPI Main Server for Bankism Defensive Banking Firewall."""

import time
import io
import csv
import json
from datetime import datetime, timezone
from typing import Optional, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Header, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel


from backend.config import DEMO_OPERATOR_TOKEN
from backend.db import init_db, get_db_connection, record_user_login, list_users
from backend.mock_bank import MockBankingService
from backend.pipeline import run_pipeline, get_active_policy, PrivilegedAuthorizationGate, SecurityGateViolation
from backend.schemas import (
    InspectRequest,
    ExecuteRequest,
    ExecuteResponse,
    FirewallVerdict,
    FirewallPolicy,
    PolicyUpdateRequest,
    DashboardMetrics,
    AccountInfo,
    RecipientInfo,
    MockTransaction,
    AIExplainability
)

SERVER_START_TIME = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB on start
    init_db(reset=False)
    yield


app = FastAPI(
    title="Bankism Defensive Firewall API",
    description="AI-powered defensive security firewall between natural-language banking requests and privileged operations.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration for Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "service": "Bankism Defensive Firewall",
        "status": "ONLINE",
        "simulation_mode": True,
        "docs": "/docs"
    }


@app.get("/api/health")
def health_endpoint():
    return {
        "status": "ok",
        "service": "Bankism Defensive Firewall",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


# ==============================================================================
# FIREWALL CORE ENDPOINTS
# ==============================================================================

@app.post("/api/firewall/inspect", response_model=FirewallVerdict)
def inspect_endpoint(request: InspectRequest):
    """Inspects a natural-language banking request through the multi-stage security pipeline."""
    verdict = run_pipeline(
        raw_message=request.message,
        session_id=request.session_id,
        account_id=request.account_id,
        provider_mode=request.provider_mode or "round_robin"
    )
    return verdict


@app.post("/api/firewall/explain", response_model=AIExplainability)
def explain_endpoint(request: InspectRequest):
    """Provides deep AI explainability for a banking transaction request using Round-Robin (Gemini, Groq, OpenAI)."""
    from backend.pipeline.llm_classifier import inspect_with_round_robin_llm
    return inspect_with_round_robin_llm(
        text=request.message,
        provider_mode=request.provider_mode or "round_robin"
    )


@app.post("/api/firewall/execute", response_model=ExecuteResponse)
def execute_endpoint(request: ExecuteRequest):
    """Executes a previously inspected transaction strictly through the Authorization Gate."""
    try:
        success, message, tx_id, new_balance, acc_id = PrivilegedAuthorizationGate.execute_transfer_through_gate(
            request_id=request.request_id,
            confirmation=request.confirmation,
            session_id=request.session_id
        )
        if not success:
            raise HTTPException(status_code=400, detail=message)

        return ExecuteResponse(
            success=True,
            transaction_id=tx_id,
            message=message,
            account_id=acc_id,
            new_balance=new_balance,
            timestamp=datetime.now(timezone.utc).isoformat(),
            simulation_mode=True
        )
    except SecurityGateViolation as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Authorization Gate Invariant Enforced: {str(e)}"
        )


# ==============================================================================
# DASHBOARD METRICS ENDPOINT (Computed from SQLite, Never Hardcoded)
# ==============================================================================

@app.get("/api/dashboard/metrics", response_model=DashboardMetrics)
def get_dashboard_metrics():
    """Computes real-time metrics strictly from stored SQLite audit events and ledger transactions."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM audit_logs")
    total_inspected = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM audit_logs WHERE decision = 'APPROVE'")
    approved_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM audit_logs WHERE decision = 'BLOCK'")
    blocked_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM audit_logs WHERE decision = 'REVIEW'")
    review_count = cursor.fetchone()[0]

    detection_rate = round(((blocked_count + review_count) / total_inspected * 100), 1) if total_inspected > 0 else 0.0

    # Total mock transferred today
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    cursor.execute("""
        SELECT COALESCE(SUM(amount), 0.0) FROM transactions 
        WHERE DATE(timestamp) = ? AND recipient != 'Payroll Direct Deposit'
    """, (today_str,))
    total_mock_transferred_today = round(cursor.fetchone()[0], 2)

    # Threat category distribution
    threat_distribution = {}
    cursor.execute("SELECT threat_categories FROM audit_logs")
    for row in cursor.fetchall():
        cats = json.loads(row[0]) if isinstance(row[0], str) else row[0]
        for c in cats:
            threat_distribution[c] = threat_distribution.get(c, 0) + 1

    decision_distribution = {
        "APPROVE": approved_count,
        "BLOCK": blocked_count,
        "REVIEW": review_count
    }

    # Risk level distribution
    cursor.execute("SELECT risk_level, COUNT(*) FROM audit_logs GROUP BY risk_level")
    risk_distribution = {r[0]: r[1] for r in cursor.fetchall()}

    # Volume by hour (grouped by timestamp)
    cursor.execute("""
        SELECT strftime('%H:00', timestamp) as hr, COUNT(*) as cnt,
               SUM(CASE WHEN decision = 'BLOCK' THEN 1 ELSE 0 END) as blocks
        FROM audit_logs 
        GROUP BY hr 
        ORDER BY hr ASC
    """)
    volume_by_hour = [{"hour": r[0] or "12:00", "requests": r[1], "blocks": r[2]} for r in cursor.fetchall()]

    if not volume_by_hour:
        volume_by_hour = [{"hour": "10:00", "requests": total_inspected, "blocks": blocked_count}]

    policy = get_active_policy()
    conn.close()

    uptime = round(time.time() - SERVER_START_TIME, 1)

    return DashboardMetrics(
        total_inspected=total_inspected,
        approved_count=approved_count,
        blocked_count=blocked_count,
        review_count=review_count,
        detection_rate_pct=detection_rate,
        total_mock_transferred_today=total_mock_transferred_today,
        threat_distribution=threat_distribution,
        decision_distribution=decision_distribution,
        risk_distribution=risk_distribution,
        volume_by_hour=volume_by_hour,
        firewall_status="ACTIVE - ENFORCING",
        uptime_seconds=uptime,
        active_policy_version=policy.version,
        simulation_mode=True
    )


# ==============================================================================
# AUDIT LOG ENDPOINTS (Search, Filter, Export JSON & CSV)
# ==============================================================================

@app.get("/api/audit")
def get_audit_logs(
    search: Optional[str] = Query(None, description="Search term in input or recipient"),
    decision: Optional[str] = Query(None, description="Filter by APPROVE, BLOCK, REVIEW"),
    risk: Optional[str] = Query(None, description="Filter by LOW, MEDIUM, HIGH, CRITICAL"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    format: Optional[str] = Query("json", description="Export format: json or csv")
):
    """Retrieves or exports audit events with multi-criteria filtering."""
    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM audit_logs WHERE 1=1"
    params = []

    if decision:
        query += " AND decision = ?"
        params.append(decision.upper())

    if risk:
        query += " AND risk_level = ?"
        params.append(risk.upper())

    if search:
        query += " AND (raw_input LIKE ? OR recipient LIKE ? OR request_id LIKE ? OR rationale LIKE ?)"
        term = f"%{search}%"
        params.extend([term, term, term, term])

    query += " ORDER BY timestamp DESC"

    # CSV Export format
    if format and format.lower() == "csv":
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "request_id", "timestamp", "session_id", "decision", "risk_level",
            "threat_categories", "operation", "amount", "currency", "recipient",
            "memo", "mock_executed", "transaction_id", "raw_input", "rationale"
        ])
        for r in rows:
            writer.writerow([
                r["request_id"], r["timestamp"], r["session_id"], r["decision"], r["risk_level"],
                r["threat_categories"], r["operation"], r["amount"], r["currency"], r["recipient"],
                r["memo"], r["mock_executed"], r["transaction_id"], r["raw_input"], r["rationale"]
            ])

        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode('utf-8')),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=bankism_audit_logs.csv"}
        )

    # Standard JSON format
    query_paginated = query + " LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    cursor.execute(query_paginated, params)
    rows = cursor.fetchall()

    # Total matching count
    count_query = "SELECT COUNT(*) FROM audit_logs WHERE 1=1"
    count_params = []
    if decision:
        count_query += " AND decision = ?"
        count_params.append(decision.upper())
    if risk:
        count_query += " AND risk_level = ?"
        count_params.append(risk.upper())
    if search:
        count_query += " AND (raw_input LIKE ? OR recipient LIKE ? OR request_id LIKE ? OR rationale LIKE ?)"
        count_params.extend([term, term, term, term])

    cursor.execute(count_query, count_params)
    total_matching = cursor.fetchone()[0]
    conn.close()

    logs = []
    for r in rows:
        d = dict(r)
        d["threat_categories"] = json.loads(d["threat_categories"]) if isinstance(d["threat_categories"], str) else d["threat_categories"]
        d["detected_signals"] = json.loads(d["detected_signals"]) if isinstance(d["detected_signals"], str) else d["detected_signals"]
        d["validation_errors"] = json.loads(d["validation_errors"]) if isinstance(d["validation_errors"], str) else d["validation_errors"]
        d["mock_executed"] = bool(d["mock_executed"])
        logs.append(d)

    return {
        "total": total_matching,
        "limit": limit,
        "offset": offset,
        "logs": logs
    }


# ==============================================================================
# POLICY CONFIGURATION ENDPOINTS (Versioned, Operator Token Protected)
# ==============================================================================

@app.get("/api/policy", response_model=FirewallPolicy)
def get_policy_endpoint():
    """Returns the current active firewall policy."""
    return get_active_policy()


@app.put("/api/policy", response_model=FirewallPolicy)
def update_policy_endpoint(
    update: PolicyUpdateRequest,
    x_operator_token: Optional[str] = Header(None, alias="X-Operator-Token")
):
    """Updates firewall policy settings. Protected by operator token authorization."""
    if not x_operator_token or x_operator_token != DEMO_OPERATOR_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Valid demo operator token required in 'X-Operator-Token' header."
        )

    current = get_active_policy()

    # Compute new version increment
    try:
        curr_ver_num = float(current.version.replace("v", ""))
        new_version = f"v{curr_ver_num + 0.1:.1f}"
    except Exception:
        new_version = f"v1.{int(time.time()) % 100}"

    new_max_single = update.max_single_transfer if update.max_single_transfer is not None else current.max_single_transfer
    new_daily_limit = update.daily_transfer_limit if update.daily_transfer_limit is not None else current.daily_transfer_limit
    new_recipients = update.approved_recipients if update.approved_recipients is not None else current.approved_recipients
    new_unknown_action = update.unknown_recipient_action if update.unknown_recipient_action is not None else current.unknown_recipient_action
    new_block_high = update.block_high_risk if update.block_high_risk is not None else current.block_high_risk
    new_req_confirm = update.require_explicit_confirmation if update.require_explicit_confirmation is not None else current.require_explicit_confirmation
    new_max_len = update.max_input_length if update.max_input_length is not None else current.max_input_length
    new_strict_homoglyph = update.strict_homoglyph_filtering if update.strict_homoglyph_filtering is not None else current.strict_homoglyph_filtering

    now_iso = datetime.now(timezone.utc).isoformat()

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO policies 
        (version, max_single_transfer, daily_transfer_limit, approved_recipients, 
         unknown_recipient_action, block_high_risk, require_explicit_confirmation, 
         max_input_length, strict_homoglyph_filtering, updated_at, simulation_mode)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        new_version,
        new_max_single,
        new_daily_limit,
        json.dumps(new_recipients),
        new_unknown_action,
        1 if new_block_high else 0,
        1 if new_req_confirm else 0,
        new_max_len,
        1 if new_strict_homoglyph else 0,
        now_iso,
        1
    ))
    conn.commit()
    conn.close()

    return get_active_policy()


# ==============================================================================
# MOCK BANKING DOMAIN ENDPOINTS
# ==============================================================================

@app.get("/api/accounts", response_model=List[AccountInfo])
def get_accounts_endpoint():
    """Lists simulated bank accounts and live balances."""
    return MockBankingService.get_accounts()


@app.get("/api/recipients", response_model=List[RecipientInfo])
def get_recipients_endpoint():
    """Lists registered recipient profiles."""
    return MockBankingService.get_recipients()


@app.get("/api/transactions", response_model=List[MockTransaction])
def get_transactions_endpoint(limit: int = 50):
    """Lists transactions from the simulated banking ledger."""
    return MockBankingService.get_transactions(limit=limit)


@app.post("/api/demo/seed")
def seed_demo_endpoint():
    """Resets and re-seeds database with pristine demo records."""
    init_db(reset=True)
    return {
        "success": True,
        "message": "Demo banking environment and firewall audit logs re-seeded successfully.",
        "simulation_mode": True
    }


# ==============================================================================
# GOOGLE OAUTH & USER SESSIONS
# ==============================================================================

class GoogleAuthPayload(BaseModel):
    credential: Optional[str] = None
    email: Optional[str] = None
    name: Optional[str] = None
    picture: Optional[str] = None
    sub: Optional[str] = None
    provider: Optional[str] = "google"


@app.post("/api/auth/google")
def google_auth_endpoint(payload: GoogleAuthPayload):
    """Registers or logs in a user via Google OAuth credential / profile."""
    email = payload.email or "operator@bankism.ai"
    name = payload.name or "Google Security Operator"
    user_info = {
        "email": email,
        "name": name,
        "picture": payload.picture,
        "sub": payload.sub or f"usr_{int(time.time())}",
        "provider": payload.provider or "google"
    }
    recorded = record_user_login(user_info)
    return {
        "status": "authenticated",
        "user": recorded
    }


@app.get("/api/auth/users")
def get_users_endpoint():
    """Lists registered users and security operators."""
    return list_users()


# ==============================================================================
# MULTI-LLM ROUND ROBIN CHAT ENDPOINTS
# ==============================================================================
from backend.llm_chat import ChatRequest, ChatResponse, dispatch_round_robin_chat, state as round_robin_state


@app.post("/api/chat", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest):
    """Converses with Bankism Copilot distributing queries across Gemini, Groq, and OpenAI in Round Robin."""
    return dispatch_round_robin_chat(request)


@app.get("/api/chat/status")
def chat_status_endpoint(session_id: Optional[str] = None):
    """Returns real-time status and token distribution metrics across all 3 LLMs."""
    from backend.config import GEMINI_API_KEY, GROQ_API_KEY, OPENAI_API_KEY
    active_prov = round_robin_state.get_session_provider(session_id) if session_id else round_robin_state.providers_order[round_robin_state.session_counter % len(round_robin_state.providers_order)]
    return {
        "session_id": session_id,
        "active_session_provider": active_prov,
        "providers": {
            "gemini": {
                "name": "Google Gemini",
                "configured": bool(GEMINI_API_KEY),
                "model": "gemini-1.5-flash / gemini-2.0-flash",
                "status": "ONLINE" if bool(GEMINI_API_KEY) else "NO_KEY"
            },
            "groq": {
                "name": "Groq Cloud",
                "configured": bool(GROQ_API_KEY),
                "model": "llama-3.3-70b / llama-3.1-8b",
                "status": "ONLINE" if bool(GROQ_API_KEY) else "NO_KEY"
            },
            "openai": {
                "name": "OpenAI",
                "configured": bool(OPENAI_API_KEY),
                "model": "gpt-4o-mini",
                "status": "STANDBY / QUOTA_FAILOVER" if bool(OPENAI_API_KEY) else "NO_KEY"
            }
        },
        "stats": round_robin_state.get_stats()
    }


