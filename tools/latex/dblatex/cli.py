"""python3 tools/db-latex.py {import,build,check,press} --edition <slug>

The .tex issues feed the website's shared strings (content/<slug>.js, read by
tools/strings/from-issue.js) and can still be typeset as proofs (build --print).
The magazine itself prints from the studio's model: tools/press/render.js."""
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
SPREAD_LAG = 1   # a spread's right page keeps the left page's doc number

# Where the studio's "Magazine PDF" button falls back to with no press running:
# press/<edition>/. Issue №1's booklet there comes from tools/press/render.js;
# an issue still kept as .tex publishes its own with `db-latex.py press`.
PRESS_DIR = REPO / "press"
BOOKLET_PDF = "booklet.pdf"
BOOKLET_MANIFEST = "booklet.json"
PRESS_NAME = "tools/db-latex.py press (lualatex + dailybread.cls; saddle-stitch on Letter)"


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

    # 1b. Every numbered page prints its own number. p22 once carried p19's
    #     folio and doc number (copied chrome), and nothing measured it.
    failures += folio_failures(issue)

    # 1c. A booklet published from this .tex was typeset from it as it is now.
    #     93b1d24 fixed issue 02's folios and the studio kept offering the old ones.
    failures += booklet_failures(args.edition, tex)

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


def folio_failures(issue):
    """Folio must equal the page number; the doc number must end in it, or in
    the page before it on a spread. Example: p22 -> folio 22, DB-022-A."""
    failures = []
    for page in issue["pages"]:
        num = page["id"][1:]
        chrome = page.get("chrome", {})
        folio = chrome.get("folio", "")
        if not (page["id"].startswith("p") and num.isdigit() and folio.isdigit()):
            continue

        n = int(num)
        if int(folio) != n:
            failures.append(f"{page['id']}: folio {folio}, want {n}")

        digits = "".join(c for c in chrome.get("docNo", "") if c.isdigit())
        if digits and int(digits) % 100 not in (n, n - SPREAD_LAG):
            failures.append(f"{page['id']}: doc number {chrome['docNo']} is not page {n}'s")
    return failures


def booklet_failures(edition, tex):
    """press/<edition>/booklet.json, when it names this .tex, must carry its hash.
    A booklet from another source (issue 01's, from the press) is not ours to judge."""
    manifest = PRESS_DIR / edition / BOOKLET_MANIFEST
    if not manifest.exists():
        return []

    info = json.loads(manifest.read_text())
    if info.get("source") != str(tex.relative_to(REPO)):
        return []

    if info.get("sourceSha256") != hashlib.sha256(tex.read_bytes()).hexdigest():
        return [f"{manifest.relative_to(REPO)}: the booklet predates {tex.name}; "
                f"run `python3 tools/db-latex.py press --edition {edition}`"]
    return []


def cmd_press(args):
    """Typeset the edition and publish its saddle-stitched booklet, with a manifest
    naming the source and the bytes, to press/<edition>/: what the studio downloads
    when no press is running. Needs riposte-latex, or the shim's faces would ship."""
    if press.riposte_dir(REPO) is None:
        print("FAIL: riposte-latex not found ($RIPOSTE_LATEX or ../riposte-latex); "
              "the booklet would ship in the shim's faces")
        return 1

    tex, _, build = paths(args.edition)
    issue = read_tex(tex.read_text())
    failures = folio_failures(issue) + check_print(issue, tex, build)
    for f in failures:
        print("FAIL:", f)
    if failures:
        return 1

    # Copy the booklet over the published one and describe it beside it
    out = PRESS_DIR / args.edition
    out.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(build / BOOKLET_PDF, out / BOOKLET_PDF)
    pdf = (out / BOOKLET_PDF).read_bytes()
    sides, sheet_w, sheet_h = press.pdf_geometry(out / BOOKLET_PDF)
    n = len(issue["pages"])
    manifest = {
        "edition": args.edition,
        "source": str(tex.relative_to(REPO)),
        "sourceSha256": hashlib.sha256(tex.read_bytes()).hexdigest(),
        "pages": n, "sides": sides, "sheets": sides // 2,
        "pageWidthPt": press.A5_PT[0], "pageHeightPt": press.A5_PT[1],
        "sheetWidthPt": round(sheet_w, 2), "sheetHeightPt": round(sheet_h, 2),
        "order": ["%d|%d" % lr for lr in press.saddle_stitch(n)],
        "pdfSha256": hashlib.sha256(pdf).hexdigest(), "pdfBytes": len(pdf),
        "sourceDateEpoch": int(press.source_date_epoch()),
        "engine": press.engine_version(REPO),
        "press": PRESS_NAME,
    }
    (out / BOOKLET_MANIFEST).write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    print("press: %s  %d pages on %d sides  sha256 %s" % (
        (out / BOOKLET_PDF).relative_to(REPO), n, sides, manifest["pdfSha256"][:12]))
    return 0


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
    clipped = press.clipped_sides(booklet)
    print("%s: %d side(s) with ink in the printer's %.1f mm dead band"
          % (booklet.name, len(clipped), press.PRINTER_CLIP_MM))
    if clipped:
        failures.append(f"{booklet.name}: a desktop laser would clip sides {clipped}")
    over = press.overfull_boxes(build / "print.log")
    if over:
        print(f"warning: {over} page box(es) overfull (content runs past the trim)")
    return failures


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
