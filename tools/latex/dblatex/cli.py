"""python3 tools/db-latex.py {import,build,check} --edition <slug>"""
import argparse
import subprocess
import sys
from pathlib import Path

from . import press, web
from .reader import read_tex
from .writer import write_tex

REPO = Path(__file__).resolve().parents[3]
DEFAULT_EDITION = "issue-01"
EPS_PT = 0.01


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

    for f in failures:
        print("FAIL:", f)
    print("OK" if not failures else f"{len(failures)} failure(s)")
    return 1 if failures else 0


def main(argv=None):
    p = argparse.ArgumentParser(prog="db-latex", description=__doc__)
    sub = p.add_subparsers(dest="cmd", required=True)
    for name, fn in (("import", cmd_import), ("build", cmd_build), ("check", cmd_check)):
        s = sub.add_parser(name)
        s.add_argument("--edition", default=DEFAULT_EDITION)
        if name != "import":
            s.add_argument("--web", action="store_true")
            s.add_argument("--print", action="store_true")
        s.set_defaults(fn=fn)
    args = p.parse_args(argv)
    if args.cmd != "import" and not (args.web or args.print):
        args.web = args.print = True
    return args.fn(args) or 0


if __name__ == "__main__":
    sys.exit(main())
