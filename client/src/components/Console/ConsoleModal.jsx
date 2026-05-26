import { useEffect, useMemo, useState } from 'react';
import { getUsage } from '../../api/usage.js';
import './ConsoleModal.css';

const tabs = [
  { id: 'usage', label: 'Usage' },
  { id: 'forge', label: 'Forge' },
];

function IconButton({ label, children, onClick, disabled }) {
  return (
    <button className="console-icon-button" type="button" onClick={onClick} aria-label={label} title={label} disabled={disabled}>
      {children}
    </button>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 0 1-15.5 6.2" />
      <path d="M3 12A9 9 0 0 1 18.5 5.8" />
      <path d="M18.5 2.8v3h-3" />
      <path d="M5.5 21.2v-3h3" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  );
}

function formatPercent(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'unknown';
  return `${Number(value).toFixed(digits).replace(/\.0+$/, '')}%`;
}

function formatCountdown(seconds) {
  if (seconds === null || seconds === undefined) return 'unknown';
  const total = Math.max(0, Number(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function statusLabel(status) {
  if (status === 'over_pace') return 'over pace';
  if (status === 'watch') return 'near pace';
  if (status === 'quiet') return 'within pace';
  return 'unknown';
}

function ProviderCard({ provider }) {
  const [selectedDay, setSelectedDay] = useState(null);
  const session = provider.session || {};
  const weekly = provider.weekly || {};
  const pace = weekly.pace || {};
  const historyByDay = useMemo(() => {
    const map = new Map();
    (weekly.paceHistory || []).forEach(item => map.set(Number(item.cycleDay), item));
    return map;
  }, [weekly.paceHistory]);

  const currentDay = Number(pace.cycleDay || 0);
  const weeklyUsed = weekly.usedPercent;
  const paceLimit = pace.cumulativePacePercent;
  const selectedHistory = selectedDay ? historyByDay.get(selectedDay) : null;

  return (
    <section className={`usage-card usage-card-${provider.id || 'unknown'} ${provider.warning ? 'warning' : ''}`}>
      <div className="usage-card-head">
        <div>
          <h3>{provider.name}</h3>
          <p>{provider.available ? 'limits online' : 'waiting for signal'}</p>
        </div>
        <div className="usage-flags">
          {provider.stale && <span className="usage-flag">cached</span>}
          {provider.warning && <span className="usage-flag warning">limit</span>}
        </div>
      </div>

      <UsageBar
        label="Current session"
        value={session.usedPercent}
        detail={session.resetsInSeconds !== null && session.resetsInSeconds !== undefined
          ? `resets in ${formatCountdown(session.resetsInSeconds)}`
          : 'waiting for next window'}
      />

      <UsageBar
        label="Weekly limits"
        value={weeklyUsed}
        detail={weekly.resetsInSeconds !== null && weekly.resetsInSeconds !== undefined
          ? `resets in ${formatCountdown(weekly.resetsInSeconds)}`
          : 'reset time unknown'}
      />

      <div className={`pace-panel pace-${pace.status || 'unknown'}`}>
        <div className="pace-copy">
          <span>Pace</span>
          <strong>
            {formatPercent(weeklyUsed, 1)} / {formatPercent(paceLimit, 1)}
          </strong>
          <em>{statusLabel(pace.status)}</em>
        </div>
        <div className="pace-dots" aria-label={`${provider.name} weekly pace history`}>
          {Array.from({ length: 7 }, (_, index) => {
            const day = index + 1;
            const item = historyByDay.get(day);
            const state = item?.status || (day > currentDay ? 'future' : 'missing');
            const isToday = day === currentDay;
            const label = item
              ? `Day ${day}: ${formatPercent(item.usedPercent, 1)} / ${formatPercent(item.cumulativePacePercent, 1)} ${statusLabel(item.status)}`
              : `Day ${day}`;
            return (
              <button
                key={day}
                type="button"
                className={`pace-dot ${state} ${isToday ? 'today' : ''}`}
                title={label}
                aria-label={label}
                onClick={() => setSelectedDay(prev => prev === day ? null : day)}
              />
            );
          })}
        </div>
        {selectedHistory && (
          <div className="pace-detail">
            Day {selectedHistory.cycleDay}: {formatPercent(selectedHistory.usedPercent, 1)} / {formatPercent(selectedHistory.cumulativePacePercent, 1)} · {statusLabel(selectedHistory.status)}
          </div>
        )}
      </div>

      {provider.error && <p className="usage-error">{provider.error}</p>}
    </section>
  );
}

function UsageBar({ label, value, detail }) {
  const known = value !== null && value !== undefined && !Number.isNaN(Number(value));
  const width = known ? Math.max(0, Math.min(100, Number(value))) : 0;

  return (
    <div className={`usage-meter ${known ? '' : 'unknown'}`}>
      <div className="usage-meter-row">
        <span>{label}</span>
        <strong>{known ? formatPercent(value) : 'unknown'}</strong>
      </div>
      <div className="usage-track" aria-hidden="true">
        <div className="usage-fill" style={{ width: `${width}%` }} />
      </div>
      <small>{detail}</small>
    </div>
  );
}

function UsagePanel({ usage, loading, error }) {
  if (loading && !usage) {
    return <div className="console-empty">Loading usage...</div>;
  }

  if (error && !usage) {
    return <div className="console-empty error">{error}</div>;
  }

  return (
    <div className="usage-panel">
      <div className="usage-summary">
        <span>{usage?.mock ? 'preview data' : 'live data'}</span>
        <time>{usage?.updatedAt ? new Date(usage.updatedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'unknown'}</time>
      </div>
      {(usage?.providers || []).map(provider => (
        <ProviderCard key={provider.id} provider={provider} />
      ))}
    </div>
  );
}

function ForgePanel() {
  return (
    <div className="forge-console-panel">
      <section className="forge-console-card">
        <span>Manual Forge</span>
        <h3>Ready for controls</h3>
        <p>Forge actions will live here after the usage panel is settled. Dangerous actions will stay behind confirmation.</p>
      </section>
      <section className="forge-console-card soft">
        <span>Runtime</span>
        <h3>Quiet by default</h3>
        <p>This tab is only a shell for now, so it will not restart or touch any production service.</p>
      </section>
    </div>
  );
}

export default function ConsoleModal({ open, onClose }) {
  const [activeTab, setActiveTab] = useState('usage');
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function refreshUsage() {
    setLoading(true);
    setError('');
    try {
      const data = await getUsage();
      setUsage(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    refreshUsage();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="console-overlay" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="console-dialog" role="dialog" aria-modal="true" aria-labelledby="console-title">
        <header className="console-header">
          <div>
            <h2 id="console-title">控制台</h2>
            <p>SYSTEM CONSOLE</p>
          </div>
          <div className="console-actions">
            <IconButton label="Refresh usage" onClick={refreshUsage} disabled={loading}>
              <RefreshIcon />
            </IconButton>
            <IconButton label="Close console" onClick={onClose}>
              <XIcon />
            </IconButton>
          </div>
        </header>

        <div className="console-tabs" role="tablist" aria-label="Console sections">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              className={`console-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={activeTab === tab.id}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="console-content">
          {activeTab === 'usage' ? (
            <UsagePanel usage={usage} loading={loading} error={error} />
          ) : (
            <ForgePanel />
          )}
        </div>
      </section>
    </div>
  );
}
