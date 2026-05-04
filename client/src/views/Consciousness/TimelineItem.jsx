import './TimelineItem.css';

const actionColors = {
  '叫醒': '#9B8EA8',
  '巡逻': '#8CB89C',
  '反思': '#E8C4A0',
  '记录': '#8AACB8',
  'default': '#B8B0B8',
};

export default function TimelineItem({ item, isLast }) {
  const color = actionColors[item.action_type] || actionColors.default;

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const formatDuration = (minutes) => {
    if (!minutes) return '';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <div className="timeline-item">
      <div className="timeline-dot-wrapper">
        <div
          className="timeline-dot"
          style={{ backgroundColor: color }}
        />
        {!isLast && <div className="timeline-line" />}
      </div>

      <div className="timeline-content">
        <div className="timeline-header">
          <span className="timeline-time">{formatTime(item.created_at)}</span>
          <span
            className="timeline-action-type"
            style={{ backgroundColor: color }}
          >
            {item.action_type}
          </span>
          {item.duration_minutes > 0 && (
            <span className="timeline-duration">
              {formatDuration(item.duration_minutes)}
            </span>
          )}
        </div>

        <div className="timeline-body">
          {item.emoji && <span className="timeline-emoji">{item.emoji}</span>}
          <p className="timeline-summary">{item.summary}</p>
        </div>
      </div>
    </div>
  );
}
