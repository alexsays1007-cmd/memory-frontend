import { useEffect, useMemo, useState } from 'react';
import { getForgeStatus, manualForgeCutover, runForgeCheck, saveForgeConfig } from '../../api/forge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import './ForgePage.css';

function formatTokens(value) {
  const n = Number(value || 0);
  if (!n) return 'unknown';
  return `${Math.round(n / 1000)}k`;
}

function shortId(value = '') {
  return value ? `${value.slice(0, 8)}...${value.slice(-6)}` : 'unknown';
}

export default function ForgePage() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    enabled: true,
    notifyOnly: false,
    retainTokens: 80000,
    warnTokens: 120000,
    autoTokens: 155000,
    cooldownMinutes: 180,
    telegramNotifications: true,
  });

  const usedRatio = useMemo(() => {
    const used = Number(status?.state?.last_used_tokens || 0);
    const auto = Number(form.autoTokens || 1);
    return Math.max(0, Math.min(100, Math.round((used / auto) * 100)));
  }, [status, form.autoTokens]);

  async function refresh() {
    const data = await getForgeStatus();
    setStatus(data);
    if (data.config) {
      setForm({
        enabled: Boolean(data.config.enabled),
        notifyOnly: Boolean(data.config.notify_only),
        retainTokens: data.config.retain_tokens || 80000,
        warnTokens: data.config.warn_tokens || 120000,
        autoTokens: data.config.auto_tokens || 155000,
        cooldownMinutes: data.config.cooldown_minutes || 180,
        telegramNotifications: data.config.telegram_notifications !== false,
      });
    }
  }

  useEffect(() => {
    refresh()
      .catch(error => setMessage(error.message))
      .finally(() => setLoading(false));
  }, []);

  function updateField(name, value) {
    setForm(prev => ({ ...prev, [name]: value }));
  }

  async function handleSave() {
    setBusy('save');
    setMessage('');
    try {
      const data = await saveForgeConfig(form);
      setStatus(data);
      setMessage('Saved. The monitor will use these settings on the next check.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy('');
    }
  }

  async function handleCheck() {
    setBusy('check');
    setMessage('');
    try {
      const data = await runForgeCheck();
      setStatus(data);
      setMessage('Checked once. No manual cutover was requested.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy('');
    }
  }

  async function handleManualCutover() {
    const ok = window.confirm('Manual Forge will restart Telegram Claude into a new session. Continue?');
    if (!ok) return;
    setBusy('manual');
    setMessage('');
    try {
      const data = await manualForgeCutover(form.retainTokens);
      setStatus(prev => ({ ...prev, ...data }));
      setMessage(`Manual Forge finished. New session: ${data.lastRun?.new_session_id || 'unknown'}`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy('');
    }
  }

  if (loading) {
    return <LoadingSpinner message="Loading Forge status..." />;
  }

  return (
    <div className="forge-page">
      <section className="forge-hero">
        <div>
          <p className="forge-kicker">Telegram Claude</p>
          <h2>Forge 控制台</h2>
          <p>看当前上下文、调自动阈值，也可以手动切一次新 session。</p>
        </div>
        <button className="forge-soft-button" onClick={handleCheck} disabled={Boolean(busy)}>
          {busy === 'check' ? 'Checking...' : 'Run check'}
        </button>
      </section>

      <section className="forge-status-grid">
        <div className="forge-panel">
          <span>当前 session</span>
          <strong>{shortId(status?.state?.last_session_id)}</strong>
          <small>{status?.state?.last_transcript_source || 'unknown source'}</small>
        </div>
        <div className="forge-panel">
          <span>当前用量</span>
          <strong>{formatTokens(status?.state?.last_used_tokens)}</strong>
          <small>自动阈值 {formatTokens(form.autoTokens)}</small>
        </div>
        <div className="forge-panel">
          <span>自动任务</span>
          <strong>{status?.service?.timerActive || 'unknown'}</strong>
          <small>{status?.service?.timerEnabled || 'unknown'}</small>
        </div>
      </section>

      <div className="forge-progress">
        <div style={{ width: `${usedRatio}%` }} />
      </div>

      <section className="forge-settings">
        <label className="forge-toggle">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={event => updateField('enabled', event.target.checked)}
          />
          <span>启用自动 Forge</span>
        </label>
        <label className="forge-toggle">
          <input
            type="checkbox"
            checked={form.notifyOnly}
            onChange={event => updateField('notifyOnly', event.target.checked)}
          />
          <span>只提醒，不自动切</span>
        </label>
        <label className="forge-toggle">
          <input
            type="checkbox"
            checked={form.telegramNotifications}
            onChange={event => updateField('telegramNotifications', event.target.checked)}
          />
          <span>Telegram 提醒</span>
        </label>

        <div className="forge-number-grid">
          <label>
            <span>保留 tokens</span>
            <input type="number" min="30000" max="140000" step="5000" value={form.retainTokens} onChange={event => updateField('retainTokens', Number(event.target.value))} />
          </label>
          <label>
            <span>提醒阈值</span>
            <input type="number" min="50000" max="190000" step="5000" value={form.warnTokens} onChange={event => updateField('warnTokens', Number(event.target.value))} />
          </label>
          <label>
            <span>自动切换阈值</span>
            <input type="number" min="60000" max="195000" step="5000" value={form.autoTokens} onChange={event => updateField('autoTokens', Number(event.target.value))} />
          </label>
          <label>
            <span>冷却分钟</span>
            <input type="number" min="15" max="1440" step="15" value={form.cooldownMinutes} onChange={event => updateField('cooldownMinutes', Number(event.target.value))} />
          </label>
        </div>
      </section>

      <section className="forge-actions">
        <button onClick={handleSave} disabled={Boolean(busy)}>
          {busy === 'save' ? 'Saving...' : '保存设置'}
        </button>
        <button className="danger" onClick={handleManualCutover} disabled={Boolean(busy)}>
          {busy === 'manual' ? 'Forging...' : '手动 Forge 并切换'}
        </button>
      </section>

      {message && <p className="forge-message">{message}</p>}
    </div>
  );
}
