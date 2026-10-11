import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Activity,
  AlertTriangle,
  Sliders,
  FileText,
  CheckCircle2,
  Menu,
  X,
  CreditCard,
  RefreshCw,
  LogOut,
  Lock,
  ShieldCheck,
  ChevronDown,
  Check
} from 'lucide-react';
import { AuthUser, AccountInfo } from '../types';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  accountBalance?: number;
  accounts?: AccountInfo[];
  selectedAccount?: AccountInfo | null;
  onSelectAccount?: (account: AccountInfo) => void;
  onResetData?: () => void;
  resetting?: boolean;
  authUser?: AuthUser | null;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  accountBalance,
  accounts,
  selectedAccount,
  onSelectAccount,
  onResetData,
  resetting,
  authUser,
  onLogout
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [bankDropdownOpen, setBankDropdownOpen] = React.useState(false);
  const bankDropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (bankDropdownRef.current && !bankDropdownRef.current.contains(e.target as Node)) {
        setBankDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeAccount = selectedAccount || (accounts && accounts[0]) || {
    account_id: 'CHK-9021',
    account_name: 'Primary Operating Account',
    account_type: 'Checking',
    balance: accountBalance ?? 1089600.0,
    currency: 'INR',
    status: 'ACTIVE'
  };

  const navItems = [
    { id: 'landing', label: 'Overview', icon: Shield },
    { id: 'console', label: 'Firewall Console', icon: ShieldCheck },
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'intel', label: 'Threat Intel', icon: AlertTriangle },
    { id: 'validation', label: 'Validation', icon: CheckCircle2 },
    { id: 'audit', label: 'Audit Trail', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Sliders },
  ];

  const handleNav = (id: string) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-[#E9EEF3]/85 backdrop-blur-2xl border-b border-[#cbd5e1]/60 transition-colors">
      <div className="w-full app-screen-container">
        <div className="flex items-center justify-between h-16">
          {/* Apple-Style Brand Mark */}
          <div
            className="flex items-center gap-3 cursor-pointer group select-none"
            onClick={() => handleNav('landing')}
          >
            <div className="w-9 h-9 rounded-xl bg-[#0f172a] text-white flex items-center justify-center shadow-sm apple-pressable">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold tracking-tight text-[#0f172a]">
                  Bankism
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#dde5ed] text-[#0f172a] border border-[#cbd5e1]">
                  Firewall
                </span>
              </div>
              <p className="text-[10px] text-[#64748b] font-medium tracking-wide">
                Defensive Banking Guardrail
              </p>
            </div>
          </div>

          {/* Desktop Navigation */}
          {authUser ? (
            /* Authenticated: Full Segmented Pill Nav */
            <nav className="hidden lg:flex items-center bg-[#dde5ed]/80 p-1 rounded-full border border-[#cbd5e1] shadow-sm">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNav(item.id)}
                    className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors select-none apple-pressable ${
                      isActive ? 'text-[#0f172a]' : 'text-[#64748b] hover:text-[#0f172a]'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeTabPill"
                        className="absolute inset-0 rounded-full bg-white shadow-apple-pill border border-[#cbd5e1]/60"
                        transition={{ type: 'spring', damping: 24, stiffness: 320 }}
                      />
                    )}
                    <Icon className={`w-3.5 h-3.5 relative z-10 ${isActive ? 'text-[#2563eb]' : 'text-[#64748b]'}`} />
                    <span className="relative z-10">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          ) : (
            /* Unauthenticated: Security Locked Capsule */
            <div className="hidden lg:flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#dde5ed]/80 border border-[#cbd5e1] text-xs text-[#64748b]">
              <Lock className="w-3.5 h-3.5 text-[#2563eb]" />
              <span className="font-medium">Google Authentication Gate Active</span>
              <span className="text-[#94a3b8]">•</span>
              <span className="text-[#64748b]">Sign in to unlock console</span>
            </div>
          )}

          {/* Right Action Cluster */}
          <div className="hidden sm:flex items-center gap-2.5">
            {authUser && (
              <div className="relative" ref={bankDropdownRef}>
                <button
                  type="button"
                  onClick={() => setBankDropdownOpen(!bankDropdownOpen)}
                  className="apple-pressable flex items-center gap-2 px-3 py-1.5 rounded-full bg-white hover:bg-[#f8fafc] border border-[#cbd5e1] text-xs font-mono shadow-sm transition-all group"
                  title="Click to switch bank account"
                  aria-expanded={bankDropdownOpen}
                >
                  <CreditCard className="w-3.5 h-3.5 text-[#059669] shrink-0" />
                  <span className="text-[#64748b] text-[11px] font-semibold">{activeAccount.account_id}:</span>
                  <span className="font-semibold text-[#0f172a]">
                    ₹{activeAccount.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-[#64748b] transition-transform duration-200 ${
                      bankDropdownOpen ? 'rotate-180 text-[#2563eb]' : 'group-hover:text-[#0f172a]'
                    }`}
                  />
                </button>

                {/* Dropdown Menu (Scrollable Bank Selector) */}
                <AnimatePresence>
                  {bankDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -4 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="absolute right-0 mt-2 w-80 rounded-2xl apple-glass-elevated border border-[#cbd5e1] shadow-2xl p-2 z-50 overflow-hidden"
                    >
                      <div className="px-3 py-2 border-b border-[#cbd5e1]/40 flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-[#64748b] font-bold">
                          Switch Bank Account
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#dde5ed] text-[#0f172a] font-bold">
                          {accounts?.length || 3} Banks
                        </span>
                      </div>

                      <div className="max-h-56 overflow-y-auto py-1 space-y-1">
                        {(accounts && accounts.length > 0 ? accounts : [
                          { account_id: 'CHK-9021', account_name: 'Primary Operating Account', account_type: 'Checking', balance: 1089600.0, status: 'ACTIVE' },
                          { account_id: 'SAV-4410', account_name: 'High Yield Reserve', account_type: 'Savings', balance: 4339200.0, status: 'ACTIVE' },
                          { account_id: 'INV-1092', account_name: 'Treasury Liquidity Portfolio', account_type: 'Investment', balance: 14400000.0, status: 'ACTIVE' }
                        ]).map((acc: any) => {
                          const isSelected = activeAccount.account_id === acc.account_id;
                          return (
                            <button
                              key={acc.account_id}
                              type="button"
                              onClick={() => {
                                if (onSelectAccount) onSelectAccount(acc);
                                setBankDropdownOpen(false);
                              }}
                              className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-colors ${
                                isSelected
                                  ? 'bg-[#dde5ed] border border-[#cbd5e1]/70'
                                  : 'hover:bg-[#f1f5f9] text-[#0f172a]'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                  isSelected ? 'bg-[#2563eb] text-white' : 'bg-[#e2e8f0] text-[#64748b]'
                                }`}>
                                  <CreditCard className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold font-mono text-[#0f172a]">{acc.account_id}</span>
                                    <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/80 border border-[#cbd5e1]/50 text-[#64748b]">
                                      {acc.account_type || 'BANK'}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-[#64748b] truncate">{acc.account_name}</p>
                                </div>
                              </div>

                              <div className="text-right shrink-0 ml-2">
                                <div className="text-xs font-mono font-bold text-[#0f172a]">
                                  ₹{acc.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </div>
                                {isSelected && (
                                  <span className="text-[10px] font-semibold text-[#059669] flex items-center justify-end gap-1">
                                    <Check className="w-3 h-3" /> Active
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {authUser ? (
              /* Authenticated User Capsule */
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-white border border-[#cbd5e1] shadow-apple-button">
                {authUser.picture ? (
                  <img
                    src={authUser.picture}
                    alt={authUser.name}
                    className="w-5 h-5 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-[#0f172a] text-white text-[10px] font-bold flex items-center justify-center">
                    {authUser.name.charAt(0)}
                  </div>
                )}
                <span className="text-xs font-medium text-[#0f172a] max-w-[110px] truncate">
                  {authUser.name.split(' ')[0]}
                </span>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="text-[#64748b] hover:text-[#dc2626] p-0.5 ml-0.5 apple-pressable"
                    title="Sign Out to Welcome Gate"
                  >
                    <LogOut className="w-3 h-3" />
                  </button>
                )}
              </div>
            ) : (
              /* Unauthenticated Google Identity Badge */
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#cbd5e1] text-xs font-medium text-[#0f172a] shadow-sm">
                <ShieldCheck className="w-3.5 h-3.5 text-[#2563eb]" />
                <span>Google OAuth 2.0</span>
              </div>
            )}

            {authUser && onResetData && (
              <button
                onClick={onResetData}
                disabled={resetting}
                className="apple-pressable flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-[#f1f5f9] text-[#0f172a] text-xs font-medium border border-[#cbd5e1] shadow-apple-button"
                title="Reset simulated banking data to factory defaults"
              >
                <RefreshCw className={`w-3 h-3 text-[#2563eb] ${resetting ? 'animate-spin' : ''}`} />
                <span>{resetting ? 'Resetting...' : 'Reset'}</span>
              </button>
            )}
          </div>

          {/* Mobile Menu Toggle (Only available when authenticated) */}
          {authUser && (
            <div className="flex lg:hidden items-center gap-2">
              <div className="w-7 h-7 rounded-full overflow-hidden border border-[#cbd5e1]">
                {authUser.picture ? (
                  <img src={authUser.picture} alt={authUser.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[#0f172a] text-white text-xs flex items-center justify-center font-bold">
                    {authUser.name.charAt(0)}
                  </div>
                )}
              </div>

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="apple-pressable p-2 rounded-xl bg-white text-[#0f172a] border border-[#cbd5e1] shadow-apple-button"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Drawer (Only when authenticated) */}
      {authUser && mobileMenuOpen && (
        <div className="lg:hidden border-t border-[#cbd5e1]/60 bg-white/95 backdrop-blur-2xl px-4 py-4 space-y-1 shadow-lg">
          <div className="p-3 mb-2 rounded-xl bg-[#dde5ed]/70 border border-[#cbd5e1]/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 truncate">
              {authUser.picture && (
                <img src={authUser.picture} alt={authUser.name} className="w-6 h-6 rounded-full" />
              )}
              <div className="truncate">
                <div className="font-bold text-[#0f172a] truncate">{authUser.name}</div>
                <div className="text-[10px] text-[#64748b] truncate">{authUser.email}</div>
              </div>
            </div>
            {onLogout && (
              <button
                onClick={onLogout}
                className="px-2 py-1 rounded-md text-[11px] text-[#dc2626] font-medium hover:bg-red-50"
              >
                Sign Out
              </button>
            )}
          </div>

          {/* Mobile Bank Switcher */}
          <div className="p-3 mb-2 rounded-xl bg-[#dde5ed]/70 border border-[#cbd5e1]/60 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#64748b]">Active Bank:</span>
              <span className="font-bold text-[#0f172a]">
                ₹{activeAccount.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <select
              value={activeAccount.account_id}
              onChange={(e) => {
                const found = accounts?.find((a) => a.account_id === e.target.value);
                if (found && onSelectAccount) onSelectAccount(found);
              }}
              className="w-full text-xs font-mono p-2 rounded-lg bg-white border border-[#cbd5e1] text-[#0f172a] focus:outline-none"
            >
              {(accounts && accounts.length > 0 ? accounts : [
                { account_id: 'CHK-9021', account_name: 'Primary Operating Account', balance: 1089600.0 },
                { account_id: 'SAV-4410', account_name: 'High Yield Reserve', balance: 4339200.0 },
                { account_id: 'INV-1092', account_name: 'Treasury Liquidity Portfolio', balance: 14400000.0 }
              ]).map((acc) => (
                <option key={acc.account_id} value={acc.account_id}>
                  {acc.account_id} • {acc.account_name} (₹{acc.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })})
                </option>
              ))}
            </select>
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-left transition-colors ${
                  isActive
                    ? 'bg-[#0f172a] text-white'
                    : 'text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#64748b]'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};
