import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { LandingPage } from './pages/LandingPage';
import { ConsolePage } from './pages/ConsolePage';
import { DashboardPage } from './pages/DashboardPage';
import { ThreatIntelPage } from './pages/ThreatIntelPage';
import { ValidationCenterPage } from './pages/ValidationCenterPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AiChatPage } from './pages/AiChatPage';
import { FloatingChatWidget } from './components/FloatingChatWidget';
import { api } from './api';
import { AccountInfo, AuthUser } from './types';
import { Shield } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<string>('landing');
  const [consoleInitialPrompt, setConsoleInitialPrompt] = useState<string>('');
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<AccountInfo | null>(null);
  const [resettingData, setResettingData] = useState<boolean>(false);

  // Authenticated User State - Always starts null so login page displays first on every visit
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    // Clear any previously persisted user session to guarantee login page on open
    localStorage.removeItem('bankism_auth_user');
    sessionStorage.removeItem('bankism_auth_user');
  }, []);

  const handleLoginSuccess = (user: AuthUser) => {
    setAuthUser(user);
    // Immediately enter the Overview page upon sign in / sign up
    setActiveTab('landing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = () => {
    setAuthUser(null);
    localStorage.removeItem('bankism_auth_user');
    api.resetChatSession();
    // Return to the initial fullscreen image gate with transparent signup/login
    setActiveTab('landing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const fetchAccounts = async () => {
    try {
      const accs = await api.getAccounts();
      setAccounts(accs);
      setSelectedAccount((prev) => {
        if (!prev) {
          return accs.find((a) => a.account_id === 'CHK-9021') || accs[0] || null;
        }
        const found = accs.find((a) => a.account_id === prev.account_id);
        return found || prev;
      });
    } catch (err) {
      console.error('Error fetching accounts:', err);
    }
  };

  useEffect(() => {
    if (authUser) {
      fetchAccounts();
    }
  }, [authUser]);

  const handleNavigateWithPrompt = (tab: string, prompt?: string) => {
    if (!authUser) {
      setActiveTab('landing');
      return;
    }
    if (prompt) {
      setConsoleInitialPrompt(prompt);
    }
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleResetDemoData = async () => {
    setResettingData(true);
    try {
      await api.seedDemoData();
      await fetchAccounts();
      alert('Demo data re-seeded successfully with simulated records.');
    } catch (err) {
      console.error(err);
      alert('Failed to reset demo data.');
    } finally {
      setResettingData(false);
    }
  };

  // =========================================================================
  // UNAUTHENTICATED STATE: FULLSCREEN IMMERSIVE GATE (LIKE io.jpeg)
  // image.png as full background, transparent glass signup/login on the right
  // =========================================================================
  if (!authUser) {
    return (
      <LandingPage
        onNavigate={handleNavigateWithPrompt}
        authUser={null}
        onLoginSuccess={handleLoginSuccess}
        onLogout={handleLogout}
      />
    );
  }

  // =========================================================================
  // AUTHENTICATED STATE: FULL PLATFORM WITH TOP NAVIGATION & OVERVIEW
  // =========================================================================
  return (
    <div className="min-h-screen flex flex-col bg-[#E9EEF3] text-[#0f172a]">
      {/* 1. Main Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setConsoleInitialPrompt('');
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        accountBalance={selectedAccount?.balance}
        accounts={accounts}
        selectedAccount={selectedAccount}
        onSelectAccount={setSelectedAccount}
        onResetData={handleResetDemoData}
        resetting={resettingData}
        authUser={authUser}
        onLogout={handleLogout}
      />

      {/* 2. Page Content */}
      <main className="flex-1 w-full app-screen-container">
        {activeTab === 'landing' && (
          <LandingPage
            onNavigate={handleNavigateWithPrompt}
            authUser={authUser}
            onLoginSuccess={handleLoginSuccess}
            onLogout={handleLogout}
            selectedAccount={selectedAccount}
          />
        )}

        {activeTab === 'chat' && <AiChatPage />}

        {activeTab === 'console' && (
          <ConsolePage
            initialPrompt={consoleInitialPrompt}
            selectedAccount={selectedAccount}
            onTransactionExecuted={fetchAccounts}
          />
        )}

        {activeTab === 'dashboard' && <DashboardPage />}

        {activeTab === 'intel' && (
          <ThreatIntelPage
            onLoadIntoConsole={(prompt) => handleNavigateWithPrompt('console', prompt)}
          />
        )}

        {activeTab === 'validation' && (
          <ValidationCenterPage selectedAccount={selectedAccount} />
        )}

        {activeTab === 'audit' && <AuditLogsPage />}

        {activeTab === 'settings' && <SettingsPage />}
      </main>

      {/* 3. Neutral Slate Footer */}
      <footer className="border-t border-[#cbd5e1]/60 bg-[#dde5ed]/70 backdrop-blur-md py-6 text-xs text-[#64748b] mt-12">
        <div className="w-full app-screen-container flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-md bg-[#0f172a] flex items-center justify-center text-white">
              <Shield className="w-3 h-3" />
            </div>
            <span className="font-semibold text-[#0f172a]">Bankism Defensive Firewall</span>
          </div>
        </div>
      </footer>

      {/* 4. Floating AI Copilot Widget (Accessible from all pages) */}
      {authUser && (
        <FloatingChatWidget
          onOpenFullPage={() => {
            setActiveTab('chat');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}
    </div>
  );
}

export default App;
