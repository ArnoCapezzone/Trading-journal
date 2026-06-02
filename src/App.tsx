import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import { useIsMobile } from './hooks/useMediaQuery';
import AuthPage from './components/auth/AuthPage';
import Dashboard from './pages/Dashboard';
import Journal from './pages/Journal';
import Import from './pages/Import';
import Settings from './pages/Settings';
import TradeFormPage from './pages/TradeFormPage';
import Analysis from './pages/Analysis';
import Mentor from './pages/Mentor';
import PropFirm from './pages/PropFirm';
import DailyPlanPage from './pages/DailyPlan';
import Playbooks from './pages/Playbooks';
import EconomicCalendarPage from './pages/EconomicCalendar';
import AccountsPage from './pages/Accounts';
import VoiceButton from './components/voice/VoiceButton';
import { useTradesStore } from './store/tradesStore';
import { useSettingsStore } from './store/settingsStore';
import { useAuthStore } from './store/authStore';
import { useThemeStore } from './store/themeStore';
import { useAccountsStore } from './lib/accountsStore';
import { useSyncStore } from './store/syncStore';

function AppLayout() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close drawer when switching from mobile to desktop
  useEffect(() => {
    if (!isMobile) setSidebarOpen(false);
  }, [isMobile]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar open={!isMobile || sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div
        style={{
          marginLeft: isMobile ? 0 : 220,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          minWidth: 0,
        }}
      >
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        <main style={{ flex: 1, backgroundColor: 'var(--bg-app)', overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>
      <VoiceButton />
    </div>
  );
}

function AppInitializer() {
  const loadTrades = useTradesStore((s) => s.loadTrades);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const trades = useTradesStore((s) => s.trades);
  const initAccounts = useAccountsStore((s) => s.initialize);
  const accountsInited = useAccountsStore((s) => s.initialized);

  useEffect(() => {
    loadSettings();
    loadTrades();
  }, []);

  // Initialize accounts after trades load (so first-run can assign existing trades)
  useEffect(() => {
    if (!accountsInited) initAccounts(trades);
  }, [trades, accountsInited, initAccounts]);

  // Initialize MT5 AutoSync (loads persisted folder handle if any)
  const initSync = useSyncStore((s) => s.initialize);
  useEffect(() => { void initSync(); }, [initSync]);

  return null;
}

function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-app)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 16,
    }}>
      <div style={{
        width: 52, height: 52,
        backgroundColor: '#3D8EF0',
        borderRadius: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, fontWeight: 800, color: 'var(--text-on-accent)',
        fontFamily: '"JetBrains Mono", monospace',
      }}>TJ</div>
      <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Loading…</div>
    </div>
  );
}

export default function App() {
  const { user, isLoading, initialize } = useAuthStore();
  const initializeTheme = useThemeStore((s) => s.initialize);

  useEffect(() => {
    initializeTheme();
    initialize();
  }, []);

  if (isLoading) return <LoadingScreen />;
  if (!user) return <AuthPage />;

  return (
    <BrowserRouter>
      <AppInitializer />
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="/journal/new" element={<TradeFormPage />} />
          <Route path="/journal/edit/:id" element={<TradeFormPage />} />
          <Route path="/import" element={<Import />} />
          <Route path="/mentor" element={<Mentor />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/prop-firm" element={<PropFirm />} />
          <Route path="/daily-plan" element={<DailyPlanPage />} />
          <Route path="/playbooks" element={<Playbooks />} />
          <Route path="/calendar" element={<EconomicCalendarPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
