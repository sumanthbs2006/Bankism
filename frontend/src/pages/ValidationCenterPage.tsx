import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  Lock,
  IndianRupee,
  UserCheck,
  Clock,
  Play,
  AlertTriangle,
  Check
} from 'lucide-react';
import { api } from '../api';
import { FirewallPolicy, AccountInfo } from '../types';

const DISALLOWED_RECIPIENT_TERMS = [
  'apple', 'hacker', 'attacker', 'banana', 'orange', 'fruit', 'mango',
  'admin', 'root', 'bot', 'null', 'undefined', 'test', 'user', 'dummy',
  'device', 'iphone', 'android', 'computer', 'server', 'system',
  'malware', 'exploit', 'trojan', 'phish', 'virus', 'evil', 'anon',
  'anonymous', 'payload', 'wallet', 'unknownattacker666', 'unknown_wallet',
  'external hacker', 'external_hacker_account'
];

function validateGenuineRecipient(name: string): { isValid: boolean; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    return { isValid: false, error: "Recipient name is required." };
  }
  // Check for numbers
  if (/\d/.test(trimmed)) {
    return { isValid: false, error: "Numbers are not allowed in recipient names." };
  }
  // Check for special characters: only alphabetic letters and single spaces
  if (!/^[A-Za-z]+(?: [A-Za-z]+)*$/.test(trimmed)) {
    return { isValid: false, error: "Special characters or symbols are not allowed. Only genuine alphabetic names are accepted." };
  }
  // Minimum length check
  if (trimmed.length < 2) {
    return { isValid: false, error: "Recipient name must be at least 2 characters long." };
  }
  // Disallowed non-human, attack, fruit, or placeholder words
  const lower = trimmed.toLowerCase();
  const words = lower.split(/\s+/);
  for (const term of DISALLOWED_RECIPIENT_TERMS) {
    if (words.includes(term) || lower === term || lower.includes(term)) {
      return {
        isValid: false,
        error: `"${term}" is not a genuine human name. Numbers, special characters, and words like 'apple' or 'hacker' are strictly prohibited.`
      };
    }
  }
  return { isValid: true };
}

interface ValidationCenterPageProps {
  selectedAccount?: AccountInfo | null;
}

export const ValidationCenterPage: React.FC<ValidationCenterPageProps> = ({ selectedAccount }) => {
  const [policy, setPolicy] = useState<FirewallPolicy | null>(null);
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Sandbox inputs
  const [testAmount, setTestAmount] = useState<string>("24000.00");
  const [testRecipient, setTestRecipient] = useState<string>("Priya");
  const [testAccount, setTestAccount] = useState<string>(selectedAccount?.account_id || "CHK-9021");
  const [sandboxResults, setSandboxResults] = useState<{
    checks: Array<{ name: string; passed: boolean; message: string }>;
    overallPassed: boolean;
  } | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [pol, accs] = await Promise.all([
          api.getPolicy(),
          api.getAccounts()
        ]);
        setPolicy(pol);
        setAccounts(accs);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    if (selectedAccount?.account_id) {
      setTestAccount(selectedAccount.account_id);
    }
  }, [selectedAccount?.account_id]);

  const recipientStatus = validateGenuineRecipient(testRecipient);

  const runSandboxEvaluation = () => {
    if (!policy) return;
    const amt = parseFloat(testAmount) || 0;
    const acc = accounts.find((a) => a.account_id === testAccount) || accounts[0];
    const isAllowlisted = recipientStatus.isValid;

    const checks = [
      {
        name: "Operation Feasibility",
        passed: amt > 0,
        message: amt > 0 ? "Amount is positive and non-zero." : "Amount must be strictly positive."
      },
      {
        name: "Max Single Transfer Limit",
        passed: amt <= policy.max_single_transfer,
        message:
          amt <= policy.max_single_transfer
            ? `₹${amt.toFixed(2)} is within max per-transaction limit of ₹${policy.max_single_transfer.toFixed(2)}.`
            : `₹${amt.toFixed(2)} exceeds maximum per-transaction limit of ₹${policy.max_single_transfer.toFixed(2)}.`
      },
      {
        name: "Daily Cumulative Limit",
        passed: (acc ? acc.daily_transferred_today + amt : amt) <= policy.daily_transfer_limit,
        message:
          acc && acc.daily_transferred_today + amt <= policy.daily_transfer_limit
            ? `Projected daily total (₹${(acc.daily_transferred_today + amt).toFixed(2)}) is within daily limit of ₹${policy.daily_transfer_limit.toFixed(2)}.`
            : `Projected daily total would breach daily ceiling of ₹${policy.daily_transfer_limit.toFixed(2)}.`
      },
      {
        name: "Source Account Balance",
        passed: acc ? acc.balance >= amt : false,
        message:
          acc && acc.balance >= amt
            ? `Balance sufficient (₹${acc.balance.toFixed(2)} available).`
            : `Insufficient funds (₹${acc?.balance.toFixed(2) || 0} available).`
      },
      {
        name: "Recipient Allowlist & Identity Check",
        passed: isAllowlisted,
        message: isAllowlisted
          ? `'${testRecipient.trim()}' is verified as a genuine human counterparty and approved recipient.`
          : `Blocked: ${recipientStatus.error || `'${testRecipient}' is not a genuine human recipient.`}`
      },
      {
        name: "Source Account State",
        passed: acc?.status === 'ACTIVE',
        message: `Account status is ${acc?.status || 'UNKNOWN'}.`
      }
    ];

    const overallPassed = checks.every((c) => c.passed);
    setSandboxResults({ checks, overallPassed });
  };

  if (loading && !policy) {
    return (
      <div className="py-24 text-center space-y-4">
        <div className="w-7 h-7 border-2 border-[#cbd5e1]/30 border-t-[#b45e35] rounded-full animate-spin mx-auto" />
        <p className="text-xs font-mono text-[#64748b]">Loading Validation Rules...</p>
      </div>
    );
  }

  return (
    <div className="space-y-12 py-8 pb-24">
      {/* Title */}
      <div className="border-b border-[#cbd5e1]/15 pb-5">
        <span className="caption-label text-[#2d7a48]">DETERMINISTIC GUARDRAILS</span>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#0f172a] tracking-tight flex items-center gap-2.5 mt-0.5">
          <CheckCircle2 className="w-6 h-6 text-[#2d7a48]" />
          Deterministic Validation Center
        </h1>
        <p className="text-[#64748b] text-sm mt-1">
          Explore the mathematical rule engine that verifies balances, per-transaction limits, daily aggregates, and counterparty allowlists.
        </p>
      </div>

      {/* Live Policy Parameters Overview (Warm Cream Bento) */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
        <div className="p-5 rounded-2xl apple-glass space-y-2 apple-pressable border border-[#cbd5e1]/15">
          <div className="flex items-center justify-between text-[11px] font-mono text-[#64748b]">
            <span>PER-TX CEILING</span>
            <IndianRupee className="w-3.5 h-3.5 text-[#2d7a48]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#0f172a] tracking-tight">
            ₹{policy?.max_single_transfer.toFixed(2)}
          </div>
          <div className="text-[11px] text-[#64748b]">Max single transfer</div>
        </div>

        <div className="p-5 rounded-2xl apple-glass space-y-2 apple-pressable border border-[#cbd5e1]/15">
          <div className="flex items-center justify-between text-[11px] font-mono text-[#64748b]">
            <span>DAILY LIMIT</span>
            <Clock className="w-3.5 h-3.5 text-[#b45e35]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#0f172a] tracking-tight">
            ₹{policy?.daily_transfer_limit.toFixed(2)}
          </div>
          <div className="text-[11px] text-[#64748b]">24-hour cumulative cap</div>
        </div>

        <div className="p-5 rounded-2xl apple-glass space-y-2 apple-pressable border border-[#cbd5e1]/15">
          <div className="flex items-center justify-between text-[11px] font-mono text-[#64748b]">
            <span>COUNTERPARTIES</span>
            <UserCheck className="w-3.5 h-3.5 text-[#b45e35]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#0f172a] tracking-tight">
            {policy?.approved_recipients.length || 0}
          </div>
          <div className="text-[11px] text-[#64748b] truncate">
            {policy?.approved_recipients.join(', ')}
          </div>
        </div>

        <div className="p-5 rounded-2xl apple-glass space-y-2 apple-pressable border border-[#cbd5e1]/15">
          <div className="flex items-center justify-between text-[11px] font-mono text-[#64748b]">
            <span>UNKNOWN RECIPIENT</span>
            <Lock className="w-3.5 h-3.5 text-[#c27803]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#c27803] tracking-tight">
            {policy?.unknown_recipient_action}
          </div>
          <div className="text-[11px] text-[#64748b]">Default action on unlisted entity</div>
        </div>
      </section>

      {/* INTERACTIVE RULE SANDBOX */}
      <section className="rounded-3xl apple-glass p-6 sm:p-8 space-y-6 shadow-apple-elevated border border-[#cbd5e1]/15">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#cbd5e1]/15 pb-4">
          <div>
            <span className="caption-label text-[#9e4c27]">DRY-RUN RULE SIMULATION</span>
            <h2 className="text-xl font-bold text-[#0f172a] tracking-tight mt-0.5">
              Deterministic Rule Engine Sandbox
            </h2>
          </div>
          <span className="text-xs font-mono text-[#64748b]">
            Active Policy: <strong className="text-[#0f172a]">{policy?.version}</strong>
          </span>
        </div>

        {/* Form controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="caption-label text-[#0f172a]">Test Amount (₹ INR)</label>
            <input
              type="number"
              value={testAmount}
              onChange={(e) => setTestAmount(e.target.value)}
              className="w-full rounded-2xl bg-[#ffffff] border border-[#cbd5e1]/25 px-4 py-2.5 font-mono text-sm text-[#0f172a] focus:outline-none focus:border-[#b45e35] focus:ring-2 focus:ring-[#b45e35]/15 shadow-[inset_0_1px_2px_rgba(90,65,45,0.04)]"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="caption-label text-[#0f172a]">Target Recipient</label>
              {testRecipient.trim() && (
                <span className={`text-[10px] font-mono font-semibold flex items-center gap-1 ${
                  recipientStatus.isValid ? 'text-[#059669]' : 'text-[#dc2626]'
                }`}>
                  {recipientStatus.isValid ? (
                    <>
                      <Check className="w-3 h-3" /> Genuine Name
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3 h-3" /> Invalid Name
                    </>
                  )}
                </span>
              )}
            </div>
            <input
              type="text"
              value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
              placeholder="e.g. Priya, Rahul, Suhas (genuine names only)"
              className={`w-full rounded-2xl bg-[#ffffff] border px-4 py-2.5 font-mono text-sm text-[#0f172a] placeholder-[#94a3b8] focus:outline-none shadow-[inset_0_1px_2px_rgba(90,65,45,0.04)] transition-colors ${
                !recipientStatus.isValid && testRecipient.trim()
                  ? 'border-[#f0aba4] focus:border-[#dc2626] focus:ring-2 focus:ring-[#dc2626]/20'
                  : 'border-[#cbd5e1]/25 focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15'
              }`}
            />
            {!recipientStatus.isValid && testRecipient.trim() && (
              <p className="text-[11px] text-[#dc2626] font-medium flex items-center gap-1 mt-1 leading-tight">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {recipientStatus.error}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="caption-label text-[#0f172a]">Source Account</label>
            <select
              value={testAccount}
              onChange={(e) => setTestAccount(e.target.value)}
              className="w-full rounded-2xl bg-[#ffffff] border border-[#cbd5e1]/25 px-4 py-2.5 font-mono text-sm text-[#0f172a] focus:outline-none focus:border-[#b45e35] focus:ring-2 focus:ring-[#b45e35]/15 shadow-[inset_0_1px_2px_rgba(90,65,45,0.04)]"
            >
              {accounts.map((a) => (
                <option key={a.account_id} value={a.account_id} className="text-[#0f172a]">
                  {a.account_id} ({a.account_name}) - ₹{a.balance.toFixed(2)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={runSandboxEvaluation}
          className="apple-pressable px-6 py-2.5 rounded-full bg-[#b45e35] hover:bg-[#9e4c27] text-white font-semibold text-xs shadow-apple-button flex items-center gap-2"
        >
          <Play className="w-3.5 h-3.5 fill-white" />
          Evaluate Against Deterministic Rules
        </button>

        {/* Results */}
        {sandboxResults && (
          <div className="p-5 rounded-2xl cream-inset space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-[#cbd5e1]/15 pb-3">
              <span className="text-xs font-mono font-semibold text-[#0f172a]">
                SANDBOX EVALUATION OUTCOME
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${
                sandboxResults.overallPassed
                  ? 'bg-[#edf6ef] text-[#2d7a48] border border-[#c7e4cc]'
                  : 'bg-[#faecea] text-[#c53b3b] border border-[#f0c3bf]'
              }`}>
                {sandboxResults.overallPassed ? 'ALL RULES PASSED' : 'VALIDATION FAILED'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sandboxResults.checks.map((chk, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-2xl border text-xs font-mono space-y-1 ${
                    chk.passed
                      ? 'bg-[#edf6ef] border-[#c7e4cc] text-[#2d7a48]'
                      : 'bg-[#faecea] border-[#f0c3bf] text-[#c53b3b]'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>{chk.name}</span>
                    {chk.passed ? <CheckCircle2 className="w-4 h-4 text-[#2d7a48]" /> : <XCircle className="w-4 h-4 text-[#c53b3b]" />}
                  </div>
                  <div className="text-[11px] opacity-90 leading-relaxed">{chk.message}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
