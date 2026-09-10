"""The content model and the .tex notation, shared by reader and writer.

A page is `{id, template, [variant], [slug], [chrome], content}`; a content
value is a string or a block sequence (list of strings). This is exactly the
shape tools/strings/from-issue.js and tools/print/build-print.js consume.
"""
import re

# Macros that carry the issue's metadata, in emission order. `palette` is the
# studio's theme as seven hex values (ink,bone,pink,orange,teal,panel,muted);
# only an overlay writes it, the committed .tex files carry none.
META_KEYS = ("issue", "theme", "edition", "trim", "palette")

# Semantic sugar: a documented macro name per common prop. Anything else is
# written as \field{name}{value}. Same table serves both directions.
SUGAR = {
    "title": "headline",
    "kicker": "kicker",
    "dek": "standfirst",
    "byline": "byline",
    "quote": "pullquote",
}
SUGAR_PROP = {macro: prop for prop, macro in SUGAR.items()}

# Block-sequence sugar: \begin{body} ... \end{body} == \begin{seq}{body}.
SEQ_SUGAR = {"body": "body"}
SEQ_SUGAR_PROP = {env: prop for prop, env in SEQ_SUGAR.items()}

# Page keys in the order the .js file has always carried them.
PAGE_KEY_ORDER = ("id", "template", "variant", "slug", "chrome", "content")

# TeX-special characters. Escaped on the way out, unescaped on the way in;
# the .tex must compile AND round-trip byte-for-byte.
_ESCAPE = {
    "\\": r"\textbackslash{}",
    "#": r"\#",
    "$": r"\$",
    "%": r"\%",
    "&": r"\&",
    "_": r"\_",
    "{": r"\{",
    "}": r"\}",
    "~": r"\textasciitilde{}",
    "^": r"\textasciicircum{}",
}
_UNESCAPE = {v: k for k, v in _ESCAPE.items()}
_ESCAPE_RE = re.compile(r"[\\#$%&_{}~^]")
_UNESCAPE_RE = re.compile(
    r"\\(?:textbackslash\{\}|textasciitilde\{\}|textasciicircum\{\}|[#$%&_{}])")


def escape(text):
    return _ESCAPE_RE.sub(lambda m: _ESCAPE[m.group(0)], text)


def unescape(text):
    return _UNESCAPE_RE.sub(lambda m: _UNESCAPE[m.group(0)], text)


class TexError(Exception):
    """A .tex that does not follow the documented macro set."""
