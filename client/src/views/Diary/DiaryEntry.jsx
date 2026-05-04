import { formatTime } from '../../utils/date';
import './DiaryEntry.css';

export default function DiaryEntry({ entry }) {


  return (
    <article className="diary-entry">
      <div className="diary-entry-header">
        {entry.agent && (
          <span className="diary-meta">
            <span className="meta-label">Agent:</span> {entry.agent}
          </span>
        )}
        {entry.channel && (
          <span className="diary-meta">
            <span className="meta-label">Channel:</span> {entry.channel}
          </span>
        )}
        <span className="diary-time">{formatTime(entry.created)}</span>
      </div>

      <div className="diary-content">
        {entry.content}
      </div>
    </article>
  );
}
