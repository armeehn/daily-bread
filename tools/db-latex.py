#!/usr/bin/env python3
"""Daily Bread: one .tex per edition -> web + print.

    python3 tools/db-latex.py import --edition issue-01   # old .js -> .tex, once
    python3 tools/db-latex.py build  --edition issue-01   # web + print
    python3 tools/db-latex.py check  --edition issue-01   # round-trip, CI

See tools/latex/README.md.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "latex"))
from dblatex.cli import main  # noqa: E402

sys.exit(main())
