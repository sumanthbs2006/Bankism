import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Send,
  User,
  Copy,
  Check,
  ShieldCheck,
  Zap,
  CheckCircle2
} from 'lucide-react';
import { api } from '../api';
import { ChatMessage } from '../types';

export const AiChatPage: React.FC = () => {
  const [activeProvider, setActiveProvider] = useState<'gemini' | 'groq' | 'openai'>('gemini');
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'init-1',
      role: 'assistant',
      content: 'Welcome to Bankism! How may I assist you with your accounts or transfers today?',
      provider_used: 'Bankism Assistant',
      provider_id: 'gemini',
      timestamp: new Date().toISOString()
    }
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    api.getChatStatus().then((status) => {
      if (status.active_session_provider) {
        setActiveProvider(status.active_session_provider);
        setMessages((prev) =>
          prev.map((m, idx) => (idx === 0 && m.id === 'init-1' ? { ...m, provider_id: status.active_session_provider } : m))
        );
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    setInput('');
    const userMsgId = `usr_${Date.now()}`;
    const newMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: query,
      timestamp: new Date().toISOString()
    };

    setMessages((prev) => [...prev, newMsg]);
    setLoading(true);

    try {
      const historyPayload = messages
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await api.sendChatMessage({
        message: query,
        history: historyPayload,
        provider_mode: 'round_robin'
      });

      if (res.provider_id) {
        setActiveProvider(res.provider_id);
      }

      const assistantMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: res.response,
        provider_used: 'Bankism Assistant',
        provider_id: res.provider_id,
        turn_number: res.turn_number,
        timestamp: res.timestamp
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: `Notice: ${err.message || 'Unable to connect to support right now'}. Deterministic firewall is protecting all ledger transactions.`,
        provider_used: 'Bankism Assistant',
        provider_id: activeProvider,
        timestamp: new Date().toISOString()
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const promptSuggestions = [
    "What is my current account balance?",
    "What are the rules and caps for single and daily transfers?",
    "Explain how Bankism stops unauthorized transfers",
    "How do transaction security guardrails work?"
  ];

  const getProviderBadge = (m?: ChatMessage) => {
    const provId = m?.provider_id || activeProvider;
    let name = 'Google Gemini 2.5 Flash';
    let colorClass = 'bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]';

    if (provId === 'gemini') {
      name = 'Google Gemini 2.5 Flash';
      colorClass = 'bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]';
    } else if (provId === 'groq') {
      name = 'Groq LLaMA 3.3 70B';
      colorClass = 'bg-[#fff7ed] text-[#c2410c] border-[#fed7aa]';
    } else if (provId === 'openai') {
      name = 'OpenAI ChatGPT (GPT-4o)';
      colorClass = 'bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0]';
    }

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${colorClass}`}>
        <Sparkles className="w-3 h-3" />
        {name}
      </span>
    );
  };

  return (
    <div className="space-y-6 py-6 pb-24">
      {/* 1. Header & Status HUD */}
      <section className="relative overflow-hidden rounded-3xl apple-glass p-6 sm:p-8 border border-[#cbd5e1]/20 shadow-apple-elevated space-y-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-[#cbd5e1]/15 pb-5">
          <div className="space-y-1">
            <span className="caption-label text-[#9e4c27]">INTELLIGENT BANKING ASSISTANT</span>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0f172a] tracking-tight flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#0f172a] text-white flex items-center justify-center shadow-sm">
                <Sparkles className="w-5 h-5 text-[#f5bd47]" />
              </div>
              <span>Bankism AI Copilot</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#64748b] leading-relaxed">
              Ask anything about account balances, transfer limits, or banking guardrails. Instant and secure answers around the clock.
            </p>
          </div>

          {/* Online Status Pill */}
          <div className="flex items-center gap-2 bg-[#edf6ef] text-[#2d7a48] border border-[#c7e4cc] px-3.5 py-2 rounded-2xl text-xs font-semibold shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#2d7a48] animate-pulse" />
            <span>Assistant Online • Guardrails Active</span>
          </div>
        </div>

        {/* Active Session Engine Banner (Session-Based Round Robin) */}
        <div className="p-3.5 rounded-2xl bg-white/80 border border-[#cbd5e1]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[10px] font-mono uppercase font-bold text-[#64748b]">Active Session Engine:</span>
            {getProviderBadge()}
            <span className="text-[11px] text-[#64748b] hidden sm:inline">• Answers all questions in this session</span>
          </div>
          <div className="text-[11px] font-mono text-[#475569] bg-[#f1f5f9] px-3 py-1 rounded-full border border-[#cbd5e1]/50 flex items-center gap-1.5 self-start sm:self-auto">
            <span>🔄 Round-Robin by Session (Cycles Gemini → Groq → ChatGPT on refresh / logout)</span>
          </div>
        </div>

        {/* Status Bento Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* Account Status */}
          <div className="p-4 rounded-2xl border bg-white/90 border-[#cbd5e1]/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#0f172a] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#2d7a48]" />
                Primary Account
              </span>
              <span className="w-2 h-2 rounded-full bg-[#2d7a48]" />
            </div>
            <p className="text-[11px] font-mono text-[#64748b] mt-1">CHK-9021 (Synced)</p>
            <div className="flex items-center justify-between text-[10px] text-[#64748b] mt-2 pt-2 border-t border-[#cbd5e1]/40">
              <span>Current Balance:</span>
              <strong className="font-mono text-[#0f172a]">₹1,195,200.00</strong>
            </div>
          </div>

          {/* Transfer Limits */}
          <div className="p-4 rounded-2xl border bg-white/90 border-[#cbd5e1]/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#0f172a] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#2563eb]" />
                Transfer Guardrails
              </span>
              <span className="w-2 h-2 rounded-full bg-[#2563eb]" />
            </div>
            <p className="text-[11px] font-mono text-[#64748b] mt-1">Policy Constraints Active</p>
            <div className="flex items-center justify-between text-[10px] text-[#64748b] mt-2 pt-2 border-t border-[#cbd5e1]/40">
              <span>Single / Daily Cap:</span>
              <strong className="font-mono text-[#0f172a]">₹240,000 / ₹480,000</strong>
            </div>
          </div>

          {/* System Defense */}
          <div className="p-4 rounded-2xl border bg-white/90 border-[#cbd5e1]/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#0f172a] flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-[#2c6590]" />
                Security Gateway
              </span>
              <span className="text-[10px] font-mono text-[#2c6590] bg-[#eef4ff] px-1.5 py-0.5 rounded-full border border-[#bfd8f5]">
                ENFORCED
              </span>
            </div>
            <p className="text-[11px] font-mono text-[#64748b] mt-1">Full Heuristic Defense</p>
            <div className="flex items-center justify-between text-[10px] text-[#64748b] mt-2 pt-2 border-t border-[#cbd5e1]/40">
              <span>Protection Status:</span>
              <strong className="font-mono text-[#0f172a]">100% Protected</strong>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Chat Conversation Feed */}
      <section className="rounded-3xl apple-glass border border-[#cbd5e1] shadow-apple-card flex flex-col h-[540px] sm:h-[620px] overflow-hidden">
        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {/* Assistant Avatar */}
                {m.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl bg-[#0f172a] text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                    <Sparkles className="w-4 h-4 text-[#f5bd47]" />
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-[#0f172a] text-white rounded-tr-sm shadow-md'
                      : 'bg-white text-[#0f172a] rounded-tl-sm border border-[#cbd5e1]/60 shadow-sm'
                  }`}
                >
                  {/* Assistant Meta Header */}
                  {m.role === 'assistant' && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2 border-b border-[#cbd5e1]/50 text-[11px]">
                      <div className="flex items-center gap-2">
                        {getProviderBadge(m)}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => copyToClipboard(m.content, m.id)}
                          className="p-1 rounded-md text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] transition-colors"
                          title="Copy message"
                        >
                          {copiedId === m.id ? (
                            <Check className="w-3.5 h-3.5 text-[#2d7a48]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Formatted Content */}
                  <div className="whitespace-pre-wrap font-sans text-xs sm:text-sm">
                    {m.content}
                  </div>

                  {/* Timestamp */}
                  <div className={`text-[10px] text-right mt-1.5 ${
                    m.role === 'user' ? 'text-white/60' : 'text-[#64748b]'
                  }`}>
                    {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                {/* User Avatar */}
                {m.role === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-[#dde5ed] text-[#0f172a] border border-[#cbd5e1] flex items-center justify-center shrink-0 shadow-sm mt-0.5 font-bold text-xs">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Loading Indicator */}
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3"
            >
              <div className="w-8 h-8 rounded-xl bg-[#0f172a] text-white flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-[#f5bd47] animate-spin" />
              </div>
              <div className="bg-white p-3 rounded-2xl border border-[#cbd5e1]/60 shadow-sm text-xs font-mono text-[#64748b] flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb] animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb] animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb] animate-bounce [animation-delay:0.4s]" />
                </div>
                <span>Thinking...</span>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 3. Input & Interactive Controls */}
        <div className="p-4 sm:p-5 bg-[#f1f5f9]/90 border-t border-[#cbd5e1]/60 space-y-3">
          {/* Quick Prompt Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
            <span className="text-[10px] font-mono text-[#64748b] uppercase whitespace-nowrap shrink-0">
              Suggestions:
            </span>
            {promptSuggestions.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(prompt)}
                disabled={loading}
                className="apple-pressable px-3 py-1 rounded-full bg-white hover:bg-[#f1f5f9] text-[#0f172a] text-[11px] whitespace-nowrap border border-[#cbd5e1]/60 shadow-apple-button shrink-0"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask Bankism AI about security guardrails, transfer limits, or balances..."
                rows={1}
                disabled={loading}
                className="w-full px-4 py-3 rounded-2xl bg-white border border-[#cbd5e1] text-xs sm:text-sm text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb] transition-all resize-none shadow-inner"
              />
            </div>

            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="apple-pressable px-5 py-3 rounded-2xl bg-[#0f172a] hover:bg-[#1e293b] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-xs tracking-tight shadow-apple-button flex items-center justify-center gap-2 shrink-0"
            >
              <span>Send</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#64748b] pt-1">
            <span>Press <kbd className="px-1.5 py-0.5 rounded bg-[#dde5ed] font-mono text-[10px]">Enter</kbd> to send, <kbd className="px-1.5 py-0.5 rounded bg-[#dde5ed] font-mono text-[10px]">Shift+Enter</kbd> for newline</span>
            <button
              onClick={() => {
                setMessages([
                  {
                    id: `rst_${Date.now()}`,
                    role: 'assistant',
                    content: 'Welcome to Bankism! How may I assist you?',
                    provider_used: 'Bankism Assistant',
                    provider_id: 'gemini',
                    timestamp: new Date().toISOString()
                  }
                ]);
              }}
              className="hover:text-[#0f172a] underline underline-offset-2 transition-colors"
            >
              Clear Chat History
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
