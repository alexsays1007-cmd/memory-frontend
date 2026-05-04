import './EmptyState.css';

export default function EmptyState({ message = 'No data found', icon = '📭' }) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon">{icon}</span>
      <p className="empty-state-message">{message}</p>
    </div>
  );
}
