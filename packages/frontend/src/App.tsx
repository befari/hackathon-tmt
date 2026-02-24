import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { DfdCanvas } from './components/dfd/DfdCanvas';
import { ThreatList } from './components/threats/ThreatList';
import { ChatPanel } from './components/chat/ChatPanel';
import { ReviewPanel } from './components/review/ReviewPanel';
import { Dashboard } from './components/layout/Dashboard';

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/model/:id" element={<DfdCanvas />} />
          <Route path="/model/:id/threats" element={<ThreatList />} />
          <Route path="/model/:id/chat" element={<ChatPanel />} />
          <Route path="/model/:id/review" element={<ReviewPanel />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
