import { useState, useRef, useEffect } from 'react';
import './SoftSelect.css';

/**
 * SoftSelect — theme-aware custom dropdown replacing native <select>.
 * 
 * Props:
 *   value: current value (string|null)
 *   onChange: (value: string|null) => void
 *   options: Array<string | { value, label, icon?, group? }>
 *   placeholder: string shown when no value selected
 *   groups?: Array<{ key, label }> — optional group definitions for grouped display
 */
export default function SoftSelect({ value, onChange, options = [], placeholder = 'All', groups }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  // Normalize options
  const normalizedOptions = options.map(opt =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );

  const selectedLabel = normalizedOptions.find(o => o.value === value)?.label || placeholder;

  const handleSelect = (val) => {
    onChange(val);
    setIsOpen(false);
  };

  // Group options if groups are provided
  const renderOptions = () => {
    if (groups && groups.length > 0) {
      return groups.map(group => {
        const groupOpts = normalizedOptions.filter(o => o.group === group.key);
        if (groupOpts.length === 0) return null;
        return (
          <div key={group.key} className="soft-select-group">
            <div className="soft-select-group-label">{group.label}</div>
            {groupOpts.map(opt => (
              <button
                key={opt.value}
                className={`soft-select-option ${value === opt.value ? 'selected' : ''}`}
                onClick={() => handleSelect(opt.value)}
              >
                {opt.icon && <span className="option-icon">{opt.icon}</span>}
                <span className="option-label">{opt.label}</span>
              </button>
            ))}
          </div>
        );
      });
    }

    return normalizedOptions.map(opt => (
      <button
        key={opt.value}
        className={`soft-select-option ${value === opt.value ? 'selected' : ''}`}
        onClick={() => handleSelect(opt.value)}
      >
        {opt.icon && <span className="option-icon">{opt.icon}</span>}
        <span className="option-label">{opt.label}</span>
      </button>
    ));
  };

  return (
    <div className="soft-select-container" ref={containerRef}>
      <button
        className={`soft-select-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <span className="trigger-label">{selectedLabel}</span>
        <svg className="trigger-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className="soft-select-dropdown">
          {/* "All" / Reset option */}
          <button
            className={`soft-select-option ${value === null || value === '' ? 'selected' : ''}`}
            onClick={() => handleSelect(null)}
          >
            <span className="option-label">{placeholder}</span>
          </button>
          <div className="soft-select-divider" />
          {renderOptions()}
        </div>
      )}
    </div>
  );
}
