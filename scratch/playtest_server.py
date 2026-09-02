#!/usr/bin/env python3
"""Serve the game and expose the current Git branch to the development UI."""

from __future__ import annotations

import argparse
import json
import subprocess
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ENDPOINT_PATH = "/__toa_build_identity__.json"
REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
GAME_ROOT = REPOSITORY_ROOT / "game"


def resolve_git_branch() -> str:
    branch = subprocess.run(
        ["git", "branch", "--show-current"],
        cwd=REPOSITORY_ROOT,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    if branch:
        return branch

    commit = subprocess.run(
        ["git", "rev-parse", "--short", "HEAD"],
        cwd=REPOSITORY_ROOT,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    return f"detached@{commit}"


class PlaytestRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(GAME_ROOT), **kwargs)

    def do_GET(self) -> None:
        if self.path.split("?", 1)[0] == ENDPOINT_PATH:
            self.send_build_identity()
            return
        super().do_GET()

    def send_build_identity(self) -> None:
        payload = json.dumps(
            {
                "mode": "development",
                "branchName": resolve_git_branch(),
            },
            ensure_ascii=False,
        ).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run The Age of Trials playtest server.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8000, type=int)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    server = ThreadingHTTPServer((args.host, args.port), PlaytestRequestHandler)
    print(f"Playtest server: http://{args.host}:{args.port}/")
    print(f"Branch badge: {resolve_git_branch()}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
