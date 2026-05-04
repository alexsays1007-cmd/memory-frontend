import { useState, useEffect } from 'react';
import './ThemePanel.css';

const defaultColors = {
  accent: '#9B8EA8',
  bgPrimary: '#FAFAF8',
  surface: '#FFFFFF',
  textPrimary: '#3D3840',
};

const presets = [
  { name: 'Morandi Purple', accent: '#9B8EA8' },
  { name: 'Apricot', accent: '#E8C4A0' },
  { name: 'Sage Green', accent: '#8CB89C' },
  { name: 'Dusty Blue', accent: '#8AACB8' },
  { name: 'Rose', accent: '#C88A8A' },
];

export default function ThemePanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [colors, setColors] = useState(() => {
    const saved = localStorage.getItem('theme-colors');
    return saved ? JSON.parse(saved) : defaultColors;
  });

  useEffect(() => {
    const root = document.documentElement;
    Object.entries(colors).forEach(([key, value]) => {
      const varName = `--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      root.style.setProperty(varName, value);
    });
    localStorage.setItem('theme-colors', JSON.stringify(colors));
  }, [colors]);

  const handleColorChange = (key, value) => {
    setColors(prev => ({ ...prev, [key]: value }));
  };

  const applyPreset = (accent) => {
    setColors(prev => ({ ...prev, accent }));
  };

  const resetToDefault = () => {
    setColors(defaultColors);
    localStorage.removeItem('theme-colors');
  };

  return (
    <>
      <button
        className="theme-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Theme Settings"
      >
        🎨
      </button>

      {isOpen && (
        <div className="theme-panel-overlay" onClick={() => setIsOpen(false)}>
          <div className="theme-panel" onClick={(e) => e.stopPropagation()}>
            <div className="theme-panel-header">
              <h3>Theme Settings</h3>
              <button className="theme-panel-close" onClick={() => setIsOpen(false)}>
                ✕
              </button>
            </div>

            <div className="theme-panel-content">
              <div className="theme-section">
                <label className="theme-label">Accent Color</label>
                <div className="color-picker-row">
                  <input
                    type="color"
                    className="color-input"
                    value={colors.accent}
                    onChange={(e) => handleColorChange('accent', e.target.value)}
                  />
                  <span className="color-value">{colors.accent}</span>
                </div>
              </div>

              <div className="theme-section">
                <label className="theme-label">Presets</label>
                <div className="preset-list">
                  {presets.map(preset => (
                    <button
                      key={preset.name}
                      className={`preset-btn ${colors.accent === preset.accent ? 'active' : ''}`}
                      onClick={() => applyPreset(preset.accent)}
                    >
                      <span
                        className="preset-color"
                        style={{ backgroundColor: preset.accent }}
                      />
                      <span className="preset-name">{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="theme-section">
                <label className="theme-label">Background</label>
                <div className="color-picker-row">
                  <input
                    type="color"
                    className="color-input"
                    value={colors.bgPrimary}
                    onChange={(e) => handleColorChange('bgPrimary', e.target.value)}
                  />
                  <span className="color-value">{colors.bgPrimary}</span>
                </div>
              </div>

              <div className="theme-section">
                <label className="theme-label">Surface</label>
                <div className="color-picker-row">
                  <input
                    type="color"
                    className="color-input"
                    value={colors.surface}
                    onChange={(e) => handleColorChange('surface', e.target.value)}
                  />
                  <span className="color-value">{colors.surface}</span>
                </div>
              </div>

              <div className="theme-section">
                <label className="theme-label">Text</label>
                <div className="color-picker-row">
                  <input
                    type="color"
                    className="color-input"
                    value={colors.textPrimary}
                    onChange={(e) => handleColorChange('textPrimary', e.target.value)}
                  />
                  <span className="color-value">{colors.textPrimary}</span>
                </div>
              </div>

              <div className="theme-section">
                <label className="theme-label">Preview</label>
                <div className="theme-preview">
                  <div className="preview-card">
                    <div className="preview-text">Sample Card</div>
                    <button className="preview-btn">Button</button>
                  </div>
                </div>
              </div>

              <button className="theme-reset-btn" onClick={resetToDefault}>
                Reset to Default
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
