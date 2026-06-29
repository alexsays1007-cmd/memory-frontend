import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Header from './Header';
import BottomNav from './BottomNav';
import ThemePicker from '../ThemePicker/ThemePicker';
import ConsoleModal from '../Console/ConsoleModal';
import { useTelegram } from '../../hooks/useTelegram';
import './AppLayout.css';

const showMockBadge = import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === 'true';

export default function AppLayout() {
  const [consoleOpen, setConsoleOpen] = useState(false);
  const { tg, inTelegram } = useTelegram();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!inTelegram || !tg) return;

    if (location.pathname !== '/') {
      tg.BackButton.show();
      tg.BackButton.onClick(() => navigate(-1));
    } else {
      tg.BackButton.hide();
    }

    return () => {
      tg.BackButton.offClick(() => navigate(-1));
    };
  }, [inTelegram, tg, location.pathname, navigate]);

  return (
    <div className={`app-layout ${inTelegram ? 'in-telegram' : ''}`}>
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
