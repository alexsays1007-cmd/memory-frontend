import { Outlet } from 'react-router-dom';
import NavBar from './NavBar';
import ThemePanel from '../ThemePanel/ThemePanel';
import './AppLayout.css';

export default function AppLayout() {
  return (
    <div className="app-layout">
      <NavBar />
      <main className="app-main">
        <Outlet />
      </main>
      <ThemePanel />
    </div>
  );
}
