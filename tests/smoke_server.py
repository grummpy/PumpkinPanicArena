#!/usr/bin/env python3
"""Headless smoke launch: server.py serves the game and falls back when the port is taken."""

from __future__ import annotations

import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SERVER = ROOT / "server.py"


def wait_url(proc: subprocess.Popen[str], timeout: float = 8) -> str:
    deadline = time.time() + timeout
    seen = ""
    while time.time() < deadline:
        if proc.poll() is not None:
            rest = proc.stdout.read() if proc.stdout else ""
            raise SystemExit(f"server exited early:\n{seen}{rest}")
        if proc.stdout is None:
            raise SystemExit("server stdout is not piped")
        line = proc.stdout.readline()
        if not line:
            time.sleep(0.05)
            continue
        seen += line
        if "Pumpkin Panic Arena at http://" in line:
            return line.strip().split(" at ", 1)[1].strip()
    raise SystemExit(f"timed out waiting for server URL:\n{seen}")


def stop(proc: subprocess.Popen[str]) -> None:
    if proc.poll() is not None:
        return
    proc.terminate()
    try:
        proc.wait(timeout=3)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait(timeout=3)


def start(port: int) -> subprocess.Popen[str]:
    return subprocess.Popen(
        [sys.executable, str(SERVER), "--port", str(port), "--no-browser"],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )


def fetch(url: str, path: str) -> bytes:
    target = url.rstrip("/") + path
    with urllib.request.urlopen(target, timeout=3) as res:
        if res.status != 200:
            raise SystemExit(f"{target} returned {res.status}")
        return res.read()


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def check_pages(url: str) -> None:
    html = fetch(url, "/index.html")
    if b"Pumpkin Panic Arena" not in html or b"src/main.js" not in html:
        raise SystemExit("index.html is missing the game shell")
    script = fetch(url, "/src/main.js")
    if b"createGame" not in script:
        raise SystemExit("src/main.js was not served")
    manifest = fetch(url, "/arcade.json")
    if b"pumpkinpanicarena" not in manifest:
        raise SystemExit("arcade.json was not served")
    cover = fetch(url, "/assets/cover.jpg")
    if len(cover) < 1000:
        raise SystemExit("cover art was not served")


def test_serves_chosen_port() -> None:
    port = free_port()
    proc = start(port)
    try:
        url = wait_url(proc)
        if not url.endswith(f":{port}/"):
            raise SystemExit(f"expected port {port}, got {url}")
        check_pages(url)
        print(f"smoke ok {url}")
    finally:
        stop(proc)


def test_port_fallback() -> None:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as busy:
        busy.bind(("127.0.0.1", 0))
        busy.listen(1)
        port = busy.getsockname()[1]
        proc = start(port)
        try:
            url = wait_url(proc)
            used = int(url.rsplit(":", 1)[1].rstrip("/"))
            if used == port:
                raise SystemExit(f"server bound the busy port {port}")
            check_pages(url)
            print(f"fallback ok {url} (blocked {port})")
        finally:
            stop(proc)


def main() -> int:
    test_serves_chosen_port()
    test_port_fallback()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
