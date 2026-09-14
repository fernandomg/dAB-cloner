#!/usr/bin/env python3
"""Re-record demo.svg: drive the wizard in a pty, then convert to an animated SVG.

Run it from anywhere:  ./scripts/record-demo.py

It scaffolds a real EVM project into a temporary directory (git clone + package install), so it
needs network and takes a few minutes. The temporary directory is removed afterwards.

Why Python: this needs a pty. `asciinema rec` ignores piped stdin, `script` refuses to start unless
its own stdin is a tty, and node-pty ships no prebuilt binary for macOS arm64. Python's `pty` is in
the standard library, so there is nothing to install.
"""

import fcntl
import json
import os
import pty
import re
import select
import shutil
import struct
import subprocess
import sys
import tempfile
import termios
import time

COLS, ROWS = 92, 23          # svg-term reads these back out of the cast
IDLE_CAP = 2.0               # longest pause kept, as `asciinema rec -i` does
TIME_LIMIT = 15.0            # animation length; keeps the loop short so it never looks stuck
MERGE_BUCKET = 0.15          # join output within this window into one animation frame
PROJECT = "myNewApp"

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PNPM = shutil.which("pnpm")
if not PNPM:
    sys.exit("pnpm not found on PATH")

if not os.path.exists(os.path.join(REPO, "dist", "cli.js")):
    sys.exit("dist/cli.js is missing — run `pnpm build` first")

work = tempfile.mkdtemp(prefix="dappbooster-demo-")
stage, shim_dir = os.path.join(work, "stage"), os.path.join(work, "shim")
os.makedirs(stage)
os.makedirs(shim_dir)

# A `pnpm` that answers `pnpm dlx dappbooster` with the local build, so the recorded command line is
# the one a real user types while the code being demoed is this working tree.
shim = os.path.join(shim_dir, "pnpm")
with open(shim, "w") as handle:
    handle.write(
        f'#!/bin/sh\n'
        f'if [ "$1" = "dlx" ] && [ "$2" = "dappbooster" ]; then\n'
        f'  shift 2\n'
        f'  exec node {REPO}/dist/cli.js "$@"\n'
        f'fi\n'
        f'exec {PNPM} "$@"\n'
    )
os.chmod(shim, 0o755)

master, slave = pty.openpty()
fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", ROWS, COLS, 0, 0))

env = dict(os.environ)
env.update({"PS1": "$ ", "PATH": f"{shim_dir}:{env['PATH']}", "TERM": "xterm-256color"})

proc = subprocess.Popen(
    ["bash", "--norc", "--noprofile", "-i"],
    stdin=slave, stdout=slave, stderr=slave,
    cwd=stage, env=env, preexec_fn=os.setsid,
)
os.close(slave)

started = time.time()
events: list[list] = []
seen = ""


def pump(seconds: float) -> None:
    """Read whatever the pty has to say for `seconds`, timestamping each chunk."""
    global seen
    deadline = time.time() + seconds
    while time.time() < deadline:
        ready, _, _ = select.select([master], [], [], 0.05)
        if not ready:
            continue
        try:
            data = os.read(master, 65536)
        except OSError:
            return
        if not data:
            return
        text = data.decode("utf8", "replace")
        events.append([time.time() - started, "o", text])
        seen += text


def expect(pattern: str, timeout: float, label: str) -> None:
    """Wait for the wizard to actually ask, rather than guessing with sleeps."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        if re.search(pattern, seen):
            return
        pump(0.1)
    raise SystemExit(f"timed out waiting for {label}\n--- tail ---\n{seen[-1500:]}")


def send(text: str) -> None:
    os.write(master, text.encode())


def type_out(text: str, per_char: float = 0.085) -> None:
    for char in text:
        send(char)
        pump(per_char)


try:
    expect(r"\$ ", 15, "shell prompt")
    pump(0.7)

    type_out("pnpm dlx dappbooster")
    pump(0.5)
    send("\r")

    expect(r"Project name", 30, "project name prompt")
    pump(1.0)
    type_out(PROJECT)
    pump(0.6)
    send("\r")

    expect(r"Which stack", 15, "stack prompt")
    pump(1.3)
    send("\r")                       # EVM is first

    expect(r"Choose installation type", 15, "mode prompt")
    pump(1.3)
    send("\r")                       # Full is first

    expect(r"Proceed with these settings", 15, "review")
    pump(2.0)
    send("\r")                       # Yes

    # Keep reading past TIME_LIMIT so the trim lands on a real frame, not a half-drawn one.
    expect(r"Git tasks", 120, "clone step")
    pump(6.0)
finally:
    proc.kill()

# Cap long pauses, drop everything past the time limit, then join nearby output into single frames.
# Merging only changes when bytes are flushed, never which bytes, so the terminal content is exact.
capped: list[list] = []
shift = prev = 0.0
for stamp, kind, data in events:
    gap = stamp - prev
    if gap > IDLE_CAP:
        shift += gap - IDLE_CAP
    prev = stamp
    capped.append([round(stamp - shift, 6), kind, data])

frames: list[list] = []
for stamp, kind, data in capped:
    if stamp > TIME_LIMIT:
        break
    if frames and stamp - frames[-1][0] < MERGE_BUCKET:
        frames[-1][2] += data
    else:
        frames.append([stamp, kind, data])

cast = os.path.join(work, "demo.cast")
header = {
    "version": 2,
    "width": COLS,
    "height": ROWS,
    "timestamp": int(started),
    "env": {"SHELL": "/bin/zsh", "TERM": "xterm-256color"},
}
with open(cast, "w") as handle:
    handle.write(json.dumps(header) + "\n")
    for frame in frames:
        handle.write(json.dumps(frame) + "\n")

out = os.path.join(REPO, "demo.svg")
subprocess.run(
    [PNPM, "dlx", "svg-term-cli", "--in", cast, "--out", out,
     "--window", "--width", str(COLS), "--height", str(ROWS), "--padding", "10"],
    check=True,
)
shutil.rmtree(work, ignore_errors=True)

print(f"\nwrote {out} — {len(frames)} frames, {frames[-1][0]:.1f}s, {os.path.getsize(out) // 1024} KB")
