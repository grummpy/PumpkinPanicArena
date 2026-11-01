#!/bin/sh
cd "$(dirname "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then
  exec python3 server.py
fi
echo "Python 3 is required to launch Pumpkin Panic Arena."
echo "Install Python 3 and try again."
exit 1
