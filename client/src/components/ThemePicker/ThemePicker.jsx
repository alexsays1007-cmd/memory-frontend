import { useState, useEffect, useRef, useCallback } from 'react';
import './ThemePicker.css';

const themes = [
  { id: 'looplight-default', name: 'Looplight Default', color: '#9B7895' },
  { id: 'velvy-glow', name: 'Velvy Glow', color: '#B58AA5' },
  { id: 'riven-ashgold', name: 'Riven Ashgold', color: '#8B6A55' },
  { id: 'paper-moon', name: 'Paper Moon', color: '#A88F7A' },
  { id: 'night-loop', name: 'Night Loop', color: '#C19A6B' },
];

export default function ThemePicker() {
  // visible = panel in DOM; animState = CSS class for enter/exit animation
  const [visible, setVisible] = useState(false);
  const [animState, setAnimState] = useState('closed'); // 'open' | 'closing' | 'closed'
  const [activeTheme, setActiveTheme] = useState('looplight-default');
  const closeTimer = useRef(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem('memory-archive-theme');
    if (savedTheme && themes.some(t => t.id === savedTheme)) {
      setActiveTheme(savedTheme);
      applyTheme(savedTheme);
    }
  }, []);

  // Cleanup timer on unmount
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const applyTheme = (themeId) => {
    const root = document.documentElement;
    if (themeId === 'looplight-default') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', themeId);
    }
  };

  const openPanel = useCallback(() => {
    clearTimeout(closeTimer.current);
    setVisible(true);
    // rAF so the DOM mounts first, then CSS transition triggers
    requestAnimationFrame(() => requestAnimationFrame(() => setAnimState('open')));
  }, []);

  const closePanel = useCallback(() => {
    clearTimeout(closeTimer.current);
    setAnimState('closing');
  }, []);

  const handleTransitionEnd = useCallback(() => {
    if (animState === 'closing') {
      setVisible(false);
      setAnimState('closed');
    }
  }, [animState]);

  const handleToggle = useCallback(() => {
    if (visible && animState === 'open') {
      closePanel();
    } else if (!visible) {
      openPanel();
    }
    // If animState === 'closing', clicking again re-opens
    if (animState === 'closing') {
      openPanel();
    }
  }, [visible, animState, openPanel, closePanel]);

  const handleThemeChange = (themeId) => {
    setActiveTheme(themeId);
    applyTheme(themeId);
    localStorage.setItem('memory-archive-theme', themeId);
    // Brief delay so user sees selection highlight, then close
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(closePanel, 350);
  };

  return (
    <div className="theme-picker-container">
      {visible && (
        <div
          className={`theme-picker-panel ${animState === 'open' ? 'open' : ''}`}
          onTransitionEnd={handleTransitionEnd}
        >
          {themes.map(theme => (
            <button
              key={theme.id}
              className={`theme-option ${activeTheme === theme.id ? 'active' : ''}`}
              onClick={() => handleThemeChange(theme.id)}
              title={theme.name}
            >
              <span
                className="theme-color-dot"
                style={{ backgroundColor: theme.color }}
              />
              <span className="theme-name">{theme.name}</span>
            </button>
          ))}
        </div>
      )}
      <button
        className="theme-picker-toggle"
        onClick={handleToggle}
        aria-label="Toggle theme picker"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="5"/>
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
        </svg>
      </button>
    </div>
  );
}
