import {
  FirewallVerdict,
  ExecuteResponse,
  DashboardMetrics,
  AuditLogEntry,
  FirewallPolicy,
  AccountInfo,
  RecipientInfo,
  MockTransaction,
  AIExplainability
} from './types';

const getApiBase = () => {
  const envBase = (import.meta.env.VITE_API_BASE as string | undefined)?.trim().replace(/\/$/, '');
  if (!envBase) return 'https://bankism-nuos.onrender.com/api';
  return envBase.endsWith('/api') ? envBase : `${envBase}/api`;
};

const API_BASE = getApiBase();

async function handleResponse<T>(res: Response, fallbackMessage: string): Promise<T> {
  if (!res.ok) {
    let errMsg = fallbackMessage;
    try {
      const data = await res.json();
      errMsg = data.detail || data.message || fallbackMessage;
    } catch {
      if (res.status === 404) {
        errMsg = "Endpoint returned 404 (Not Found). Please check that VITE_API_BASE in Vercel points to your live Render backend (e.g. https://your-app.onrender.com/api).";
      } else {
        errMsg = `Server error (${res.status}): ${res.statusText || fallbackMessage}`;
      }
    }
    throw new Error(errMsg);
  }
  return res.json();
}

// Session ID generation for round-robin model rotation across sessions
function generateSessionId(): string {
  return 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
}

let activeChatSessionId = generateSessionId();

export const getActiveChatSessionId = () => activeChatSessionId;

export const resetChatSession = () => {
  activeChatSessionId = generateSessionId();
  return activeChatSessionId;
};

export const api = {
  async inspectRequest(message: string, sessionId = 'demo-session-1', accountId = 'CHK-9021', providerMode = 'round_robin'): Promise<FirewallVerdict> {
    const res = await fetch(`${API_BASE}/firewall/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, session_id: sessionId, account_id: accountId, provider_mode: providerMode })
    });
    return handleResponse<FirewallVerdict>(res, 'Failed to inspect request');
  },

  async explainRequest(message: string, providerMode = 'round_robin'): Promise<AIExplainability> {
    const res = await fetch(`${API_BASE}/firewall/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, provider_mode: providerMode })
    });
    return handleResponse<AIExplainability>(res, 'Failed to generate AI explainability');
  },

  async executeRequest(requestId: string, confirmation: boolean, sessionId = 'demo-session-1'): Promise<ExecuteResponse> {
    const res = await fetch(`${API_BASE}/firewall/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_id: requestId, confirmation, session_id: sessionId })
    });
    return handleResponse<ExecuteResponse>(res, 'Execution rejected by Authorization Gate');
  },

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const res = await fetch(`${API_BASE}/dashboard/metrics`);
    return handleResponse<DashboardMetrics>(res, 'Failed to load metrics');
  },

  async getAuditLogs(params?: {
    search?: string;
    decision?: string;
    risk?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ total: number; limit: number; offset: number; logs: AuditLogEntry[] }> {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.decision && params.decision !== 'ALL') query.append('decision', params.decision);
    if (params?.risk && params.risk !== 'ALL') query.append('risk', params.risk);
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.offset) query.append('offset', params.offset.toString());

    const res = await fetch(`${API_BASE}/audit?${query.toString()}`);
    return handleResponse<{ total: number; limit: number; offset: number; logs: AuditLogEntry[] }>(res, 'Failed to load audit logs');
  },

  downloadAuditCsvUrl(params?: { search?: string; decision?: string; risk?: string }): string {
    const query = new URLSearchParams();
    query.append('format', 'csv');
    if (params?.search) query.append('search', params.search);
    if (params?.decision && params.decision !== 'ALL') query.append('decision', params.decision);
    if (params?.risk && params.risk !== 'ALL') query.append('risk', params.risk);
    return `${API_BASE}/audit?${query.toString()}`;
  },

  async getPolicy(): Promise<FirewallPolicy> {
    const res = await fetch(`${API_BASE}/policy`);
    return handleResponse<FirewallPolicy>(res, 'Failed to load policy');
  },

  async updatePolicy(policyData: Partial<FirewallPolicy>, operatorToken: string): Promise<FirewallPolicy> {
    const res = await fetch(`${API_BASE}/policy`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Operator-Token': operatorToken
      },
      body: JSON.stringify(policyData)
    });
    return handleResponse<FirewallPolicy>(res, 'Unauthorized or invalid policy payload');
  },

  async getAccounts(): Promise<AccountInfo[]> {
    const res = await fetch(`${API_BASE}/accounts`);
    return handleResponse<AccountInfo[]>(res, 'Failed to load accounts');
  },

  async getRecipients(): Promise<RecipientInfo[]> {
    const res = await fetch(`${API_BASE}/recipients`);
    return handleResponse<RecipientInfo[]>(res, 'Failed to load recipients');
  },

  async getTransactions(): Promise<MockTransaction[]> {
    const res = await fetch(`${API_BASE}/transactions`);
    return handleResponse<MockTransaction[]>(res, 'Failed to load transactions');
  },

  async seedDemoData(): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/demo/seed`, { method: 'POST' });
    return handleResponse<{ success: boolean; message: string }>(res, 'Failed to reset demo environment');
  },

  async loginGoogle(userData: {
    credential?: string;
    email?: string;
    name?: string;
    picture?: string;
    sub?: string;
    provider?: string;
  }): Promise<{ status: string; user: any }> {
    const res = await fetch(`${API_BASE}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    return handleResponse<{ status: string; user: any }>(res, 'Failed to complete Google login');
  },

  getChatSessionId(): string {
    return activeChatSessionId;
  },

  resetChatSession(): string {
    return resetChatSession();
  },

  async sendChatMessage(params: {
    message: string;
    history?: { role: 'user' | 'assistant'; content: string }[];
    provider_mode?: 'round_robin' | 'gemini' | 'groq' | 'openai';
    session_id?: string;
  }): Promise<import('./types').ChatResponsePayload> {
    const sessionId = params.session_id || activeChatSessionId;
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: params.message,
        history: params.history || [],
        provider_mode: params.provider_mode || 'round_robin',
        session_id: sessionId
      })
    });
    return handleResponse<import('./types').ChatResponsePayload>(res, 'Failed to communicate with AI Copilot');
  },

  async getChatStatus(sessionId?: string): Promise<import('./types').ChatStatusPayload> {
    const sId = sessionId || activeChatSessionId;
    const res = await fetch(`${API_BASE}/chat/status?session_id=${encodeURIComponent(sId)}`);
    return handleResponse<import('./types').ChatStatusPayload>(res, 'Failed to fetch chat status');
  }
};


