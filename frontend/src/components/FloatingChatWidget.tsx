import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  X,
  Send,
  Bot,
  Zap,
  Maximize2,
  Minimize2,
  Trash2
} from 'lucide-react';
import { api } from '../api';
import { ChatMessage } from '../types';

interface FloatingChatWidgetProps {
  onOpenFullPage?: () => void;
}

export const FloatingChatWidget: React.FC<FloatingChatWidgetProps> = ({ onOpenFullPage }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'fw-1',
      role: 'assistant',
      content: 'Welcome to Bankism! How may I assist you?',
      provider_used: 'Bankism Assistant',
      provider_id: 'gemini',
      timestamp: new Date().toISOString()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, loading]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const historyPayload = messages.slice(-4).map((m) => ({ role: m.role, content: m.content }));
      const res = await api.sendChatMessage({
        message: text,
        history: historyPayload,
        provider_mode: 'round_robin'
      });

      const aiMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: res.response,
        provider_used: 'Bankism Assistant',
        provider_id: res.provider_id,
        model_name: res.model_name,
        turn_number: res.turn_number,
        fallback_triggered: res.fallback_triggered,
        timestamp: res.timestamp
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: `Error: ${err.message || 'Service temporarily unavailable'}.`,
        provider_used: 'Bankism Assistant',
        provider_id: 'gemini',
        timestamp: new Date().toISOString()
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Trigger Pill in bottom-right corner */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 apple-pressable flex items-center gap-2.5 px-4 py-3 rounded-full bg-[#0f172a] text-white shadow-2xl border border-white/20 hover:scale-105 transition-all group"
          title="Open Bankism Assistant"
        >
          <div className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center text-[#f5bd47]">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-semibold tracking-tight">AI Copilot</span>
        </button>
      )}

      {/* Floating Chat Modal / Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed bottom-6 right-6 z-50 w-[92vw] sm:w-[420px] h-[550px] rounded-3xl apple-glass-elevated border border-[#cbd5e1] shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 bg-[#dde5ed]/90 border-b border-[#cbd5e1]/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#0f172a] text-white flex items-center justify-center shadow-sm">
                  <Sparkles className="w-3.5 h-3.5 text-[#f5bd47]" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#0f172a]">Bankism Assistant</h3>
                  <p className="text-[10px] text-[#64748b]">Always online • Instant assistance</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {onOpenFullPage && (
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      onOpenFullPage();
                    }}
                    className="p-1.5 rounded-lg text-[#64748b] hover:text-[#0f172a] hover:bg-black/5"
                    title="Open Full Page"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-[#64748b] hover:text-[#0f172a] hover:bg-black/5"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f8fafc]/80">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  {m.role === 'assistant' && (
                    <span className="text-[9px] font-semibold text-[#64748b] mb-0.5 ml-1 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5 text-[#f5bd47]" />
                      Bankism Assistant
                    </span>
                  )}
                  <div
                    className={`max-w-[88%] p-3 rounded-2xl text-xs leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-[#0f172a] text-white rounded-tr-sm shadow-md'
                        : 'bg-white text-[#0f172a] rounded-tl-sm border border-[#cbd5e1]/60 shadow-sm'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-2 text-[11px] font-mono text-[#64748b] p-2 bg-white/70 rounded-xl border border-[#cbd5e1]/50">
                  <Sparkles className="w-3 h-3 text-[#f5bd47] animate-spin" />
                  <span>Thinking...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Footer Input */}
            <div className="p-3 bg-[#dde5ed]/90 border-t border-[#cbd5e1]/60 flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask about security, transfers..."
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-white text-xs text-[#0f172a] placeholder-[#94a3b8] border border-[#cbd5e1] focus:outline-none focus:border-[#2563eb]"
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="p-2.5 rounded-xl bg-[#0f172a] text-white disabled:opacity-40 hover:bg-[#1e293b] transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
