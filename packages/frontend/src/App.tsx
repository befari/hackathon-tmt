import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { DfdCanvas } from './components/dfd/DfdCanvas';
import { ThreatList } from './components/threats/ThreatList';
import { ChatPanel } from './components/chat/ChatPanel';
import { ReviewPanel } from './components/review/ReviewPanel';
import { Dashboard } from './components/layout/Dashboard';
import { ShareJoin } from './components/layout/ShareJoin';
import { useAuth } from './auth/useAuth';
import { setTokenProvider } from './api/client';

export default function App() {
  const { getToken } = useAuth();

  // Wire token provider into API client
  useEffect(() => {
    setTokenProvider(getToken);
  }, [getToken]);

  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/model/:id" element={<DfdCanvas />} />
          <Route path="/model/:id/threats" element={<ThreatList />} />
          <Route path="/model/:id/chat" element={<ChatPanel />} />
          <Route path="/model/:id/review" element={<ReviewPanel />} />
          <Route path="/join/:token" element={<ShareJoin />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
