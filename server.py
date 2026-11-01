#!/usr/bin/env python3
"""Local static server for Pumpkin Panic Arena.

Binds to 127.0.0.1. Default port is arcade.json's port (8801). If that port
is taken, the next free port is used. Opens the default browser unless
--no-browser is set.
"""

from __future__ import annotations

import argparse
import socket
import sys
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HOST = "127.0.0.1"
DEFAULT_PORT = 8801
PORT_TRIES = 20


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


class Server(ThreadingHTTPServer):
    allow_reuse_address = False
    address_family = socket.AF_INET


def bind_server(start_port: int) -> tuple[Server, int]:
    last_error: Exception | None = None
    for port in range(start_port, start_port + PORT_TRIES):
        try:
            server = Server((HOST, port), Handler)
        except OSError as exc:
            last_error = exc
            continue
        return server, port
    raise SystemExit(
        f"Could not bind {HOST} on ports {start_port}–{start_port + PORT_TRIES - 1}: {last_error}"
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Serve Pumpkin Panic Arena")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="preferred port (default 8801)")
    parser.add_argument("--no-browser", action="store_true", help="do not open a browser window")
    args = parser.parse_args(argv)

    if args.port < 1 or args.port > 65535:
        print("Port must be between 1 and 65535.", file=sys.stderr)
        return 2

    server, port = bind_server(args.port)
    url = f"http://{HOST}:{port}/"
    print(f"Pumpkin Panic Arena at {url}", flush=True)
    if port != args.port:
        print(f"Port {args.port} was busy; using {port} instead.", flush=True)

    if not args.no_browser:
        try:
            webbrowser.open(url)
        except Exception as exc:
            print(f"Open this URL in a browser: {url} ({exc})", flush=True)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.", flush=True)
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
