#!/usr/bin/env python3
"""Small admin helper for memory edits that need vector refresh.

The Node viewer server calls this script for content/tag updates so it can reuse
the existing VPS B vector_search module instead of reimplementing embeddings.
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path


BJ_TZ = timezone(timedelta(hours=8))


def now_iso() -> str:
    return datetime.now(BJ_TZ).isoformat(timespec="seconds")


def fail(message: str, code: int = 1) -> None:
    print(json.dumps({"ok": False, "error": message}, ensure_ascii=False))
    raise SystemExit(code)


def load_payload() -> dict:
    try:
        return json.load(sys.stdin)
    except Exception as exc:
        fail(f"invalid JSON payload: {exc}")


def connect(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path, isolation_level=None)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA busy_timeout=5000;")
    conn.execute("PRAGMA foreign_keys=ON;")
    conn.row_factory = sqlite3.Row
    return conn


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["create-memory", "update-memory"])
    parser.add_argument("--db", default=os.environ.get("MCP_MEMORY_DB") or os.environ.get("DB_PATH"))
    parser.add_argument(
        "--mcp-dir",
        default=os.environ.get("MCP_MEMORY_DIR", "/home/claude/mcp-memory"),
        help="Directory containing vector_search.py",
    )
    args = parser.parse_args()

    if not args.db:
        fail("database path is required")

    payload = load_payload()

    if args.command == "create-memory":
        content = payload.get("content")
        tags = payload.get("tags", "source:manual,type:fact")
        agent = payload.get("agent", "velvy")
        channel = payload.get("channel", "frontend")

        if not isinstance(content, str) or not content.strip():
            fail("content is required")
        if not isinstance(tags, str):
            tags = str(tags)
        if not isinstance(agent, str) or not agent.strip():
            agent = "velvy"
        if not isinstance(channel, str) or not channel.strip():
            channel = "frontend"

        with connect(args.db) as conn:
            cur = conn.execute(
                "INSERT INTO memories(content, tags, agent, channel, created) VALUES(?,?,?,?,?)",
                (content, tags, agent.strip(), channel.strip(), now_iso()),
            )
            memory_id = cur.lastrowid

        mcp_dir = Path(args.mcp_dir)
        if str(mcp_dir) not in sys.path:
            sys.path.insert(0, str(mcp_dir))
        os.environ["MCP_MEMORY_DB"] = args.db

        try:
            from vector_search import save_embedding

            save_embedding(memory_id, content)
        except Exception as exc:
            fail(f"memory created but vector refresh failed: {type(exc).__name__}: {exc}")

        print(
            json.dumps(
                {
                    "ok": True,
                    "id": memory_id,
                    "tags": tags,
                    "agent": agent.strip(),
                    "channel": channel.strip(),
                    "vectorRefreshed": True,
                },
                ensure_ascii=False,
            )
        )
        return 0

    if args.command == "update-memory":
        memory_id = int(payload.get("id") or 0)
        content = payload.get("content")
        tags = payload.get("tags")

        if memory_id <= 0:
            fail("id must be a positive integer")
        if not isinstance(content, str) or not content.strip():
            fail("content is required")
        if tags is not None and not isinstance(tags, str):
            tags = str(tags)

        with connect(args.db) as conn:
            row = conn.execute("SELECT id, tags FROM memories WHERE id = ?", (memory_id,)).fetchone()
            if not row:
                fail(f"memory not found id={memory_id}", 404)

            next_tags = row["tags"] if tags is None else tags
            conn.execute(
                "UPDATE memories SET content = ?, tags = ?, updated = ? WHERE id = ?",
                (content, next_tags, now_iso(), memory_id),
            )

        mcp_dir = Path(args.mcp_dir)
        if str(mcp_dir) not in sys.path:
            sys.path.insert(0, str(mcp_dir))
        os.environ["MCP_MEMORY_DB"] = args.db

        try:
            from vector_search import save_embedding

            save_embedding(memory_id, content)
        except Exception as exc:
            fail(f"memory updated but vector refresh failed: {type(exc).__name__}: {exc}")

        print(
            json.dumps(
                {
                    "ok": True,
                    "id": memory_id,
                    "tags": next_tags,
                    "vectorRefreshed": True,
                },
                ensure_ascii=False,
            )
        )
        return 0

    fail("unknown command")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
