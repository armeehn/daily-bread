"""issue dict -> content/<edition>.tex.

Used once to bootstrap an edition from its old .js, and by `check` to prove
the notation is a fixed point (tex -> issue -> tex is identity).
"""
from .model import META_KEYS, SEQ_SUGAR, SUGAR, escape

HEADER = r"""%% Daily Bread · the issue itself — SOURCE OF TRUTH
%% ---------------------------------------------------------------------------
%% One issue, one file. The web build and the print build both read this;
%% see tools/latex/README.md for the pipeline and the macro set.
%%
%% NOTATION (inside a value, kept verbatim by both consumers)
%%   "a | b | c"              fields within one row (no "|" in prose)
%%   "line one / line two"    line breaks inside a poem
%%   "Q: …" / "A: …"          speaker prefixes in interviews
%%   "#f0477d" as a last field pins that row's accent (written \#f0477d)
%%   "none"                   hides an optional element
%%   \begin{seq}{name} … \block{…} … \end{seq}   a block sequence
%%
%% TeX specials are escaped: \# \$ \% \& \_ \{ \} \textbackslash{}
%% ---------------------------------------------------------------------------
"""


def write_tex(issue):
    out = [HEADER, r"\documentclass{dailybread}"]
    for key in META_KEYS:
        if key in issue["meta"]:
            out.append(f"\\{key}{{{escape(issue['meta'][key])}}}")
    out.append("")
    out.append(r"\begin{document}")

    for n, page in enumerate(issue["pages"], 1):
        out.append("")
        out.append(f"% {n:02d} · {page['id']} · {page['template']}")
        head = f"\\begin{{page}}{{{page['id']}}}{{{page['template']}}}"
        if "variant" in page:
            head += f"[{page['variant']}]"
        out.append(head)
        if "slug" in page:
            out.append(f"\\slug{{{escape(page['slug'])}}}")
        for key, value in page.get("chrome", {}).items():
            out.append(f"\\chrome{{{key}}}{{{escape(value)}}}")
        for key, value in page["content"].items():
            out.extend(_prop(key, value))
        out.append(r"\end{page}")

    out.append("")
    out.append(r"\end{document}")
    out.append("")
    return "\n".join(out)


def _prop(key, value):
    if isinstance(value, list):
        env = SEQ_SUGAR.get(key)
        open_ = f"\\begin{{{env}}}" if env else f"\\begin{{seq}}{{{key}}}"
        close = f"\\end{{{env}}}" if env else r"\end{seq}"
        return [open_, *(f"\\block{{{escape(v)}}}" for v in value), close]
    if key in SUGAR:
        return [f"\\{SUGAR[key]}{{{escape(value)}}}"]
    return [f"\\field{{{key}}}{{{escape(value)}}}"]
