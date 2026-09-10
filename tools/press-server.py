#!/usr/bin/env python3
"""press-server.py — typeset the studio's edition on demand.

    python3 tools/press-server.py            # PRESS_PORT (8091), PRESS_ORIGINS

The studio's "Magazine PDF" button POSTs the edition on screen here and gets the
saddle-stitched booklet back: content/<edition>.tex with that model laid over it
(tools/latex/dblatex/overlay.py), typeset by lualatex, ~10 s. This runs where the
press can: a host with /opt/texlive, riposte-latex beside the checkout, and this
repo — LXC 111 on the estate, published by Caddy as press.hq.ripostelabs.xyz.

    POST /press      {"edition": "issue-01", "model": {…}}   -> application/pdf
                     X-Press-Pages / -Sides / -Overfull / -Touched say what it is
    GET  /health     {"ok": true, "editions": [...], "engine": "..."}
    GET  /           a status page for a person who opened press.hq in a browser

One typesetting at a time: lualatex is a whole core for several seconds and the
box is shared. Requests queue on the lock rather than fail. Bodies are capped
because an embedded cover image rides inside the model as a data: URL.

Stdlib only, like the estate's other hand-written servers.
"""
import json
import os
import re
import shutil
import sys
import tempfile
import threading
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "tools" / "latex"))
from dblatex import overlay, press  # noqa: E402

PORT = int(os.environ.get("PRESS_PORT", "8091"))
# Origins the studio is served from. A browser elsewhere gets no CORS header and
# its fetch fails closed; the studio then falls back to the CI-typeset booklet.
ORIGINS = set(filter(None, os.environ.get(
    "PRESS_ORIGINS",
    "https://db.ripostelabs.xyz,https://ourdailybre.ad,https://daily-bread-studio.pages.dev").split(",")))
LOCAL_ORIGIN = re.compile(r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$")
MAX_BODY = 24 * 1024 * 1024        # the model, cover image included
EDITION = re.compile(r"^issue-\d{2}$")
WORK = REPO / "build" / "studio"    # one temp dir per request, removed after

lock = threading.Lock()

STATUS_PAGE = """<!doctype html><meta charset="utf-8"><title>Daily Bread press</title>
<style>body{{font:15px/1.5 "IBM Plex Mono",ui-monospace,monospace;max-width:40em;margin:3em auto;padding:0 1em;color:#1d1a17;background:#f6f1e7}}
h1{{font-size:1.2em}}code{{background:#eae4d6;padding:0 .3em}}</style>
<h1>Daily Bread press</h1>
<p>This is the typesetting service behind the studio&rsquo;s <b>Magazine PDF</b> button:
the edition on screen laid over <code>content/&lt;edition&gt;.tex</code>, set by lualatex,
imposed as a saddle-stitched booklet. Nothing to see here; press the button in the studio.</p>
<p>Editions: <code>{editions}</code><br>Engine: <code>{engine}</code><br>State: <code>{busy}</code></p>
<p><code>GET /health</code> is this as JSON. <code>POST /press</code> takes
<code>{{"edition", "model"}}</code> and answers with the PDF.</p>
"""


def editions():
    return sorted(p.stem for p in (REPO / "content").glob("issue-*.tex"))


class Handler(BaseHTTPRequestHandler):
    server_version = "daily-bread-press/1"

    # ---- plumbing ----------------------------------------------------------
    def cors(self):
        origin = self.headers.get("Origin", "")
        if origin in ORIGINS or LOCAL_ORIGIN.match(origin):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Expose-Headers",
                             "X-Press-Pages, X-Press-Sides, X-Press-Sheets, X-Press-Overfull, X-Press-Touched, X-Press-Seconds")

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
        status = {"ok": True, "editions": editions(),
                  "engine": press.engine_version(REPO), "busy": lock.locked()}
        if route == "/health":
            return self.reply(HTTPStatus.OK, status)
        if route == "/":
            return self.reply(HTTPStatus.OK, STATUS_PAGE.format(
                editions=", ".join(status["editions"]), engine=status["engine"],
                busy="typesetting now" if status["busy"] else "idle").encode(),
                "text/html; charset=utf-8")
        self.fail(HTTPStatus.NOT_FOUND, "no such route: GET /health or POST /press")

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
        if not EDITION.match(edition) or edition not in editions():
            return self.fail(HTTPStatus.NOT_FOUND, f"no such edition; have {', '.join(editions())}")
        if not isinstance(model, dict):
            return self.fail(HTTPStatus.BAD_REQUEST, "model must be the studio's edition JSON")

        WORK.mkdir(parents=True, exist_ok=True)
        work = Path(tempfile.mkdtemp(prefix=edition + "-", dir=WORK))
        started = time.monotonic()
        try:
            with lock:
                booklet, info = overlay.typeset(REPO, edition, model, work)
            pdf = booklet.read_bytes()
        except Exception as e:                      # a TeX error is the common case
            return self.fail(HTTPStatus.UNPROCESSABLE_ENTITY, str(e)[-2000:])
        finally:
            shutil.rmtree(work, ignore_errors=True)

        name = f"daily-bread-{edition}-booklet.pdf"
        self.reply(HTTPStatus.OK, pdf, "application/pdf", {
            "Content-Disposition": f'attachment; filename="{name}"',
            "X-Press-Pages": str(info["pages"]), "X-Press-Sides": str(info["sides"]),
            "X-Press-Sheets": str(info["sheets"]), "X-Press-Overfull": str(info["overfull"]),
            "X-Press-Touched": " ".join(info["touched"]),
            "X-Press-Seconds": "%.1f" % (time.monotonic() - started),
        })


def main():
    srv = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    sys.stderr.write(f"daily-bread press on :{PORT}  editions {editions()}  repo {REPO}\n")
    srv.serve_forever()


if __name__ == "__main__":
    main()
