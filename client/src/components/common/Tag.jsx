import './Tag.css';

export default function Tag({ children, color, onClick, active }) {
  return (
    <span
      className={`tag ${active ? 'tag-active' : ''} ${onClick ? 'tag-clickable' : ''}`}
      style={color ? { '--tag-color': color } : undefined}
      onClick={onClick}
    >
      {children}
    </span>
  );
}
