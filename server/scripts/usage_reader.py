#!/usr/bin/env python3
"""
Usage reader: Codex (API) + Claude (statusLine file).
Pure stdlib, no external deps. Returns sanitized data only.
"""
import json, os, sys, time, urllib.request
from datetime import datetime, timezone

HOME = os.path.expanduser("~")
HISTORY_PATH = os.path.join(HOME, "usage-reader", "usage-history.json")
DAILY_PACE = round(100 / 7, 4)  # 14.2857
REFRESH_DROP_THRESHOLD = 20  # percent
RESET_AT_TOLERANCE = 5  # seconds

# ── helpers ──────────────────────────────────────────────────

def _recompute(window, drop_expired=False):
    if not isinstance(window, dict):
        return None
    out = dict(window)
    reset_at = int(out.get("reset_at") or 0)
    if reset_at > 0:
        remaining = max(0, int(reset_at - time.time()))
        if drop_expired and remaining <= 0:
            return None
        out["reset_after_seconds"] = remaining
    return out

def _safe_int(v, default=0):
    try:
        return int(v)
    except (TypeError, ValueError):
        return default


def _codex_windows(codex):
    """Return (session, weekly), tolerating Codex moving weekly into primary."""
    windows = [
        window for window in (codex.get("primary"), codex.get("secondary"))
        if isinstance(window, dict) and window.get("reset_at")
    ]
    weekly = next(
        (window for window in windows if _safe_int(window.get("limit_window_seconds")) >= 6 * 86400),
        None,
    )
    session = next((window for window in windows if window is not weekly), None)
    return session or weekly, weekly

def _cycle_day(reset_at, limit_window_seconds=604800):
    """Compute day-of-cycle (1-7) from window reset_at and duration."""
    if not reset_at or reset_at <= 0:
        return None
    now = time.time()
    window_start = reset_at - limit_window_seconds
    if now < window_start:
        return None
    elapsed_days = int((now - window_start) / 86400)
    return max(1, min(7, elapsed_days + 1))

def _pace_status(used_percent, cumulative_pace):
    if used_percent is None or cumulative_pace is None or cumulative_pace <= 0:
        return "unknown"
    if used_percent <= cumulative_pace * 0.9:
        return "quiet"
    if used_percent <= cumulative_pace:
        return "watch"
    return "over_pace"

def _today_str():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")

def _make_pace(used_percent, reset_at, limit_window_seconds=604800):
    """Build the pace object for a weekly window."""
    cd = _cycle_day(reset_at, limit_window_seconds)
    if cd is None:
        return {"cycleDay": None, "cumulativePacePercent": None, "status": "unknown"}
    cumulative = round(cd * DAILY_PACE, 4)
    status = _pace_status(used_percent, cumulative)
    return {"cycleDay": cd, "cumulativePacePercent": cumulative, "status": status}

def _find_canonical_key(existing_keys, target, tolerance=RESET_AT_TOLERANCE):
    """If any existing key is within tolerance of target, return that key.
    Otherwise return str(target). Prefers the numerically smallest (earliest) key."""
    target_int = int(target)
    candidates = []
    for k in existing_keys:
        try:
            diff = abs(int(k) - target_int)
            if diff <= tolerance:
                candidates.append(k)
        except (ValueError, TypeError):
            continue
    if candidates:
        return min(candidates, key=lambda x: int(x))
    return str(target_int)

# ── history (paceHistory persistence) ────────────────────────

def _load_history():
    try:
        with open(HISTORY_PATH, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def _save_history(data):
    try:
        os.makedirs(os.path.dirname(HISTORY_PATH), exist_ok=True)
        tmp = HISTORY_PATH + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.chmod(tmp, 0o600)
        os.replace(tmp, HISTORY_PATH)
    except Exception:
        pass

def _dedup_cycle_days(day_entries):
    """Remove duplicate entries with the same cycleDay, keeping the most recent."""
    seen = {}
    for e in day_entries:
        cd = e.get("cycleDay")
        if cd is None:
            continue
        prev = seen.get(cd)
        if prev is None or e.get("capturedAt", 0) > prev.get("capturedAt", 0):
            seen[cd] = e
    day_entries[:] = list(seen.values())

def _collect_entries_near_key(provider_cycles, target_key, tolerance=RESET_AT_TOLERANCE):
    """Collect entries from all groups within tolerance of target_key."""
    target_int = int(target_key)
    merged = []
    for k, entries in provider_cycles.items():
        try:
            if abs(int(k) - target_int) <= tolerance:
                merged.extend(entries)
        except (ValueError, TypeError):
            continue
    return merged

def _check_quota_refresh(history, provider, canonical_key, new_used_percent, new_reset_at, source):
    """Compare with most recent previous snapshot; record event if big drop.

    Only triggers for source="live" to avoid false positives from stale cache data.
    Returns the event dict if a refresh was detected, else None.
    """
    if source != "live":
        return None

    provider_cycles = history.get(provider, {})
    entries = _collect_entries_near_key(provider_cycles, canonical_key)
    if not entries:
        return None

    # Find most recent snapshot by capturedAt
    latest = max(entries, key=lambda e: e.get("capturedAt") or 0)
    prev_pct = latest.get("usedPercent")
    prev_ra = latest.get("weeklyResetAt")

    if prev_pct is None or prev_ra is None:
        return None
    # Use tolerance for cycle match
    if abs(int(prev_ra) - int(new_reset_at)) > RESET_AT_TOLERANCE:
        return None

    drop = prev_pct - new_used_percent
    if drop < REFRESH_DROP_THRESHOLD:
        return None

    cd = _cycle_day(new_reset_at, 604800)
    return {
        "type": "quota_refresh_in_cycle",
        "cycleDay": cd,
        "at": int(time.time()),
        "fromUsedPercent": prev_pct,
        "toUsedPercent": new_used_percent,
        "source": source,
    }

def _merge_nearby_keys(provider_cycles, canonical_key, tolerance=RESET_AT_TOLERANCE):
    """Merge entries from all keys within tolerance into canonical_key. Deletes absorbed keys."""
    canonical_int = int(canonical_key)
    to_merge = []
    for k in list(provider_cycles.keys()):
        if k == canonical_key:
            continue
        try:
            if abs(int(k) - canonical_int) <= tolerance:
                to_merge.append(k)
        except (ValueError, TypeError):
            continue
    if not to_merge:
        return
    target = provider_cycles.setdefault(canonical_key, [])
    for k in to_merge:
        target.extend(provider_cycles.pop(k, []))

def _record_snapshot(history, provider, weekly_used_percent, weekly_reset_at, source="live"):
    """Record today's weekly usage snapshot for paceHistory. Modifies history in-place."""
    if weekly_used_percent is None or not weekly_reset_at:
        return
    today = _today_str()
    limit_ws = 604800  # 7 days
    cd = _cycle_day(weekly_reset_at, limit_ws)

    provider_cycles = history.setdefault(provider, {})
    canonical_key = _find_canonical_key(provider_cycles.keys(), weekly_reset_at)
    _merge_nearby_keys(provider_cycles, canonical_key)
    day_entries = provider_cycles.setdefault(canonical_key, [])

    # Also merge events from nearby keys
    prov_events = history.get("_events", {}).get(provider, {})
    _merge_nearby_keys(prov_events, canonical_key)

    # Deduplicate legacy entries with same cycleDay
    _dedup_cycle_days(day_entries)

    # Check for quota refresh before updating
    event = _check_quota_refresh(history, provider, canonical_key,
                                 weekly_used_percent, weekly_reset_at, source)
    if event:
        events = history.setdefault("_events", {})
        prov_events = events.setdefault(provider, {})
        cycle_events = prov_events.setdefault(canonical_key, [])
        if not any(e.get("cycleDay") == event["cycleDay"] for e in cycle_events):
            cycle_events.append(event)

    # Find existing entry by cycleDay (not date)
    entry = None
    for e in day_entries:
        if e.get("cycleDay") == cd:
            entry = e
            break
    if entry is None:
        entry = {}
        day_entries.append(entry)

    entry["cycleDay"] = cd
    entry["date"] = today
    entry["usedPercent"] = weekly_used_percent
    entry["weeklyResetAt"] = int(weekly_reset_at)
    entry["cumulativePacePercent"] = round(cd * DAILY_PACE, 4) if cd else None
    entry["status"] = _pace_status(weekly_used_percent, entry["cumulativePacePercent"])
    entry["source"] = source
    entry["capturedAt"] = int(time.time())

def _get_pace_history(provider, weekly_reset_at, history=None):
    """Get paceHistory array for current cycle. Merges groups within tolerance."""
    if not weekly_reset_at:
        return []
    if history is None:
        history = _load_history()
    provider_cycles = history.get(provider, {})
    entries = _collect_entries_near_key(provider_cycles, str(int(weekly_reset_at)))
    _dedup_cycle_days(entries)
    return sorted(entries, key=lambda e: e.get("cycleDay") or 0)

def _get_events(provider, weekly_reset_at, history=None):
    """Get events array for current cycle. Merges groups within tolerance."""
    if not weekly_reset_at:
        return []
    if history is None:
        history = _load_history()
    target_int = int(weekly_reset_at)
    prov_events = history.get("_events", {}).get(provider, {})
    merged = []
    for k, events in prov_events.items():
        try:
            if abs(int(k) - target_int) <= RESET_AT_TOLERANCE:
                merged.extend(events)
        except (ValueError, TypeError):
            continue
    return merged

def _prune_history(data, current_reset_ats):
    """Keep only cycles whose reset_at is in current_reset_ats or the most recent past cycle.
    Uses tolerance for current-cycle matching. Also cleans _events for removed cycles."""
    for provider in ("claude", "codex"):
        cycles = data.get(provider, {})
        if not cycles:
            continue
        sorted_keys = sorted(cycles.keys(), reverse=True)
        keep = set()

        # Build set of current canonical targets (normalized against existing keys)
        current_targets = set()
        for ra in current_reset_ats.get(provider, []):
            canonical = _find_canonical_key(cycles.keys(), ra)
            current_targets.add(canonical)

        # Keep current cycle (all keys within tolerance of any current target)
        for k in cycles.keys():
            k_int = int(k)
            for ct in current_targets:
                if abs(k_int - int(ct)) <= RESET_AT_TOLERANCE:
                    keep.add(k)
                    break

        # Keep most recent past cycle not already kept
        for k in sorted_keys:
            if k not in keep:
                keep.add(k)
                break

        for k in list(cycles.keys()):
            if k not in keep:
                del cycles[k]

        # Prune _events for this provider
        events = data.get("_events", {}).get(provider, {})
        for k in list(events.keys()):
            if k not in keep:
                del events[k]

# ── Codex ────────────────────────────────────────────────────

class CodexUsageReader:
    def __init__(self):
        self._auth = os.path.join(HOME, ".codex", "auth.json")
        self._cache = os.path.join(HOME, ".codex", "usage-limits.json")
        self._mem = None
        self._mem_at = 0.0

    def _token(self):
        try:
            with open(self._auth, encoding="utf-8") as f:
                d = json.load(f)
            t = d.get("tokens") or {}
            return t.get("access_token", ""), t.get("account_id", "")
        except Exception:
            return "", ""

    def _fetch(self):
        tok, aid = self._token()
        if not tok:
            return {"available": False, "error": "no_token"}
        headers = {
            "Authorization": "Bearer " + tok,
            "OpenAI-Beta": "codex_cli",
            "User-Agent": "CcCompanion/usage-reader",
        }
        if aid:
            headers["ChatGPT-Account-ID"] = aid
        req = urllib.request.Request(
            "https://chatgpt.com/backend-api/codex/usage", headers=headers
        )
        with urllib.request.urlopen(req, timeout=12) as r:
            return json.loads(r.read())

    def _simplify(self, raw):
        def _win(w):
            if not isinstance(w, dict):
                return {}
            return {
                "used_percent": _safe_int(w.get("used_percent")),
                "limit_window_seconds": _safe_int(w.get("limit_window_seconds")),
                "reset_after_seconds": _safe_int(w.get("reset_after_seconds")),
                "reset_at": _safe_int(w.get("reset_at")),
            }

        plan = raw.get("plan_type") or raw.get("plan") or ""

        rl = raw.get("rate_limit") or {}
        primary = _win(rl.get("primary_window") or raw.get("primary"))
        secondary = _win(rl.get("secondary_window") or raw.get("secondary"))
        allowed = bool(rl.get("allowed", raw.get("allowed", True)))
        limit_reached = bool(rl.get("limit_reached", raw.get("limit_reached", False)))

        additional = []
        for item in (raw.get("additional_rate_limits") or []):
            additional.append({
                "model": item.get("model") or item.get("name") or "",
                "primary": _win(item.get("primary")),
                "secondary": _win(item.get("secondary")),
            })

        credits_raw = raw.get("credits") or {}
        credits = {
            "balance": _safe_int(credits_raw.get("balance")),
            "has_credits": bool(credits_raw.get("has_credits")),
            "overage": bool(credits_raw.get("overage_limit_reached")),
        }

        return {
            "available": True,
            "stale": False,
            "plan": plan,
            "allowed": allowed,
            "limit_reached": limit_reached,
            "primary": primary,
            "secondary": secondary,
            "additional": additional,
            "credits": credits,
        }

    def _normalize(self, d):
        out = dict(d)
        out["primary"] = _recompute(out.get("primary"))
        out["secondary"] = _recompute(out.get("secondary"))
        out["additional"] = [
            {**it, "primary": _recompute(it.get("primary")), "secondary": _recompute(it.get("secondary"))}
            for it in (out.get("additional") or [])
        ]
        return out

    def _write_cache(self, data):
        try:
            with open(self._cache, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False)
            os.chmod(self._cache, 0o600)
        except Exception:
            pass

    def _read_cache(self):
        try:
            with open(self._cache, encoding="utf-8") as f:
                d = json.load(f)
            if isinstance(d, dict) and d.get("available"):
                d["stale"] = True
                return self._normalize(d)
        except Exception:
            pass
        return None

    def get(self):
        now = time.time()
        if self._mem and now - self._mem_at < 5:
            result = self._normalize(self._mem)
            result["source"] = "live"
            return result
        try:
            raw = self._fetch()
            if not raw.get("available", True):
                raise RuntimeError(raw.get("error", "api_unavailable"))
            result = self._simplify(raw)
            result["source"] = "live"
            self._mem = result
            self._mem_at = now
            self._write_cache(result)
            return self._normalize(result)
        except Exception:
            cached = self._read_cache()
            if cached:
                cached["source"] = "cache"
                return cached
            return {"available": False, "error": "fetch_failed", "source": "none"}

# ── Claude (statusLine file) ─────────────────────────────────

class ClaudeRateLimitReader:
    def __init__(self):
        self._path = os.path.join(HOME, ".claude", "rate_limits_latest.json")
        self._max_age = 120

    def get(self):
        try:
            with open(self._path, encoding="utf-8") as f:
                d = json.load(f)
        except FileNotFoundError:
            return {"available": False, "error": "claude_statusline_not_seen_yet"}
        except Exception:
            return {"available": False, "error": "read_failed"}
        if not isinstance(d, dict) or not d.get("available"):
            return {"available": False, "error": "no_data"}
        updated_at = _safe_int(d.get("updated_at"))
        stale = updated_at <= 0 or (time.time() - updated_at) > self._max_age
        additional = []
        for item in (d.get("additional") or []):
            if not isinstance(item, dict):
                continue
            window = _recompute(item.get("window"), drop_expired=True)
            if window:
                additional.append({
                    "key": item.get("key") or "",
                    "label": item.get("label") or "",
                    "window": window,
                })
        return {
            "available": True,
            "stale": stale,
            "source": "live",
            "model": d.get("model") or "",
            "five_hour": _recompute(d.get("five_hour"), drop_expired=True),
            "seven_day": _recompute(d.get("seven_day"), drop_expired=True),
            "additional": additional,
        }

# ── combined ─────────────────────────────────────────────────

def get_all():
    claude = ClaudeRateLimitReader().get()
    codex = CodexUsageReader().get()

    history = _load_history()

    # Record daily snapshots for paceHistory
    if claude.get("available") and claude.get("seven_day"):
        _record_snapshot(history, "claude", claude["seven_day"].get("used_percent"),
                         claude["seven_day"].get("reset_at"), source=claude.get("source", "live"))
    _, codex_weekly = _codex_windows(codex)
    if codex.get("available") and codex_weekly:
        _record_snapshot(history, "codex", codex_weekly.get("used_percent"),
                         codex_weekly.get("reset_at"), source=codex.get("source", "live"))

    # Prune old cycles
    current_ras = {}
    if claude.get("available") and claude.get("seven_day", {}).get("reset_at"):
        current_ras["claude"] = [claude["seven_day"]["reset_at"]]
    if codex.get("available") and codex_weekly and codex_weekly.get("reset_at"):
        current_ras["codex"] = [codex_weekly["reset_at"]]
    _prune_history(history, current_ras)

    # Save once
    _save_history(history)

    return {"codex": codex, "claude": claude}

if __name__ == "__main__":
    print(json.dumps(get_all(), indent=2, ensure_ascii=False))
