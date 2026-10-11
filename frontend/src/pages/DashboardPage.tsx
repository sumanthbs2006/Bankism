import React, { useState, useEffect } from 'react';
import {
  Activity,
  ShieldCheck,
  AlertOctagon,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  BarChart2,
  IndianRupee,
  PieChart as PieIcon
} from 'lucide-react';
import {
  AreaChart,
  Area,
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

export const DashboardPage: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMetricsAndAccounts();
    const interval = setInterval(fetchMetricsAndAccounts, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchMetricsAndAccounts();
  };

  const pieData = metrics?.threat_distribution
    ? Object.entries(metrics.threat_distribution)
        .filter(([cat]) => cat !== 'NONE')
        .map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }))
    : [];

  const PIE_COLORS = ['#c53b3b', '#c27803', '#b45e35', '#7c4a88', '#8e5c36', '#2c6590', '#2d7a48'];

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

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono font-semibold bg-[#edf6ef] text-[#2d7a48] border border-[#c7e4cc] shadow-apple-button">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2d7a48] animate-pulse" />
            {metrics?.firewall_status || 'ACTIVE - ENFORCING'}
          </span>

          <button
            onClick={handleManualRefresh}
            className="apple-pressable p-2 rounded-full bg-[#ffffff] hover:bg-[#f1f5f9] text-[#0f172a] border border-[#cbd5e1]/20 shadow-apple-button"
            title="Refresh Telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
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
                <BarChart2 className="w-4 h-4 text-[#b45e35]" />
                Request Volume & Blocked Threats
              </h3>
              <p className="text-xs text-[#64748b] mt-0.5">
                Hourly activity trace across simulated requests
              </p>
            </div>
            <span className="text-[11px] font-mono text-[#64748b]">24-Hour Horizon</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics?.volume_by_hour || []}>
                <defs>
                  <linearGradient id="colorReq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#b45e35" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#b45e35" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorBlock" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c53b3b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#c53b3b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="hour" stroke="#64748b" fontSize={11} tickLine={false} axisLine={{ stroke: 'rgba(160,125,95,0.18)' }} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={{ stroke: 'rgba(160,125,95,0.18)' }} />
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
                <Area type="monotone" dataKey="requests" stroke="#b45e35" strokeWidth={2} fillOpacity={1} fill="url(#colorReq)" name="Total Requests" />
                <Area type="monotone" dataKey="blocks" stroke="#c53b3b" strokeWidth={2} fillOpacity={1} fill="url(#colorBlock)" name="Blocked Threats" />
              </AreaChart>
            </ResponsiveContainer>
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
