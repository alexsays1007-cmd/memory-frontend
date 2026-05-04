import { useState, useCallback } from 'react';
import './SearchInput.css';

export default function SearchInput({ value, onChange, placeholder = 'Search...' }) {
  const [localValue, setLocalValue] = useState(value || '');

  const handleChange = useCallback((e) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    onChange?.(newValue);
  }, [onChange]);

  const handleClear = useCallback(() => {
    setLocalValue('');
    onChange?.('');
  }, [onChange]);

  return (
    <div className="search-input-wrapper">
      <span className="search-icon">🔍</span>
      <input
        type="text"
        className="search-input"
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder}
      />
      {localValue && (
        <button className="search-clear" onClick={handleClear} type="button">
          ✕
        </button>
      )}
    </div>
  );
}
