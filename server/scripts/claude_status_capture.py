#!/usr/bin/env python3
"""
statusLine wrapper for Claude Code.
1) Captures rate_limits from stdin JSON -> ~/.claude/rate_limits_latest.json
2) Forwards stdin to original claude-hud command for display.
If capture fails, claude-hud still runs (never breaks Claude Code).
"""
import fcntl, glob, json, os, struct, subprocess, sys, termios, time

CLAUDE_HUD_CMD = [
    "/home/claude/.bun/bin/bun", "--env-file", "/dev/null",
]
OUT = os.path.expanduser("~/.claude/rate_limits_latest.json")


def _get_columns():
    """Get terminal columns, matching original statusLine: cols - 4, min 1."""
    cols = 0
    try:
        cols = os.get_terminal_size(0).columns
    except Exception:
        pass
    if not cols:
        try:
            with open("/dev/tty") as tty:
                s = fcntl.ioctl(tty.fileno(), termios.TIOCGWINSZ, struct.pack("HHHH", 0, 0, 0, 0))
                cols = struct.unpack("HHHH", s)[1]
        except Exception:
            pass
    if not cols:
        cols = 120
    return max(1, cols - 4) if cols > 4 else 1


def _find_hud_script():
    """Locate the latest claude-hud plugin dist/index.js."""
    base = os.path.expanduser("~/.claude/plugins/cache")
    candidates = []
    for d in glob.glob(os.path.join(base, "*", "claude-hud", "*", "")):
        parts = d.rstrip(os.sep).split(os.sep)
        ver_dir = parts[-1] if parts[-1] else parts[-2]
        candidates.append((ver_dir, d))
    if not candidates:
        return None
    candidates.sort(key=lambda x: [int(p) for p in x[0].split(".") if p.isdigit()])
    return os.path.join(candidates[-1][1], "dist", "index.js")


def _extract_and_save(raw):
    """Extract sanitized rate_limits and write to file. Silent on error."""
    try:
        rl = (raw.get("rate_limits") or {})
        model = ((raw.get("model") or {}).get("display_name") or "")

        def _win(d):
            if not isinstance(d, dict):
                return None
            used = d.get("used_percentage")
            resets_at = d.get("resets_at")
            if used is None or resets_at is None:
                return None
            return {
                "used_percent": int(round(float(used))),
                "reset_at": int(float(resets_at)),
                "reset_after_seconds": max(0, int(float(resets_at) - time.time())),
            }

        additional = []
        for key, value in rl.items():
            if key in ("five_hour", "seven_day"):
                continue
            window = _win(value)
            if window:
                additional.append({
                    "key": key,
                    "label": value.get("label") or value.get("name") or value.get("model") or "",
                    "window": window,
                })

        payload = {
            "available": True,
            "updated_at": int(time.time()),
            "model": model,
            "five_hour": _win(rl.get("five_hour")),
            "seven_day": _win(rl.get("seven_day")),
            "additional": additional,
        }
        tmp = OUT + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False)
        os.chmod(tmp, 0o600)
        os.replace(tmp, OUT)
    except Exception:
        pass  # never break Claude Code


def main():
    raw_text = sys.stdin.read()
    # 1) Extract and save sanitized rate_limits
    try:
        raw = json.loads(raw_text)
        _extract_and_save(raw)
    except Exception:
        pass
    # 2) Forward to claude-hud
    hud_script = _find_hud_script()
    if not hud_script:
        print("Claude", end="")
        return
    try:
        env = {**os.environ, "COLUMNS": str(_get_columns())}
        proc = subprocess.run(
            CLAUDE_HUD_CMD + [hud_script],
            input=raw_text, capture_output=True, text=True, timeout=10,
            env=env,
        )
        if proc.stdout:
            print(proc.stdout, end="")
        elif proc.stderr:
            print("Claude", end="")
    except Exception:
        print("Claude", end="")


if __name__ == "__main__":
    main()
