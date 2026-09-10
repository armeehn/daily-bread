"""python3 tools/db-latex.py {import,build,check,press} --edition <slug>"""
import argparse
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

from . import press, web
from .reader import read_tex
from .writer import write_tex

REPO = Path(__file__).resolve().parents[3]
DEFAULT_EDITION = "issue-01"
EPS_PT = 0.01
# Where the studio's "Magazine PDF" button downloads from: press/<edition>/.
PRESS_DIR = REPO / "press"
BOOKLET_PDF = "booklet.pdf"
BOOKLET_MANIFEST = "booklet.json"


def paths(slug):
    return (REPO / "content" / f"{slug}.tex",
            REPO / "content" / f"{slug}.js",
            REPO / "build" / "latex" / slug)


def cmd_import(args):
    """Bootstrap: the old hand-written .js becomes the .tex (one-way, once)."""
    tex, js, _ = paths(args.edition)
    issue = web.load_js(REPO, js)
    tex.write_text(write_tex(issue))
    print(f"wrote {tex.relative_to(REPO)} ({len(issue['pages'])} pages)")


def cmd_build(args):
    tex, js, build = paths(args.edition)
    issue = read_tex(tex.read_text())
    if args.web:
        js.write_text(web.emit_js(issue, args.edition))
        web.build_site(REPO)
        print(f"web: {js.relative_to(REPO)} regenerated, site rebuilt")
    if args.print:
        one_up, booklet = press.build_pdfs(REPO, tex, build)
        for pdf in (one_up, booklet):
            print("print: %s  %d pages  %.2f x %.2f pt" % ((pdf.relative_to(REPO),) + press.pdf_geometry(pdf)))


def cmd_check(args):
    tex, js, build = paths(args.edition)
    failures = []
    issue = read_tex(tex.read_text())

    # 1. The notation is a fixed point: tex -> issue -> tex -> issue loses nothing.
    again = web.diff_paths(issue, read_tex(write_tex(issue)))
    if again:
        failures.append("tex -> issue -> tex is not stable:\n  " + "\n  ".join(again[:20]))

    if args.web:
        # 2. Structural diff against the committed .js (the web input).
        diff = web.diff_paths(issue, web.load_js(REPO, js))
        if diff:
            failures.append("issue differs from %s:\n  " % js.name + "\n  ".join(diff[:20]))

        # 3. Rebuild the site from the .tex; the tree must not change, which is
        #    also what keeps every newsproof signature valid.
        js.write_text(web.emit_js(issue, args.edition))
        web.build_site(REPO)
        dirty = subprocess.run(["git", "status", "--porcelain"], cwd=REPO,
                               capture_output=True, text=True).stdout
        if dirty:
            failures.append("rebuilding from the .tex changed the tree:\n" + dirty)
        if not web.verify_proofs(REPO):
            failures.append("newsproof: a built edition no longer hashes to its proof")

    if args.print:
        failures += check_print(issue, tex, build)

    for f in failures:
        print("FAIL:", f)
    print("OK" if not failures else f"{len(failures)} failure(s)")
    return 1 if failures else 0


def check_print(issue, tex, build):
    """Typeset both print outputs; each must have the page count and geometry the
    issue implies. Returns the failures, printing what was measured."""
    failures = []
    one_up, booklet = press.build_pdfs(REPO, tex, build)
    want = {one_up: (len(issue["pages"]), press.A5_PT),
            booklet: (len(issue["pages"]) // press.PAGES_PER_SIDE, press.SHEET_PT)}
    for pdf, (n, (w, h)) in want.items():
        got = press.pdf_geometry(pdf)
        print("%s: %d pages, %.2f x %.2f pt" % ((pdf.name,) + got))
        if got[0] != n or abs(got[1] - w) > EPS_PT or abs(got[2] - h) > EPS_PT:
            failures.append(f"{pdf.name}: want {n} pages {w} x {h} pt, got {got}")
    over = press.overfull_boxes(build / "print.log")
    if over:
        print(f"warning: {over} page box(es) overfull (content runs past the trim)")
    return failures


def cmd_press(args):
    """Typeset the edition and publish its saddle-stitched booklet to press/<edition>/,
    the path the studio's "Magazine PDF" button downloads. Beside it goes a manifest
    that names the source and the bytes, so the studio can say what it is handing
    over and CI can tell a stale copy from a fresh one."""
    tex, _, build = paths(args.edition)
    issue = read_tex(tex.read_text())
    failures = check_print(issue, tex, build)
    for f in failures:
        print("FAIL:", f)
    if failures:
        return 1

    out = PRESS_DIR / args.edition
    out.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(build / BOOKLET_PDF, out / BOOKLET_PDF)
    pdf = (out / BOOKLET_PDF).read_bytes()
    pages, sheet_w, sheet_h = press.pdf_geometry(out / BOOKLET_PDF)
    n = len(issue["pages"])
    manifest = {
        "edition": args.edition,
        "source": str(tex.relative_to(REPO)),
        "sourceSha256": hashlib.sha256(tex.read_bytes()).hexdigest(),
        "pages": n, "sides": pages, "sheets": pages // 2,
        "pageWidthPt": press.A5_PT[0], "pageHeightPt": press.A5_PT[1],
        "sheetWidthPt": round(sheet_w, 2), "sheetHeightPt": round(sheet_h, 2),
        "order": ["%d|%d" % lr for lr in press.saddle_stitch(n)],
        "pdfSha256": hashlib.sha256(pdf).hexdigest(), "pdfBytes": len(pdf),
        "sourceDateEpoch": int(press.source_date_epoch()),
        "engine": press.engine_version(REPO),
        "press": "tools/db-latex.py press (lualatex + dailybread.cls; pdfpages saddle-stitch)",
    }
    (out / BOOKLET_MANIFEST).write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    print("press: %s  %d pages on %d sides  sha256 %s" % (
        (out / BOOKLET_PDF).relative_to(REPO), n, pages, manifest["pdfSha256"][:12]))
    return 0


def main(argv=None):
    p = argparse.ArgumentParser(prog="db-latex", description=__doc__)
    sub = p.add_subparsers(dest="cmd", required=True)
    for name, fn in (("import", cmd_import), ("build", cmd_build), ("check", cmd_check),
                     ("press", cmd_press)):
        s = sub.add_parser(name)
        s.add_argument("--edition", default=DEFAULT_EDITION)
        if name in ("build", "check"):
            s.add_argument("--web", action="store_true")
            s.add_argument("--print", action="store_true")
        s.set_defaults(fn=fn)
    args = p.parse_args(argv)
    if args.cmd in ("build", "check") and not (args.web or args.print):
        args.web = args.print = True
    return args.fn(args) or 0


if __name__ == "__main__":
    sys.exit(main())
