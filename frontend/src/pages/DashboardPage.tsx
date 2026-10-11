import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  ShieldCheck,
  AlertOctagon,
  AlertTriangle,
  TrendingUp,
  BarChart2,
  IndianRupee,
  PieChart as PieIcon
} from 'lucide-react';
import {
  BarChart,
  Bar,
  CartesianGrid,
  Legend,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { api } from '../api';
import { DashboardMetrics, AccountInfo } from '../types';

const PIE_COLORS = ['#c53b3b', '#c27803', '#b45e35', '#7c4a88', '#8e5c36', '#2c6590', '#2d7a48'];

export const DashboardPage: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetricsAndAccounts = async () => {
    try {
      const [m, accs] = await Promise.all([
        api.getDashboardMetrics(),
        api.getAccounts()
      ]);
      setMetrics(m);
      setAccounts(accs);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load telemetry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetricsAndAccounts();
    const interval = setInterval(fetchMetricsAndAccounts, 8000);
    return () => clearInterval(interval);
  }, []);

  const threatDist = metrics?.threat_distribution;
  const pieData = useMemo(() => {
    if (!threatDist) return [];
    return Object.entries(threatDist)
      .filter(([cat]) => cat !== 'NONE')
      .map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }));
  }, [threatDist]);

  if (loading && !metrics) {
    return (
      <div className="py-24 text-center space-y-4">
        <div className="w-7 h-7 border-2 border-[#cbd5e1]/30 border-t-[#b45e35] rounded-full animate-spin mx-auto" />
        <p className="text-xs font-mono text-[#64748b]">Loading Telemetry...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 py-8 pb-24">
      {/* Page Title & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#cbd5e1]/15 pb-5">
        <div>
          <span className="caption-label text-[#9e4c27]">SOC TELEMETRY</span>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0f172a] tracking-tight flex items-center gap-2.5 mt-0.5">
            <Activity className="w-6 h-6 text-[#b45e35]" />
            Security Telemetry Dashboard
          </h1>
          <p className="text-[#64748b] text-sm mt-1">
            Real-time security telemetry dynamically computed from stored SQLite audit events & mock ledger transactions.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-[#faecea] border border-[#f0c3bf] text-[#c53b3b] text-xs">
          {error}
        </div>
      )}

      {/* Primary KPI Cards (Apple Bento Row - Cream Skin Palette) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="p-5 rounded-2xl apple-glass space-y-2 apple-pressable border border-[#cbd5e1]/15">
          <div className="flex items-center justify-between text-[11px] font-mono text-[#64748b]">
            <span>TOTAL INSPECTED</span>
            <TrendingUp className="w-3.5 h-3.5 text-[#b45e35]" />
          </div>
          <div className="text-3xl font-bold text-[#0f172a] font-mono tracking-tight">
            {metrics?.total_inspected ?? 0}
          </div>
          <div className="text-[11px] text-[#64748b]">Evaluated requests</div>
        </div>

        <div className="p-5 rounded-2xl apple-glass space-y-2 apple-pressable border border-[#cbd5e1]/15">
          <div className="flex items-center justify-between text-[11px] font-mono text-[#64748b]">
            <span>APPROVED</span>
            <ShieldCheck className="w-3.5 h-3.5 text-[#2d7a48]" />
          </div>
          <div className="text-3xl font-bold text-[#2d7a48] font-mono tracking-tight">
            {metrics?.approved_count ?? 0}
          </div>
          <div className="text-[11px] text-[#64748b]">Legitimate requests</div>
        </div>

        <div className="p-5 rounded-2xl apple-glass space-y-2 apple-pressable border border-[#cbd5e1]/15">
          <div className="flex items-center justify-between text-[11px] font-mono text-[#64748b]">
            <span>BLOCKED</span>
            <AlertOctagon className="w-3.5 h-3.5 text-[#c53b3b]" />
          </div>
          <div className="text-3xl font-bold text-[#c53b3b] font-mono tracking-tight">
            {metrics?.blocked_count ?? 0}
          </div>
          <div className="text-[11px] text-[#64748b]">Adversarial / policy halts</div>
        </div>

        <div className="p-5 rounded-2xl apple-glass space-y-2 apple-pressable border border-[#cbd5e1]/15">
          <div className="flex items-center justify-between text-[11px] font-mono text-[#64748b]">
            <span>IN REVIEW</span>
            <AlertTriangle className="w-3.5 h-3.5 text-[#c27803]" />
          </div>
          <div className="text-3xl font-bold text-[#c27803] font-mono tracking-tight">
            {metrics?.review_count ?? 0}
          </div>
          <div className="text-[11px] text-[#64748b]">Ambiguous requests</div>
        </div>

        <div className="p-5 rounded-2xl apple-glass space-y-2 apple-pressable border border-[#cbd5e1]/15">
          <div className="flex items-center justify-between text-[11px] font-mono text-[#64748b]">
            <span>DETECTION RATE</span>
            <span className="text-[9px] text-[#9e4c27] font-mono font-bold px-1.5 py-0.5 rounded-full bg-[#dde5ed]">MOCK</span>
          </div>
          <div className="text-3xl font-bold text-[#b45e35] font-mono tracking-tight">
            {metrics?.detection_rate_pct ?? 0}%
          </div>
          <div className="text-[11px] text-[#64748b]">Demo attack coverage</div>
        </div>
      </div>

      {/* Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hourly Volume Chart */}
        <div className="lg:col-span-2 p-6 rounded-3xl apple-glass space-y-4 shadow-apple-card border border-[#cbd5e1]/15">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-[#0f172a] tracking-tight flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-[#2563eb]" />
                Request Volume & Blocked Threats
              </h3>
              <p className="text-xs text-[#64748b] mt-0.5">
                Hourly activity trace: scanned banking prompts vs. neutralized prompt injections
              </p>
            </div>
            <span className="text-[11px] font-mono text-[#64748b] px-2.5 py-1 rounded-full bg-[#f1f5f9] border border-[#cbd5e1]/40">
              24-Hour Horizon
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics?.volume_by_hour || []} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(203, 213, 225, 0.4)" />
                <XAxis
                  dataKey="hour"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(203, 213, 225, 0.6)' }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(203, 213, 225, 0.6)' }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const total = Number(payload[0]?.value || 0);
                      const blocked = Number(payload[1]?.value || 0);
                      const safe = Math.max(0, total - blocked);
                      return (
                        <div className="bg-white border border-[#cbd5e1] rounded-2xl p-3.5 shadow-apple-elevated text-xs space-y-2 font-sans">
                          <div className="font-mono font-bold text-[#0f172a] border-b border-[#cbd5e1]/40 pb-1 flex items-center justify-between gap-4">
                            <span>Time Slot: {label}</span>
                            <span className="text-[10px] text-[#2563eb] bg-[#eff6ff] px-1.5 py-0.5 rounded font-mono">Telemetry</span>
                          </div>
                          <div className="space-y-1.5 font-mono text-[11px]">
                            <div className="flex items-center justify-between gap-4 text-[#2563eb]">
                              <span>Total Prompts Scanned:</span>
                              <strong>{total}</strong>
                            </div>
                            <div className="flex items-center justify-between gap-4 text-[#dc2626]">
                              <span>Malicious Injections Blocked:</span>
                              <strong>{blocked}</strong>
                            </div>
                            <div className="flex items-center justify-between gap-4 text-[#16a34a]">
                              <span>Safe Transactions Executed:</span>
                              <strong>{safe}</strong>
                            </div>
                          </div>
                          <div className="pt-1.5 border-t border-[#cbd5e1]/40 text-[10px]">
                            {blocked > 0 ? (
                              <span className="text-[#dc2626] font-semibold">⚠️ Attacks neutralized by firewall</span>
                            ) : (
                              <span className="text-[#16a34a] font-semibold">✓ Normal operations verified</span>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ paddingBottom: '10px', fontSize: '11px' }}
                />
                <Bar
                  dataKey="requests"
                  name="Total Prompts Scanned"
                  fill="#2563eb"
                  radius={[5, 5, 0, 0]}
                  maxBarSize={30}
                />
                <Bar
                  dataKey="blocks"
                  name="Malicious Threats Blocked"
                  fill="#dc2626"
                  radius={[5, 5, 0, 0]}
                  maxBarSize={30}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Presenter & Evaluator Simple Explanation Strip */}
          <div className="p-3.5 rounded-2xl bg-white/70 border border-[#cbd5e1]/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-[#475569]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb] shrink-0" />
              <span><strong>Blue Bar:</strong> Total evaluated banking prompts</span>
              <span className="text-[#cbd5e1]">|</span>
              <span className="w-2.5 h-2.5 rounded-full bg-[#dc2626] shrink-0" />
              <span><strong>Red Bar:</strong> Adversarial attacks blocked</span>
            </div>
            <div className="text-[11px] font-mono text-[#16a34a] bg-[#edf6ef] px-2.5 py-0.5 rounded-full border border-[#c7e4cc]">
              Difference = Legitimate transfers approved
            </div>
          </div>
        </div>

        {/* Threat Categories Breakdown Pie */}
        <div className="p-6 rounded-3xl apple-glass space-y-4 flex flex-col justify-between shadow-apple-card border border-[#cbd5e1]/15">
          <div>
            <h3 className="text-base font-semibold text-[#0f172a] tracking-tight flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-[#c53b3b]" />
              Threat Distribution
            </h3>
            <p className="text-xs text-[#64748b] mt-0.5">
              Distribution of identified attack signatures
            </p>
          </div>

          <div className="h-56 w-full flex items-center justify-center">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={82}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} stroke="#ffffff" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: 'rgba(160, 125, 95, 0.25)',
                      borderRadius: '16px',
                      fontSize: '12px',
                      boxShadow: '0 8px 30px rgba(100, 70, 45, 0.1)',
                      color: '#0f172a'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <span className="text-xs font-mono text-[#64748b]">No threat events recorded yet</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-[#64748b]">
            {pieData.slice(0, 4).map((p, idx) => (
              <div key={idx} className="flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                <span className="truncate">{p.name}: {p.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mock Bank Accounts (Warm Wallet Cards) */}
      <div className="rounded-3xl apple-glass p-6 space-y-5 shadow-apple-card border border-[#cbd5e1]/15">
        <div className="flex items-center justify-between border-b border-[#cbd5e1]/15 pb-4">
          <div>
            <h3 className="text-base font-semibold text-[#0f172a] tracking-tight flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-[#2d7a48]" />
              Simulated Bank Accounts & Balances
            </h3>
            <p className="text-xs text-[#64748b] mt-0.5">
              Target mock accounts governed by Bankism's deterministic authorization gate
            </p>
          </div>
          <span className="text-xs font-mono text-[#64748b]">
            Transferred Today: <strong className="text-[#0f172a]">₹{metrics?.total_mock_transferred_today.toFixed(2)}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {accounts.map((acc) => (
            <div key={acc.account_id} className="p-5 rounded-2xl bg-[#ffffff] border border-[#cbd5e1]/15 space-y-2.5 apple-pressable shadow-apple-button">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-[#b45e35]">{acc.account_id}</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#edf6ef] text-[#2d7a48] border border-[#c7e4cc]">
                  {acc.status}
                </span>
              </div>
              <div className="text-xs text-[#64748b] font-medium">{acc.account_name}</div>
              <div className="text-2xl font-bold font-mono text-[#0f172a] tracking-tight">
                ₹{acc.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] font-mono text-[#64748b]">
                Daily Spent: ₹{acc.daily_transferred_today.toFixed(2)} / ₹480,000.00
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
