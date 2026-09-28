#!/usr/bin/env python3
"""press-server.py — the press: the studio's edition to PDF, on demand.

    python3 tools/press-server.py            # PRESS_PORT (8091), PRESS_ORIGINS
    python3 tools/press-server.py --studio   # on your own machine: the studio too,
                                             # at http://localhost:8091/studio.html

The studio's Print menu POSTs the edition on screen here and gets a PDF back.
The PDF is made by tools/press/render.js: DB.render(model), the page the
website shows, laid out on sheets of the edition's trim by db-print.js in
headless Chromium (exactly the studio's Web PDF), then imposed and marked with
pdf-lib. One renderer, so the website, the Web PDF and the printed PDFs are the
same pages in the same fonts. About two seconds.

    POST /press      {"edition": "issue-01", "model": {…}, "output": …}  -> application/pdf
                     "output": "booklet" (the default: two pages to a Letter-
                     landscape side in saddle-stitch order, for a desktop duplex
                     printer), "printer" (pages in order with bleed and crop
                     marks and TrimBox/BleedBox, for a print shop) or "print"
                     (the pages cut to the trim, in order: the proof).
                     X-Press-Pages / -Sides / -Sheets / -Seconds say what it is.
    GET  /health     {"ok": true, "engine": "...", ...}
    GET  /           a status page for a person who opened the press in a browser

With --studio the server also serves this checkout's files (not its dotfiles
or build/), on 127.0.0.1 only: open the studio from it and the PDFs are made
right there, from the edition on screen. It needs Node 20+ and, once,
`cd tools/press && npm install && npx playwright install chromium`.

One job at a time: a render is a whole Chromium for a couple of seconds and the
box is shared. A few requests queue on the lock; past that the answer is 503
with Retry-After rather than a pile of threads that all finish late. Bodies are
capped because an embedded cover image rides inside the model as a data: URL.

Stdlib only, like the estate's other hand-written servers.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
RENDER = REPO / "tools" / "press" / "render.js"
RENDER_TIMEOUT_S = int(os.environ.get("PRESS_TIMEOUT", "120"))
OUTPUTS = ("booklet", "printer", "print")

PORT = int(os.environ.get("PRESS_PORT", "8091"))
# Origins the studio is served from. A browser elsewhere gets no CORS header and
# its fetch fails closed; the studio then says how to run a press of your own.
ORIGINS = set(filter(None, os.environ.get(
    "PRESS_ORIGINS",
    "https://db.ripostelabs.xyz,https://ourdailybre.ad,https://daily-bread-studio.pages.dev").split(",")))
LOCAL_ORIGIN = re.compile(r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$")
MAX_BODY = 24 * 1024 * 1024        # the model, cover image included
EDITION = re.compile(r"^issue-\d{2}$")
WORK = REPO / "build" / "studio"    # one temp dir per request, removed after
STUDIO = "--studio" in sys.argv[1:] or os.environ.get("PRESS_STUDIO") == "1"
TYPES = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
         ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
         ".json": "application/json", ".pdf": "application/pdf", ".png": "image/png",
         ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
         ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf",
         ".otf": "font/otf", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8",
         ".md": "text/plain; charset=utf-8", ".xml": "application/xml"}
MAX_QUEUED = int(os.environ.get("PRESS_MAX_QUEUED", "3"))   # waiting, not counting the one running
RETRY_AFTER_S = "15"

lock = threading.Lock()
queued = 0                          # requests waiting for the lock
queued_lock = threading.Lock()


def commit():
    """The checkout this press typesets from, for /health and the logs."""
    try:
        return subprocess.run(["git", "-C", str(REPO), "rev-parse", "--short", "HEAD"],
                              capture_output=True, text=True, timeout=10).stdout.strip() or "?"
    except Exception:
        return "?"


COMMIT = commit()

STATUS_PAGE = """<!doctype html><meta charset="utf-8"><title>Daily Bread press</title>
<style>body{{font:15px/1.5 "IBM Plex Mono",ui-monospace,monospace;max-width:40em;margin:3em auto;padding:0 1em;color:#1d1a17;background:#f6f1e7}}
h1{{font-size:1.2em}}code{{background:#eae4d6;padding:0 .3em}}</style>
<h1>Daily Bread press</h1>
<p>This is the press behind the studio&rsquo;s <b>Print</b> menu: the edition on screen,
laid out as the website draws it and made into a booklet or a printer&rsquo;s PDF.
Nothing to see here; use the menu in the studio.</p>
<p>Engine: <code>{engine}</code><br>State: <code>{busy}</code></p>
<p><code>GET /health</code> is this as JSON. <code>POST /press</code> takes
<code>{{"edition", "model", "output"}}</code> and answers with the PDF.</p>
"""


def engine():
    try:
        v = subprocess.run(["node", "--version"], capture_output=True, text=True, timeout=10).stdout.strip()
    except Exception:
        v = "no node"
    return f"tools/press/render.js on node {v} + Chromium"


ENGINE = engine()


class Handler(BaseHTTPRequestHandler):
    server_version = "daily-bread-press/1"

    # ---- plumbing ----------------------------------------------------------
    def cors(self):
        origin = self.headers.get("Origin", "")
        if origin in ORIGINS or LOCAL_ORIGIN.match(origin):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Expose-Headers",
                             "X-Press-Pages, X-Press-Sides, X-Press-Sheets, X-Press-Seconds")

    def reply(self, status, body, ctype="application/json", extra=None):
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(status)
        self.cors()
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(data)

    def fail(self, status, message):
        self.reply(status, {"ok": False, "error": message})

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.address_string(), fmt % args))

    # ---- routes ------------------------------------------------------------
    def do_OPTIONS(self):
        self.send_response(HTTPStatus.NO_CONTENT)
        self.cors()
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "600")
        self.end_headers()

    def do_GET(self):
        route = self.path.split("?")[0]
        status = {"ok": True, "commit": COMMIT, "outputs": list(OUTPUTS),
                  "engine": ENGINE, "busy": lock.locked(),
                  "queued": queued, "maxQueued": MAX_QUEUED}
        if route == "/health":
            return self.reply(HTTPStatus.OK, status)
        if route == "/":
            return self.reply(HTTPStatus.OK, STATUS_PAGE.format(
                engine=status["engine"],
                busy="typesetting now" if status["busy"] else "idle").encode(),
                "text/html; charset=utf-8")
        if STUDIO:
            return self.static(route)
        self.fail(HTTPStatus.NOT_FOUND, "no such route: GET /health or POST /press")

    def static(self, route):
        """--studio: a file of this checkout, never a dotfile, build/ or outside it."""
        from urllib.parse import unquote
        rel = unquote(route).lstrip("/")
        parts = [p for p in rel.split("/") if p]
        f = (REPO / rel).resolve()
        if (not parts or any(p.startswith(".") for p in parts) or parts[0] == "build"
                or REPO not in f.parents or not f.is_file()):
            return self.fail(HTTPStatus.NOT_FOUND, "no such file")
        self.reply(HTTPStatus.OK, f.read_bytes(), TYPES.get(f.suffix.lower(), "application/octet-stream"),
                   {"Cache-Control": "no-store"})

    def do_POST(self):
        if self.path.split("?")[0] != "/press":
            return self.fail(HTTPStatus.NOT_FOUND, "no such route")
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BODY:
            return self.fail(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, f"body must be 1..{MAX_BODY} bytes")
        try:
            req = json.loads(self.rfile.read(length))
        except ValueError:
            return self.fail(HTTPStatus.BAD_REQUEST, "body is not JSON")
        edition = str(req.get("edition", ""))
        model = req.get("model")
        output = str(req.get("output") or "booklet")
        if output not in OUTPUTS:
            return self.fail(HTTPStatus.BAD_REQUEST, "output must be one of " + ", ".join(OUTPUTS))
        if not EDITION.match(edition):
            return self.fail(HTTPStatus.BAD_REQUEST, "edition must look like issue-01")
        if not isinstance(model, dict):
            return self.fail(HTTPStatus.BAD_REQUEST, "model must be the studio's edition JSON")

        global queued
        with queued_lock:
            if queued >= MAX_QUEUED:
                self.send_response(HTTPStatus.SERVICE_UNAVAILABLE)
                self.cors()
                self.send_header("Retry-After", RETRY_AFTER_S)
                body = json.dumps({"ok": False, "error": f"the press has {queued} editions waiting; try again in {RETRY_AFTER_S} s"}).encode()
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            queued += 1

        WORK.mkdir(parents=True, exist_ok=True)
        work = Path(tempfile.mkdtemp(prefix=edition + "-", dir=WORK))
        started = time.monotonic()
        try:
            with lock:
                with queued_lock:
                    queued -= 1
                waited = time.monotonic() - started
                res = subprocess.run(["node", str(RENDER), "--model", "-", "--out", str(work), "--only", output],
                                     input=json.dumps(model), capture_output=True, text=True,
                                     timeout=RENDER_TIMEOUT_S, cwd=str(REPO))
                if res.returncode:
                    raise RuntimeError((res.stderr or res.stdout).strip()[-2000:] or "render failed")
            info = json.loads(res.stdout.strip().splitlines()[-1])
            pdf = Path(info["files"][output]).read_bytes()
        except subprocess.TimeoutExpired:
            return self.fail(HTTPStatus.GATEWAY_TIMEOUT, f"the render took longer than {RENDER_TIMEOUT_S} s")
        except Exception as e:
            sys.stderr.write("press %s %s FAILED after %.1fs: %s\n" % (
                self.address_string(), edition, time.monotonic() - started, str(e)[-300:].replace("\n", " ")))
            return self.fail(HTTPStatus.UNPROCESSABLE_ENTITY, str(e)[-2000:])
        finally:
            shutil.rmtree(work, ignore_errors=True)
        sys.stderr.write("press %s %s %s ok %.1fs (waited %.1fs) %d pages %d bytes\n" % (
            self.address_string(), edition, output, time.monotonic() - started, waited, info["pages"], len(pdf)))

        name = f"daily-bread-{edition}-{output}.pdf"
        self.reply(HTTPStatus.OK, pdf, "application/pdf", {
            "Content-Disposition": f'attachment; filename="{name}"',
            "X-Press-Pages": str(info["pages"]),
            "X-Press-Sides": str((info.get("booklet") or {}).get("sides", info["pages"])),
            "X-Press-Sheets": str(-(-(info.get("booklet") or {}).get("sides", info["pages"]) // 2)),
            "X-Press-Seconds": "%.1f" % (time.monotonic() - started),
        })


def main():
    # Leftovers from a build the previous process did not live to clean up.
    shutil.rmtree(WORK, ignore_errors=True)
    # the studio mode serves the checkout: to this machine only
    srv = ThreadingHTTPServer(("127.0.0.1" if STUDIO else "0.0.0.0", PORT), Handler)
    srv.daemon_threads = True
    sys.stderr.write(f"daily-bread press on :{PORT}  commit {COMMIT}  {ENGINE}  repo {REPO}\n")
    if STUDIO:
        sys.stderr.write(f"studio: http://localhost:{PORT}/studio.html\n")
    srv.serve_forever()


if __name__ == "__main__":
    main()
