import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Shield,
  Key,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Save,
  Plus,
  Trash2,
  Lock,
  Layers
} from 'lucide-react';
import { api } from '../api';
import { FirewallPolicy } from '../types';

export const SettingsPage: React.FC = () => {
  const [policy, setPolicy] = useState<FirewallPolicy | null>(null);
  const [operatorToken, setOperatorToken] = useState('demo-operator-token-2026');
  const [newRecipientInput, setNewRecipientInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    fetchPolicy();
  }, []);

  const fetchPolicy = async () => {
    try {
      const p = await api.getPolicy();
      setPolicy(p);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to fetch policy.');
    }
  };

  const handleAddRecipient = () => {
    if (!newRecipientInput.trim() || !policy) return;
    const name = newRecipientInput.trim();
    if (!policy.approved_recipients.includes(name)) {
      setPolicy({
        ...policy,
        approved_recipients: [...policy.approved_recipients, name]
      });
    }
    setNewRecipientInput('');
  };

  const handleRemoveRecipient = (name: string) => {
    if (!policy) return;
    setPolicy({
      ...policy,
      approved_recipients: policy.approved_recipients.filter((r) => r !== name)
    });
  };

  const handleSave = async () => {
    if (!policy) return;
    setSaving(true);
    setSaveSuccess(null);
    setSaveError(null);

    try {
      const updated = await api.updatePolicy(
        {
          max_single_transfer: policy.max_single_transfer,
          daily_transfer_limit: policy.daily_transfer_limit,
          approved_recipients: policy.approved_recipients,
          unknown_recipient_action: policy.unknown_recipient_action,
          block_high_risk: policy.block_high_risk,
          require_explicit_confirmation: policy.require_explicit_confirmation,
          max_input_length: policy.max_input_length,
          strict_homoglyph_filtering: policy.strict_homoglyph_filtering
        },
        operatorToken
      );
      setPolicy(updated);
      setSaveSuccess(`Policy updated to ${updated.version}`);
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err: any) {
      setSaveError(err.message || 'Policy update failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefaults = () => {
    if (!policy) return;
    setPolicy({
      ...policy,
      max_single_transfer: 2500.0,
      daily_transfer_limit: 5000.0,
      approved_recipients: ['Rahul', 'Priya', 'Maya', 'Vikram'],
      unknown_recipient_action: 'BLOCK',
      block_high_risk: true,
      require_explicit_confirmation: true,
      max_input_length: 800,
      strict_homoglyph_filtering: true
    });
  };

  if (!policy) {
    return (
      <div className="py-24 text-center space-y-4">
        <div className="w-7 h-7 border-2 border-[#cbd5e1]/30 border-t-[#b45e35] rounded-full animate-spin mx-auto" />
        <p className="text-xs font-mono text-[#64748b]">Loading Policy...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 py-8 pb-24">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#cbd5e1]/15 pb-5">
        <div>
          <span className="caption-label text-[#9e4c27]">GOVERNANCE & POLICY</span>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0f172a] tracking-tight flex items-center gap-2.5 mt-0.5">
            <Sliders className="w-6 h-6 text-[#b45e35]" />
            Policy & Security Governance
          </h1>
          <p className="text-[#64748b] text-sm mt-1">
            Configure financial guardrails, counterparties allowlists, input bounds, and operator access controls.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-3.5 py-1 rounded-full bg-[#ffffff] border border-[#cbd5e1]/20 text-[#64748b] shadow-apple-button">
            Version: <strong className="text-[#0f172a]">{policy.version}</strong>
          </span>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-[#edf6ef] border border-[#c7e4cc] text-[#2d7a48] text-xs flex items-center gap-2 animate-fadeIn font-mono">
          <CheckCircle2 className="w-4 h-4 text-[#2d7a48]" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {saveError && (
        <div className="p-4 rounded-2xl bg-[#faecea] border border-[#f0c3bf] text-[#c53b3b] text-xs flex items-center gap-2 animate-fadeIn font-mono">
          <AlertTriangle className="w-4 h-4 text-[#c53b3b]" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Core Policy Settings Bento */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Financial Limits */}
        <div className="rounded-3xl apple-glass p-6 sm:p-7 space-y-5 shadow-apple-card border border-[#cbd5e1]/15">
          <h3 className="text-sm font-semibold text-[#0f172a] flex items-center gap-2 border-b border-[#cbd5e1]/15 pb-3">
            <Shield className="w-4 h-4 text-[#2d7a48]" />
            Financial Velocity Limits
          </h3>

          <div className="space-y-4 text-xs font-mono">
            <div className="space-y-1.5">
              <label className="text-[#0f172a] font-semibold">Max Single Transfer Limit (₹ INR)</label>
              <input
                type="number"
                value={policy.max_single_transfer}
                onChange={(e) =>
                  setPolicy({ ...policy, max_single_transfer: parseFloat(e.target.value) || 0 })
                }
                className="w-full rounded-2xl bg-[#ffffff] border border-[#cbd5e1]/25 px-4 py-2.5 text-sm text-[#0f172a] focus:outline-none focus:border-[#b45e35] shadow-[inset_0_1px_2px_rgba(90,65,45,0.04)]"
              />
              <span className="text-[11px] text-[#64748b] block">Transfers exceeding this ceiling are unconditionally blocked.</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-[#0f172a] font-semibold">Daily Cumulative Limit (₹ INR)</label>
              <input
                type="number"
                value={policy.daily_transfer_limit}
                onChange={(e) =>
                  setPolicy({ ...policy, daily_transfer_limit: parseFloat(e.target.value) || 0 })
                }
                className="w-full rounded-2xl bg-[#ffffff] border border-[#cbd5e1]/25 px-4 py-2.5 text-sm text-[#0f172a] focus:outline-none focus:border-[#b45e35] shadow-[inset_0_1px_2px_rgba(90,65,45,0.04)]"
              />
              <span className="text-[11px] text-[#64748b] block">Aggregated daily transfers cannot exceed this ceiling.</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-[#0f172a] font-semibold">Max Input Text Length (characters)</label>
              <input
                type="number"
                value={policy.max_input_length}
                onChange={(e) =>
                  setPolicy({ ...policy, max_input_length: parseInt(e.target.value) || 800 })
                }
                className="w-full rounded-2xl bg-[#ffffff] border border-[#cbd5e1]/25 px-4 py-2.5 text-sm text-[#0f172a] focus:outline-none focus:border-[#b45e35] shadow-[inset_0_1px_2px_rgba(90,65,45,0.04)]"
              />
              <span className="text-[11px] text-[#64748b] block">Buffer overflow & prompt stuffing protection bounds.</span>
            </div>
          </div>
        </div>

        {/* Counterparty Allowlist */}
        <div className="rounded-3xl apple-glass p-6 sm:p-7 space-y-5 shadow-apple-card border border-[#cbd5e1]/15">
          <h3 className="text-sm font-semibold text-[#0f172a] flex items-center gap-2 border-b border-[#cbd5e1]/15 pb-3">
            <Lock className="w-4 h-4 text-[#b45e35]" />
            Approved Recipient Allowlist
          </h3>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newRecipientInput}
                onChange={(e) => setNewRecipientInput(e.target.value)}
                placeholder="Add counterparty name..."
                className="flex-1 rounded-full bg-[#ffffff] border border-[#cbd5e1]/25 px-4 py-2 text-xs font-mono text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-[#b45e35] shadow-[inset_0_1px_2px_rgba(90,65,45,0.04)]"
              />
              <button
                onClick={handleAddRecipient}
                className="apple-pressable px-4 py-2 rounded-full bg-[#b45e35] hover:bg-[#9e4c27] text-white font-semibold text-xs transition-colors flex items-center gap-1 shadow-apple-button"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {policy.approved_recipients.map((rec) => (
                <span
                  key={rec}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ffffff] border border-[#cbd5e1]/20 text-xs font-mono text-[#0f172a] shadow-apple-button"
                >
                  <span>{rec}</span>
                  <button
                    onClick={() => handleRemoveRecipient(rec)}
                    className="text-[#64748b] hover:text-[#c53b3b] transition-colors"
                    title={`Remove ${rec}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            <div className="pt-2 space-y-2 border-t border-[#cbd5e1]/15 text-xs font-mono">
              <label className="text-[#0f172a] font-semibold block">Unapproved Counterparty Policy:</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-[#0f172a]">
                  <input
                    type="radio"
                    name="unknown_action"
                    value="BLOCK"
                    checked={policy.unknown_recipient_action === 'BLOCK'}
                    onChange={() => setPolicy({ ...policy, unknown_recipient_action: 'BLOCK' })}
                    className="text-[#b45e35]"
                  />
                  <span>BLOCK (Strictest)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-[#0f172a]">
                  <input
                    type="radio"
                    name="unknown_action"
                    value="REVIEW"
                    checked={policy.unknown_recipient_action === 'REVIEW'}
                    onChange={() => setPolicy({ ...policy, unknown_recipient_action: 'REVIEW' })}
                    className="text-[#b45e35]"
                  />
                  <span>REVIEW (Operator Approval)</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Defensive Toggles (Apple Settings Group) */}
      <div className="rounded-3xl apple-glass p-6 sm:p-7 space-y-4 shadow-apple-card border border-[#cbd5e1]/15">
        <h3 className="text-sm font-semibold text-[#0f172a] flex items-center gap-2 border-b border-[#cbd5e1]/15 pb-3">
          <Layers className="w-4 h-4 text-[#b45e35]" />
          Defensive Toggles & Guardrail Integrity
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
          <label className="p-4 rounded-2xl bg-[#ffffff] border border-[#cbd5e1]/15 flex items-start gap-3 cursor-pointer apple-pressable shadow-apple-card">
            <input
              type="checkbox"
              checked={policy.block_high_risk}
              onChange={(e) => setPolicy({ ...policy, block_high_risk: e.target.checked })}
              className="mt-0.5 rounded border-[#cbd5e1]/30 text-[#b45e35] focus:ring-[#b45e35]"
            />
            <div>
              <span className="font-semibold text-[#0f172a] block">Block High-Risk Signals</span>
              <span className="text-[11px] text-[#64748b]">Prompt injections immediately return BLOCK verdict.</span>
            </div>
          </label>

          <label className="p-4 rounded-2xl bg-[#ffffff] border border-[#cbd5e1]/15 flex items-start gap-3 cursor-pointer apple-pressable shadow-apple-card">
            <input
              type="checkbox"
              checked={policy.require_explicit_confirmation}
              onChange={(e) => setPolicy({ ...policy, require_explicit_confirmation: e.target.checked })}
              className="mt-0.5 rounded border-[#cbd5e1]/30 text-[#b45e35] focus:ring-[#b45e35]"
            />
            <div>
              <span className="font-semibold text-[#0f172a] block">Require Confirmation</span>
              <span className="text-[11px] text-[#64748b]">All transfers require human confirmation before execution.</span>
            </div>
          </label>

          <label className="p-4 rounded-2xl bg-[#ffffff] border border-[#cbd5e1]/15 flex items-start gap-3 cursor-pointer apple-pressable shadow-apple-card">
            <input
              type="checkbox"
              checked={policy.strict_homoglyph_filtering}
              onChange={(e) => setPolicy({ ...policy, strict_homoglyph_filtering: e.target.checked })}
              className="mt-0.5 rounded border-[#cbd5e1]/30 text-[#b45e35] focus:ring-[#b45e35]"
            />
            <div>
              <span className="font-semibold text-[#0f172a] block">Homoglyph Filtering</span>
              <span className="text-[11px] text-[#64748b]">Maps Cyrillic/Greek lookalikes back to ASCII.</span>
            </div>
          </label>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#cbd5e1]/15">
        <button
          onClick={handleResetToDefaults}
          className="apple-pressable px-4 py-2.5 rounded-full bg-[#ffffff] hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#0f172a] text-xs font-mono border border-[#cbd5e1]/20 flex items-center gap-2 shadow-apple-button"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset to Defaults
        </button>

        <button
          onClick={handleSave}
          disabled={saving}
          className="apple-pressable px-6 py-2.5 rounded-full bg-[#b45e35] hover:bg-[#9e4c27] text-white font-semibold text-xs shadow-apple-button flex items-center gap-2"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? 'Saving...' : 'Save Policy Changes'}
        </button>
      </div>
    </div>
  );
};
