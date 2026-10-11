import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Search,
  Filter,
  Download,
  CheckCircle2,
  X
} from 'lucide-react';
import { api } from '../api';
import { AuditLogEntry } from '../types';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [decisionFilter, setDecisionFilter] = useState('ALL');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.getAuditLogs({
      search: appliedSearch || undefined,
      decision: decisionFilter !== 'ALL' ? decisionFilter : undefined,
      risk: riskFilter !== 'ALL' ? riskFilter : undefined,
      limit: 100
    })
      .then((res) => {
        if (active) {
          setLogs(res.logs);
          setTotal(res.total);
        }
      })
      .catch((err) => {
        if (active) console.error(err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [decisionFilter, riskFilter, appliedSearch]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch(searchTerm);
  };

  const downloadJsonExport = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'bankism_audit_trail.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const getDecisionBadge = (decision: string) => {
    switch (decision) {
      case 'APPROVE':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#edf6ef] text-[#2d7a48] border border-[#c7e4cc]">APPROVE</span>;
      case 'BLOCK':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#faecea] text-[#c53b3b] border border-[#f0c3bf]">BLOCK</span>;
      case 'REVIEW':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#fcf3e3] text-[#c27803] border border-[#f3d9ab]">REVIEW</span>;
      default:
        return null;
    }
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'LOW':
        return <span className="text-[10px] font-mono text-[#2d7a48]">LOW</span>;
      case 'MEDIUM':
        return <span className="text-[10px] font-mono text-[#c27803]">MEDIUM</span>;
      case 'HIGH':
        return <span className="text-[10px] font-mono text-[#c53b3b] font-bold">HIGH</span>;
      case 'CRITICAL':
        return <span className="text-[10px] font-mono text-[#c53b3b] font-bold">CRITICAL</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8 py-8 pb-24">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#cbd5e1]/15 pb-5">
        <div>
          <span className="caption-label text-[#9e4c27]">AUDIT TRAIL</span>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0f172a] tracking-tight flex items-center gap-2.5 mt-0.5">
            <FileText className="w-6 h-6 text-[#b45e35]" />
            Audit Trail & Event Ledger
          </h1>
          <p className="text-[#64748b] text-sm mt-1">
            Immutable SQLite audit logs recording every request inspection, detected threat vector, and execution outcome.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={downloadJsonExport}
            className="apple-pressable inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#ffffff] hover:bg-[#f1f5f9] text-[#0f172a] border border-[#cbd5e1]/20 text-xs font-mono shadow-apple-button"
          >
            <Download className="w-3.5 h-3.5 text-[#64748b]" />
            Export JSON
          </button>
          <a
            href={api.downloadAuditCsvUrl({
              search: searchTerm || undefined,
              decision: decisionFilter !== 'ALL' ? decisionFilter : undefined,
              risk: riskFilter !== 'ALL' ? riskFilter : undefined
            })}
            target="_blank"
            rel="noreferrer"
            className="apple-pressable inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#b45e35] hover:bg-[#9e4c27] text-white font-semibold text-xs font-mono shadow-apple-button"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </a>
        </div>
      </div>

      {/* Filter and Search Bar (Warm Cream) */}
      <div className="rounded-3xl apple-glass p-4 flex flex-wrap items-center justify-between gap-4 shadow-apple-card border border-[#cbd5e1]/15">
        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[260px] relative">
          <Search className="w-4 h-4 text-[#64748b] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search prompt, recipient, request ID, or rationale..."
            className="w-full pl-10 pr-4 py-2 rounded-full bg-[#ffffff] border border-[#cbd5e1]/25 text-xs font-mono text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-[#b45e35] shadow-[inset_0_1px_2px_rgba(90,65,45,0.04)]"
          />
        </form>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-mono text-[#64748b]">
            <Filter className="w-3.5 h-3.5 text-[#64748b]" />
            <span>Decision:</span>
            <select
              value={decisionFilter}
              onChange={(e) => setDecisionFilter(e.target.value)}
              className="bg-[#ffffff] border border-[#cbd5e1]/25 rounded-full px-3 py-1 text-xs text-[#0f172a] focus:outline-none focus:border-[#b45e35]"
            >
              <option value="ALL">All</option>
              <option value="APPROVE">Approve</option>
              <option value="BLOCK">Block</option>
              <option value="REVIEW">Review</option>
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-[#64748b]">
            <span>Risk:</span>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="bg-[#ffffff] border border-[#cbd5e1]/25 rounded-full px-3 py-1 text-xs text-[#0f172a] focus:outline-none focus:border-[#b45e35]"
            >
              <option value="ALL">All</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Events Table */}
      <div className="rounded-3xl apple-glass overflow-hidden shadow-apple-elevated border border-[#cbd5e1]/15">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#cbd5e1]/15 bg-[#f5ebd8]/40 text-[#64748b] font-mono">
                <th className="py-3.5 px-4 font-semibold">REQUEST ID</th>
                <th className="py-3.5 px-4 font-semibold">TIMESTAMP</th>
                <th className="py-3.5 px-4 font-semibold">OPERATION</th>
                <th className="py-3.5 px-4 font-semibold">DECISION</th>
                <th className="py-3.5 px-4 font-semibold">RISK</th>
                <th className="py-3.5 px-4 font-semibold">DETAILS</th>
                <th className="py-3.5 px-4 font-semibold">EXECUTED</th>
                <th className="py-3.5 px-4 font-semibold text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#cbd5e1]/10 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#64748b]">
                    <div className="w-6 h-6 border-2 border-[#cbd5e1]/30 border-t-[#b45e35] rounded-full animate-spin mx-auto mb-2" />
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#64748b]">
                    No matching audit records found.
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="hover:bg-[#f5ebd8]/25 transition-colors">
                    <td className="py-3 px-4 font-semibold text-[#9e4c27]">{l.request_id}</td>
                    <td className="py-3 px-4 text-[#64748b] text-[11px]">
                      {new Date(l.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-3 px-4 text-[#0f172a] font-medium">{l.operation}</td>
                    <td className="py-3 px-4">{getDecisionBadge(l.decision)}</td>
                    <td className="py-3 px-4">{getRiskBadge(l.risk_level)}</td>
                    <td className="py-3 px-4 text-[#0f172a] max-w-xs truncate" title={l.raw_input}>
                      {l.recipient ? `${l.recipient} (₹${l.amount || 0})` : l.raw_input}
                    </td>
                    <td className="py-3 px-4">
                      {l.mock_executed ? (
                        <span className="text-[#2d7a48] font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#2d7a48]" /> YES
                        </span>
                      ) : (
                        <span className="text-[#64748b]">NO</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedLog(l)}
                        className="apple-pressable px-3 py-1 rounded-full bg-[#ffffff] hover:bg-[#f1f5f9] text-[#0f172a] text-[11px] border border-[#cbd5e1]/20 shadow-apple-button"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 bg-[#f5ebd8]/20 border-t border-[#cbd5e1]/15 flex items-center justify-between text-xs font-mono text-[#64748b]">
          <span>Showing {logs.length} of {total} total audited events</span>
          <span>Storage: SQLite tamper-logged</span>
        </div>
      </div>

      {/* DETAIL DRAWER / MODAL (Warm Cream Sheet) */}
      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 z-50 bg-[#0f172a]/50 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', damping: 25, stiffness: 320 }}
              className="apple-glass-elevated rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl border border-[#cbd5e1]/25"
            >
              <div className="flex items-center justify-between border-b border-[#cbd5e1]/15 pb-4">
                <div>
                  <span className="caption-label text-[#9e4c27]">AUDIT EVENT INSPECTOR</span>
                  <h3 className="text-lg font-bold text-[#0f172a] mt-0.5">{selectedLog.request_id}</h3>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-1.5 rounded-full hover:bg-[#f5ebd8]/60 text-[#64748b] hover:text-[#0f172a]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3.5 rounded-2xl cream-inset">
                  <span className="text-[#64748b] text-[10px] block">DECISION & RISK</span>
                  <span className="font-bold text-[#0f172a]">{selectedLog.decision} ({selectedLog.risk_level})</span>
                </div>
                <div className="p-3.5 rounded-2xl cream-inset">
                  <span className="text-[#64748b] text-[10px] block">TIMESTAMP</span>
                  <span className="text-[#64748b]">{new Date(selectedLog.timestamp).toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-1.5 font-mono text-xs">
                <span className="text-[#64748b] font-medium">RAW PROMPT:</span>
                <div className="p-3.5 rounded-2xl cream-inset text-[#0f172a] break-words">
                  {selectedLog.raw_input}
                </div>
              </div>

              <div className="space-y-1.5 font-mono text-xs">
                <span className="text-[#9e4c27] font-medium">NORMALIZED TEXT:</span>
                <div className="p-3.5 rounded-2xl bg-[#f1f5f9] border border-[#decab5] text-[#0f172a] break-words">
                  {selectedLog.normalized_input}
                </div>
              </div>

              <div className="space-y-1.5 font-mono text-xs">
                <span className="text-[#64748b] font-medium">RATIONALE:</span>
                <div className="p-3.5 rounded-2xl cream-inset text-[#0f172a]">
                  {selectedLog.rationale}
                </div>
              </div>

              {selectedLog.detected_signals.length > 0 && (
                <div className="space-y-1.5 font-mono text-xs">
                  <span className="text-[#c53b3b] font-medium">DETECTED SIGNALS:</span>
                  <div className="space-y-1">
                    {selectedLog.detected_signals.map((s, i) => (
                      <div key={i} className="p-2.5 rounded-xl bg-[#faecea] text-[#c53b3b] border border-[#f0c3bf]">
                        {s}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedLog.validation_errors.length > 0 && (
                <div className="space-y-1.5 font-mono text-xs">
                  <span className="text-[#c27803] font-medium">VALIDATION ERRORS:</span>
                  <div className="space-y-1">
                    {selectedLog.validation_errors.map((e, i) => (
                      <div key={i} className="p-2.5 rounded-xl bg-[#fcf3e3] text-[#c27803] border border-[#f3d9ab]">
                        {e}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-[#cbd5e1]/15">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="apple-pressable px-5 py-2 rounded-full bg-[#0f172a] hover:bg-[#1e293b] text-xs font-mono text-[#ffffff] shadow-apple-button"
                >
                  Close Inspector
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
