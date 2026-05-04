import { useState, useEffect } from 'react';
import './ThemePicker.css';

const themes = [
  { id: 'looplight-default', name: 'Looplight Default', color: '#9B7895' },
  { id: 'velvy-glow', name: 'Velvy Glow', color: '#B58AA5' },
  { id: 'riven-ashgold', name: 'Riven Ashgold', color: '#8B6A55' },
  { id: 'paper-moon', name: 'Paper Moon', color: '#A88F7A' },
  { id: 'night-loop', name: 'Night Loop', color: '#C19A6B' },
];

export default function ThemePicker() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTheme, setActiveTheme] = useState('looplight-default');

  useEffect(() => {
    // Load theme from localStorage if available
    const savedTheme = localStorage.getItem('memory-archive-theme');
    if (savedTheme && themes.some(t => t.id === savedTheme)) {
      setActiveTheme(savedTheme);
      applyTheme(savedTheme);
    }
  }, []);

  const applyTheme = (themeId) => {
    const root = document.documentElement; // <html> element
    if (themeId === 'looplight-default') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', themeId);
    }
  };

  const handleThemeChange = (themeId) => {
    setActiveTheme(themeId);
    applyTheme(themeId);
    localStorage.setItem('memory-archive-theme', themeId);
  };

  return (
    <div className="theme-picker-container">
      {isOpen && (
        <div className="theme-picker-panel">
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
        onClick={() => setIsOpen(!isOpen)}
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
