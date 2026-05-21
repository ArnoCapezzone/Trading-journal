import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import AuthPage from './components/auth/AuthPage';
import Dashboard from './pages/Dashboard';
import Journal from './pages/Journal';
import Import from './pages/Import';
import Settings from './pages/Settings';
import TradeFormPage from './pages/TradeFormPage';
import Analysis from './pages/Analysis';
import { useTradesStore } from './store/tradesStore';
import { useSettingsStore } from './store/settingsStore';
import { useAuthStore } from './store/authStore';

function AppLayout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: 220, flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <TopBar />
        <main style={{ flex: 1, backgroundColor: '#080B12', overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function AppInitializer() {
  const loadTrades = useTradesStore((s) => s.loadTrades);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  useEffect(() => {
    loadSettings();
    loadTrades();
  }, []);

  return null;
}

function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0f1117',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 16,
    }}>
      <div style={{
        width: 52, height: 52,
        backgroundColor: '#4d9eff',
        borderRadius: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, fontWeight: 800, color: '#0f1117',
        fontFamily: '"JetBrains Mono", monospace',
      }}>TJ</div>
      <div style={{ color: '#8892a4', fontSize: 13 }}>Loading…</div>
    </div>
  );
}

export default function App() {
  const { user, isLoading, initialize } = useAuthStore();

  useEffect(() => {
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
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
