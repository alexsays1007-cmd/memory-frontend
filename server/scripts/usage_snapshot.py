#!/usr/bin/env python3
"""
Usage snapshot wrapper.

Refreshes Codex ChatGPT auth shortly before expiry, then runs usage_reader.py.
This keeps the scheduled usage collection from silently falling back to cache
after the stored access token expires.
"""
import base64
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

HOME = Path(os.path.expanduser("~"))
SCRIPT_DIR = Path(__file__).resolve().parent

AUTH_PATH = Path(os.environ.get("CODEX_AUTH_PATH", HOME / ".codex" / "auth.json"))
REFRESH_THRESHOLD_SECONDS = int(os.environ.get("CODEX_REFRESH_THRESHOLD_SECONDS", str(48 * 3600)))
USAGE_READER = Path(os.environ.get("USAGE_READER_SCRIPT", SCRIPT_DIR / "usage_reader.py"))


def log(message):
    print(f"[usage-snapshot] {message}", file=sys.stderr, flush=True)


def jwt_exp(token):
    if not token or token.count(".") < 2:
        return None
    payload = token.split(".")[1]
    payload += "=" * (-len(payload) % 4)
    try:
        claims = json.loads(base64.urlsafe_b64decode(payload.encode("utf-8")))
        exp = claims.get("exp")
        return int(exp) if exp else None
    except Exception:
        return None


def access_token_expiry():
    try:
        data = json.loads(AUTH_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError:
        log(f"auth file missing: {AUTH_PATH}")
        return None
    except Exception as exc:
        log(f"cannot read auth file: {type(exc).__name__}")
        return None

    tokens = data.get("tokens") or {}
    return jwt_exp(tokens.get("access_token"))


def refresh_needed(exp):
    if not exp:
        return True
    remaining = exp - int(time.time())
    if remaining <= REFRESH_THRESHOLD_SECONDS:
        log(f"Codex access token refresh needed; remaining={remaining}s")
        return True
    log(f"Codex access token fresh; remaining={remaining}s")
    return False


def codex_command():
    configured = os.environ.get("CODEX_BIN")
    candidates = [
        configured,
        shutil.which("codex"),
        str(HOME / ".npm-global" / "bin" / "codex"),
        "/usr/local/bin/codex",
        "/usr/bin/codex",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return candidate
    return configured or "codex"


def run_codex_doctor():
    command = codex_command()
    log("running codex doctor to refresh auth")
    try:
        result = subprocess.run(
            [command, "doctor"],
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=60,
            check=False,
        )
    except Exception as exc:
        log(f"codex doctor failed to start: {type(exc).__name__}: {exc}")
        return

    if result.returncode != 0:
        tail = "\n".join((result.stdout or "").splitlines()[-12:])
        log(f"codex doctor exited {result.returncode}; tail:\n{tail}")
        return

    new_exp = access_token_expiry()
    if new_exp:
        log(f"auth refreshed; expires_at={time.strftime('%Y-%m-%dT%H:%M:%S%z', time.localtime(new_exp))}")
    else:
        log("codex doctor completed, but token expiry is still unknown")


def run_usage_reader():
    os.execv(sys.executable, [sys.executable, str(USAGE_READER)])


def main():
    exp = access_token_expiry()
    if refresh_needed(exp):
        run_codex_doctor()
    run_usage_reader()


if __name__ == "__main__":
    main()
