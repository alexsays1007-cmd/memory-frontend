import { useEffect, useMemo, useState } from 'react';
import { getForgeStatus, saveForgeConfig } from '../../api/forge.js';
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

function refreshEventsFor(weekly) {
  return (weekly?.events || []).filter(event => event?.type === 'quota_refresh_in_cycle');
}

function ProviderCard({ provider }) {
  const [selectedDay, setSelectedDay] = useState(null);
  const session = provider.session || {};
  const weekly = provider.weekly || {};
  const pace = weekly.pace || {};
  const refreshEvents = refreshEventsFor(weekly);
  const refreshDays = useMemo(
    () => new Set(refreshEvents.map(event => Number(event.cycleDay)).filter(Boolean)),
    [refreshEvents]
  );
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

      {(provider.additionalLimits || []).map(limit => (
        <UsageBar
          key={limit.id || limit.label}
          label={limit.label}
          value={limit.usedPercent}
          detail={limit.resetsInSeconds !== null && limit.resetsInSeconds !== undefined
            ? `resets in ${formatCountdown(limit.resetsInSeconds)}`
            : 'reset time unknown'}
        />
      ))}

      <div className={`pace-panel pace-${pace.status || 'unknown'}`}>
        <div className="pace-copy">
          <span>
            Pace
            {refreshEvents.length > 0 && <b className="pace-event-chip">refreshed</b>}
          </span>
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
            const hasRefresh = refreshDays.has(day);
            const label = item
              ? `Day ${day}: ${formatPercent(item.usedPercent, 1)} / ${formatPercent(item.cumulativePacePercent, 1)} ${statusLabel(item.status)}${hasRefresh ? ' · refreshed' : ''}`
              : `Day ${day}`;
            return (
              <button
                key={day}
                type="button"
                className={`pace-dot ${state} ${isToday ? 'today' : ''} ${hasRefresh ? 'refreshed' : ''}`}
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
            {refreshDays.has(Number(selectedHistory.cycleDay)) ? ' · refreshed' : ''}
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

function formatTokens(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 'unknown';
  return `${Math.round(n / 1000)}k`;
}

function formatTime(value) {
  if (!value) return 'unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function shortSession(value = '') {
  return value ? `${value.slice(0, 8)}...${value.slice(-6)}` : 'unknown';
}

function ForgeNumberField({ label, hint, value, min, max, step, onChange }) {
  return (
    <label className="forge-field">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={event => onChange(Number(event.target.value))}
      />
      <small>{hint}</small>
    </label>
  );
}

function ForgePanel({ refreshSignal = 0 }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [panelUpdatedAt, setPanelUpdatedAt] = useState('');
  const [form, setForm] = useState({
    enabled: true,
    notifyOnly: false,
    retainTokens: 160000,
    warnTokens: 260000,
    autoTokens: 360000,
    cooldownMinutes: 180,
    telegramNotifications: true,
  });

  const usedTokens = Number(status?.state?.last_used_tokens || 0);
  const autoTokens = Number(form.autoTokens || 1);
  const usedRatio = Math.max(0, Math.min(100, Math.round((usedTokens / autoTokens) * 100)));

  async function refreshForge({ quiet = false } = {}) {
    if (!quiet) {
      setLoading(true);
      setMessage('');
    }
    try {
      const data = await getForgeStatus();
      setStatus(data);
      setPanelUpdatedAt(new Date().toISOString());
      if (data.config) {
        setForm({
          enabled: Boolean(data.config.enabled),
          notifyOnly: Boolean(data.config.notify_only),
          retainTokens: data.config.retain_tokens || 160000,
          warnTokens: data.config.warn_tokens || 260000,
          autoTokens: data.config.auto_tokens || 360000,
          cooldownMinutes: data.config.cooldown_minutes || 180,
          telegramNotifications: data.config.telegram_notifications !== false,
        });
      }
    } catch (err) {
      if (!quiet) setMessage(err.message);
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage('');
    try {
      const data = await saveForgeConfig(form);
      setStatus(data);
      setMessage('已保存。这里只改配置，不会重启 Telegram Claude。');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    refreshForge();
    const timer = window.setInterval(() => {
      refreshForge({ quiet: true });
    }, 30000);
    return () => window.clearInterval(timer);
  }, [refreshSignal]);

  return (
    <div className="forge-console-panel">
      <section className="forge-console-card forge-live-card">
        <div className="forge-card-head">
          <div>
            <span>Forge 状态</span>
            <h3>{loading ? '正在读取' : (form.enabled ? '自动 Forge 开着' : '自动 Forge 关着')}</h3>
            <p>当前上下文会每 30 秒自动刷新一次。</p>
          </div>
          <button className="forge-mini-button" type="button" onClick={refreshForge} disabled={loading || saving}>
            刷新
          </button>
        </div>

        <div className="forge-stat-grid">
          <div>
            <small>当前上下文</small>
            <strong>{formatTokens(usedTokens)}</strong>
            <em>{usedRatio}% / 自动 Forge 点</em>
          </div>
          <div>
            <small>提醒点</small>
            <strong>{formatTokens(form.warnTokens)}</strong>
            <em>快到这里时提醒你</em>
          </div>
          <div>
            <small>自动 Forge 点</small>
            <strong>{formatTokens(form.autoTokens)}</strong>
            <em>到这里才自动搬家</em>
          </div>
          <div>
            <small>保留尾巴</small>
            <strong>{formatTokens(form.retainTokens)}</strong>
            <em>新 session 带走多少旧上下文</em>
          </div>
        </div>

        <div className="forge-progress-track" aria-label="当前上下文占自动 Forge 点的比例">
          <div style={{ width: `${usedRatio}%` }} />
        </div>

        <div className="forge-meta-row">
          <span>Session: {shortSession(status?.state?.last_session_id)}</span>
          <span>Forge 检查: {formatTime(status?.state?.last_checked_at)}</span>
          <span>面板刷新: {formatTime(panelUpdatedAt)}</span>
        </div>
      </section>

      <section className="forge-console-card">
        <span>Forge 设置</span>
        <div className="forge-form-grid">
          <ForgeNumberField
            label="提醒点"
            hint="到这个上下文长度时提醒你"
            value={form.warnTokens}
            min="50000"
            max="800000"
            step="5000"
            onChange={value => setForm(prev => ({ ...prev, warnTokens: value }))}
          />
          <ForgeNumberField
            label="自动 Forge 点"
            hint="到这个长度才自动切新 session"
            value={form.autoTokens}
            min="60000"
            max="900000"
            step="5000"
            onChange={value => setForm(prev => ({ ...prev, autoTokens: value }))}
          />
          <ForgeNumberField
            label="新 session 保留尾巴"
            hint="Forge 后带过去的最近上下文"
            value={form.retainTokens}
            min="30000"
            max="300000"
            step="5000"
            onChange={value => setForm(prev => ({ ...prev, retainTokens: value }))}
          />
          <ForgeNumberField
            label="冷却时间"
            hint="两次自动 Forge 之间至少隔多久"
            value={form.cooldownMinutes}
            min="15"
            max="1440"
            step="15"
            onChange={value => setForm(prev => ({ ...prev, cooldownMinutes: value }))}
          />
        </div>

        <div className="forge-toggle-row">
          <label>
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={event => setForm(prev => ({ ...prev, enabled: event.target.checked }))}
            />
            <span>允许自动 Forge</span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.notifyOnly}
              onChange={event => setForm(prev => ({ ...prev, notifyOnly: event.target.checked }))}
            />
            <span>只提醒，不自动切</span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.telegramNotifications}
              onChange={event => setForm(prev => ({ ...prev, telegramNotifications: event.target.checked }))}
            />
            <span>Telegram 提醒</span>
          </label>
        </div>

        <div className="forge-save-row">
          <p>保存只会改 Forge 配置，不会重启 Claude，也不会切 session。</p>
          <button type="button" onClick={handleSave} disabled={loading || saving}>
            {saving ? '保存中...' : '保存 Forge 设置'}
          </button>
        </div>

        {message && <p className={`forge-console-message ${message.includes('已保存') ? 'ok' : 'error'}`}>{message}</p>}
      </section>
    </div>
  );
}

export default function ConsoleModal({ open, onClose }) {
  const [activeTab, setActiveTab] = useState('usage');
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgeRefreshSignal, setForgeRefreshSignal] = useState(0);

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

  function refreshActiveTab() {
    if (activeTab === 'forge') {
      setForgeRefreshSignal(value => value + 1);
      return;
    }
    refreshUsage();
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
            <IconButton label="Refresh" onClick={refreshActiveTab} disabled={loading}>
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
            <ForgePanel refreshSignal={forgeRefreshSignal} />
          )}
        </div>
      </section>
    </div>
  );
}
