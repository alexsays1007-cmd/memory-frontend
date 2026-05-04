import { formatTime } from '../../utils/date';
import './TimelineItem.css';

const actionColors = {
  '叫醒': '#A296AC', // soft purple
  '巡逻': '#9CBF9D', // soft green
  '写入': '#8F9CA8', // blue-gray
  '记录': '#8F9CA8', // blue-gray
  '系统': '#B09E8C', // taupe-gold
  '对话': '#C0A0A7', // dusty pink
  'default': '#B8B0B8',
};

/**
 * Determine the buddy icon for a pulse log entry.
 * 小烬 (buddy dragon) gets 🐾 for wake/patrol.
 * Returns { icon, isBuddy } where isBuddy adds special styling.
 */
function getPulseIcon(item) {
  const actor = (item.actor || item.agent || item.source || '').toLowerCase();
  const isBuddy = actor.includes('小烬') || actor.includes('buddy');
  const type = item.action_type;

  // Buddy entries always get paw
  if (isBuddy) return { icon: '🐾', isBuddy: true };

  // Action type mapping
  const iconMap = {
    '巡逻': '🐾',
    '叫醒': '🐾',
    '写入': '✎',
    '记录': '📋',
    '系统': '✺',
    '对话': '💬',
  };

  return { icon: iconMap[type] || null, isBuddy: false };
}

export default function TimelineItem({ item, isLast }) {
  const color = actionColors[item.action_type] || actionColors.default;
  const { icon: pulseIcon, isBuddy } = getPulseIcon(item);

  const formatDuration = (minutes) => {
    if (!minutes) return '';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // We group by date in ConsciousnessPage, but we still format time safely.
  const displayTime = formatTime(item.created_at || item.created || item.timestamp);

  return (
    <div className="timeline-item">
      <div className="timeline-dot-wrapper">
        <div
          className="timeline-dot"
          style={{ backgroundColor: color }}
        />
      </div>

      <div className="timeline-content">
        <div className="timeline-header">
          {pulseIcon && (
            <span className={`pulse-icon ${isBuddy ? 'buddy' : ''}`} title={isBuddy ? '小烬' : item.action_type}>
              {pulseIcon}
            </span>
          )}
          <span className="timeline-time">{displayTime}</span>
          <span
            className="timeline-action-type"
            style={{ backgroundColor: color }}
          >
            {item.action_type}
          </span>
          {item.actor && (
            <span className="timeline-actor">{item.actor}</span>
          )}
          {item.duration_minutes > 0 && (
            <span className="timeline-duration">
              {formatDuration(item.duration_minutes)}
            </span>
          )}
        </div>

        <div className="timeline-body">
          <p className="timeline-summary">{item.summary}</p>
        </div>
      </div>
    </div>
  );
}
