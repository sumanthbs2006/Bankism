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

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') || '/api';

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
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to inspect request' }));
      throw new Error(err.detail || 'Inspection failed');
    }
    return res.json();
  },

  async explainRequest(message: string, providerMode = 'round_robin'): Promise<AIExplainability> {
    const res = await fetch(`${API_BASE}/firewall/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, provider_mode: providerMode })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to generate AI explainability' }));
      throw new Error(err.detail || 'AI Explainability request failed');
    }
    return res.json();
  },

  async executeRequest(requestId: string, confirmation: boolean, sessionId = 'demo-session-1'): Promise<ExecuteResponse> {
    const res = await fetch(`${API_BASE}/firewall/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_id: requestId, confirmation, session_id: sessionId })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Execution rejected' }));
      throw new Error(err.detail || 'Execution rejected by Authorization Gate');
    }
    return res.json();
  },

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const res = await fetch(`${API_BASE}/dashboard/metrics`);
    if (!res.ok) throw new Error('Failed to load metrics');
    return res.json();
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
    if (!res.ok) throw new Error('Failed to load audit logs');
    return res.json();
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
    if (!res.ok) throw new Error('Failed to load policy');
    return res.json();
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
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Policy update failed' }));
      throw new Error(err.detail || 'Unauthorized or invalid policy payload');
    }
    return res.json();
  },

  async getAccounts(): Promise<AccountInfo[]> {
    const res = await fetch(`${API_BASE}/accounts`);
    if (!res.ok) throw new Error('Failed to load accounts');
    return res.json();
  },

  async getRecipients(): Promise<RecipientInfo[]> {
    const res = await fetch(`${API_BASE}/recipients`);
    if (!res.ok) throw new Error('Failed to load recipients');
    return res.json();
  },

  async getTransactions(): Promise<MockTransaction[]> {
    const res = await fetch(`${API_BASE}/transactions`);
    if (!res.ok) throw new Error('Failed to load transactions');
    return res.json();
  },

  async seedDemoData(): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/demo/seed`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to reset demo environment');
    return res.json();
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
    if (!res.ok) throw new Error('Failed to complete Google login');
    return res.json();
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
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to communicate with AI Copilot' }));
      throw new Error(err.detail || 'AI Copilot communication failed');
    }
    return res.json();
  },

  async getChatStatus(sessionId?: string): Promise<import('./types').ChatStatusPayload> {
    const sId = sessionId || activeChatSessionId;
    const res = await fetch(`${API_BASE}/chat/status?session_id=${encodeURIComponent(sId)}`);
    if (!res.ok) throw new Error('Failed to fetch chat status');
    return res.json();
  }
};


