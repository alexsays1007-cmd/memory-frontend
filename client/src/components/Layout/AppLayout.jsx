import { Outlet } from 'react-router-dom';
import Header from './Header';
import BottomNav from './BottomNav';
import ThemePicker from '../ThemePicker/ThemePicker';
import './AppLayout.css';

const showMockBadge = import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === 'true';

export default function AppLayout() {
  return (
    <div className="app-layout">
      <Header />
      <main className="app-main">
        <Outlet />
      </main>
      <BottomNav />
      <ThemePicker />
      {showMockBadge && (
        <div className="dev-mock-badge">Mock data enabled</div>
      )}
    </div>
  );
}
