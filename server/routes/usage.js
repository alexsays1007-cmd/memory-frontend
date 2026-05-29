import { Router } from "express";
import { execFile } from "child_process";
import { readFileSync } from "fs";
import { requireReadAccess } from "../middleware/readAuth.js";

const router = Router();
const PYTHON = "/usr/bin/python3";
const SCRIPT = "/home/claude/sqlite-viewer-release-v1/server/scripts/usage_reader.py";
const HISTORY_PATH = "/home/claude/usage-reader/usage-history.json";
const DAILY_PACE = +(100 / 7).toFixed(4); // 14.2857
const RESET_AT_TOLERANCE = 5; // seconds — matches usage_reader.py

function collectNearTolerance(grouped, targetKey, tolerance = RESET_AT_TOLERANCE) {
  const target = Number(targetKey);
  if (!Number.isFinite(target)) return [];
  const merged = [];
  for (const [k, entries] of Object.entries(grouped || {})) {
    if (Math.abs(Number(k) - target) <= tolerance) {
      merged.push(...(Array.isArray(entries) ? entries : []));
    }
  }
  return merged;
}

function dedupByCycleDay(entries) {
  const seen = new Map();
  for (const e of entries) {
    const cd = e.cycleDay;
    if (cd == null) continue;
    const prev = seen.get(cd);
    if (!prev || (e.capturedAt || 0) > (prev.capturedAt || 0)) {
      seen.set(cd, e);
    }
  }
  return [...seen.values()];
}

function ts(resetAt) {
  if (!resetAt) return null;
  return new Date(resetAt * 1000).toISOString();
}

function safeNum(v) {
  return typeof v === "number" ? v : null;
}

function cycleDay(resetAt, limitWindowSeconds = 604800) {
  if (!resetAt || resetAt <= 0) return null;
  const now = Date.now() / 1000;
  const windowStart = resetAt - limitWindowSeconds;
  if (now < windowStart) return null;
  const elapsedDays = Math.floor((now - windowStart) / 86400);
  return Math.max(1, Math.min(7, elapsedDays + 1));
}

function paceStatus(usedPercent, cumulativePace) {
  if (usedPercent == null || cumulativePace == null || cumulativePace <= 0) return "unknown";
  if (usedPercent <= cumulativePace * 0.9) return "quiet";
  if (usedPercent <= cumulativePace) return "watch";
  return "over_pace";
}

function makePace(usedPercent, resetAt, limitWindowSeconds = 604800) {
  const cd = cycleDay(resetAt, limitWindowSeconds);
  if (cd == null) return { cycleDay: null, cumulativePacePercent: null, status: "unknown" };
  const cumulative = +(cd * DAILY_PACE).toFixed(4);
  return { cycleDay: cd, cumulativePacePercent: cumulative, status: paceStatus(usedPercent, cumulative) };
}


function isWarning(session, weekly) {
  const s = session?.used_percent;
  const w = weekly?.used_percent;
  return (typeof s === "number" && s >= 90) || (typeof w === "number" && w >= 90);
}

function mapSession(w) {
  if (!w) return { usedPercent: null, resetsAt: null, resetsInSeconds: null, label: "Current session" };
  const resetsAt = ts(w.reset_at);
  return {
    usedPercent: safeNum(w.used_percent),
    resetsAt,
    resetsInSeconds: resetsAt ? safeNum(w.reset_after_seconds) : null,
    label: "Current session",
  };
}

function mapWeekly(w, provider, limitWindowSeconds = 604800) {
  if (!w) {
    return {
      usedPercent: null, resetsAt: null, resetsInSeconds: null,
      dailyPacePercent: DAILY_PACE,
      pace: { cycleDay: null, cumulativePacePercent: null, status: "unknown" },
      paceHistory: [],
      events: [],
    };
  }
  const weeklyPercent = safeNum(w.used_percent);
  const resetsAt = ts(w.reset_at);
  const resetsInSeconds = resetsAt ? safeNum(w.reset_after_seconds) : null;
  const paceObj = makePace(weeklyPercent, w.reset_at, limitWindowSeconds);

  // Load paceHistory and events from file (tolerance-based lookup)
  let paceHistory = [];
  let events = [];
  try {
    const history = JSON.parse(readFileSync(HISTORY_PATH, "utf-8"));
    const rawEntries = collectNearTolerance(history[provider], w.reset_at);
    const deduped = dedupByCycleDay(rawEntries);
    paceHistory = deduped
      .map(e => ({
        cycleDay: e.cycleDay,
        date: e.date,
        usedPercent: e.usedPercent,
        cumulativePacePercent: e.cumulativePacePercent,
        status: e.status,
        source: e.source || "live",
      }))
      .sort((a, b) => (a.cycleDay || 0) - (b.cycleDay || 0));
    const rawEvents = collectNearTolerance((history._events || {})[provider], w.reset_at);
    events = dedupByCycleDay(rawEvents).map(e => ({
      type: e.type,
      cycleDay: e.cycleDay,
      at: e.at ? new Date(e.at * 1000).toISOString() : null,
      fromUsedPercent: e.fromUsedPercent,
      toUsedPercent: e.toUsedPercent,
    }));
  } catch {}

  return {
    usedPercent: weeklyPercent,
    resetsAt,
    resetsInSeconds,
    dailyPacePercent: DAILY_PACE,
    pace: paceObj,
    paceHistory,
    events,
  };
}

function mapClaude(raw) {
  if (!raw || !raw.available) {
    return {
      id: "claude", name: "Claude Code", available: false, stale: true,
      session: mapSession(null), weekly: mapWeekly(null, "claude"),
      warning: false, error: raw?.error || "unavailable",
    };
  }
  return {
    id: "claude", name: "Claude Code",
    available: true, stale: !!raw.stale,
    session: mapSession(raw.five_hour),
    weekly: mapWeekly(raw.seven_day, "claude"),
    warning: isWarning(raw.five_hour, raw.seven_day),
    error: raw.error || null,
  };
}

function mapCodex(raw) {
  if (!raw || !raw.available) {
    return {
      id: "codex", name: "Codex", available: false, stale: true,
      session: mapSession(null), weekly: mapWeekly(null, "codex"),
      warning: false, error: raw?.error || "unavailable",
    };
  }
  const primary = raw.primary || null;
  const secondary = raw.secondary || null;
  return {
    id: "codex", name: "Codex",
    available: true, stale: !!raw.stale,
    session: mapSession(primary),
    weekly: mapWeekly(secondary, "codex", secondary?.limit_window_seconds || 604800),
    warning: isWarning(raw.primary, raw.secondary),
    error: raw.error || null,
  };
}

function fetchUsage() {
  return new Promise((resolve, reject) => {
    execFile(PYTHON, [SCRIPT], { timeout: 15000 }, (err, stdout, stderr) => {
      if (err) return reject(err);
      try { resolve(JSON.parse(stdout)); }
      catch (e) { reject(new Error("JSON parse: " + stdout.slice(0, 200))); }
    });
  });
}

router.get("/", requireReadAccess, async (req, res) => {
  try {
    const raw = await fetchUsage();
    res.json({
      ok: true,
      updatedAt: new Date().toISOString(),
      providers: [mapClaude(raw.claude), mapCodex(raw.codex)],
    });
  } catch (err) {
    console.error("[usage] error:", err.message);
    res.status(500).json({
      ok: false, updatedAt: new Date().toISOString(),
      providers: [mapClaude(null), mapCodex(null)],
      error: "Failed to fetch usage data",
    });
  }
});

export default router;
