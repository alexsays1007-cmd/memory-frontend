import './Select.css';

export default function Select({ value, onChange, options, placeholder = 'All' }) {
  return (
    <select
      className="select"
      value={value || ''}
      onChange={(e) => onChange?.(e.target.value || null)}
    >
      <option value="">{placeholder}</option>
      {options.map(opt => (
        <option key={opt.value || opt} value={opt.value || opt}>
          {opt.label || opt}
        </option>
      ))}
    </select>
  );
}
