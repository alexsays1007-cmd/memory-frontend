import { NavLink } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { getPendingSummaryCount } from '../../api/rawMessages';
import './BottomNav.css';

const navItems = [
  { path: '/', label: '记忆档案', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  )},
  { path: '/diary', label: '日记胶囊', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  )},
  { path: '/stream', label: '对话流', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  )},
  { path: '/consciousness', label: '意识脉冲', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
    </svg>
  )},
];

export default function BottomNav() {
  const [pendingCount, setPendingCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await getPendingSummaryCount();
      setPendingCount(res.count || 0);
    } catch { setPendingCount(0); }
  }, []);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener('summary-status-changed', handler);
    return () => window.removeEventListener('summary-status-changed', handler);
  }, [refresh]);

  return (
    <nav className="bottom-nav">
      <div className="bottom-nav-inner">
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `bottom-nav-link ${isActive ? 'active' : ''}`}
            end={item.path === '/'}
          >
            <div className="nav-icon">
              {item.icon}
              {item.path === '/stream' && pendingCount > 0 && (
                <span className="nav-badge" />
              )}
            </div>
            <span className="nav-label">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
