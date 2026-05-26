import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import Header from './Header';
import BottomNav from './BottomNav';
import ThemePicker from '../ThemePicker/ThemePicker';
import ConsoleModal from '../Console/ConsoleModal';
import './AppLayout.css';

const showMockBadge = import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === 'true';

export default function AppLayout() {
  const [consoleOpen, setConsoleOpen] = useState(false);

  return (
    <div className="app-layout">
      <Header onOpenConsole={() => setConsoleOpen(true)} />
      <main className="app-main">
        <Outlet />
      </main>
      <BottomNav />
      <ThemePicker />
      <ConsoleModal open={consoleOpen} onClose={() => setConsoleOpen(false)} />
      {showMockBadge && (
        <div className="dev-mock-badge">Mock data enabled</div>
      )}
    </div>
  );
}
