"""content/<edition>.tex -> issue dict.

Restricted on purpose: only the macros the class documents are understood,
and anything else inside the document is an error. That is what keeps the
web and print paths honest: a page cannot pick up LaTeX the web never sees.
"""
import re

from .model import (META_KEYS, SEQ_SUGAR_PROP, SUGAR_PROP, TexError, unescape)

_COMMENT = re.compile(r"(?<!\\)%.*")
_MACRO = re.compile(r"\\([A-Za-z]+)")


def _strip_comments(text):
    return "\n".join(_COMMENT.sub("", line) for line in text.split("\n"))


class _Scanner:
    def __init__(self, text):
        self.s = _strip_comments(text)
        self.i = 0

    def line(self):
        return self.s.count("\n", 0, self.i) + 1

    def fail(self, msg):
        raise TexError(f"line {self.line()}: {msg}")

    def skip_ws(self):
        while self.i < len(self.s) and self.s[self.i].isspace():
            self.i += 1

    def _delimited(self, open_ch, close_ch):
        depth = 0
        start = self.i
        while self.i < len(self.s):
            c = self.s[self.i]
            if c == "\\":
                self.i += 2
                continue
            if c == open_ch:
                depth += 1
            elif c == close_ch:
                depth -= 1
                if depth == 0:
                    inner = self.s[start + 1:self.i]
                    self.i += 1
                    return inner
            self.i += 1
        self.fail(f"unbalanced {open_ch}")

    def arg(self):
        self.skip_ws()
        if self.i >= len(self.s) or self.s[self.i] != "{":
            self.fail("expected {argument}")
        return self._delimited("{", "}")

    def opt(self):
        self.skip_ws()
        if self.i < len(self.s) and self.s[self.i] == "[":
            return self._delimited("[", "]")
        return None

    def next_macro(self):
        m = _MACRO.search(self.s, self.i)
        if not m:
            return None
        between = self.s[self.i:m.start()]
        if between.strip():
            self.fail(f"stray text outside a macro: {between.strip()[:40]!r}")
        self.i = m.end()
        return m.group(1)


def read_tex(text):
    sc = _Scanner(text)
    issue = {"meta": {}, "pages": []}
    page = None
    seq = None      # (prop name, list) while inside a block sequence
    seq_env = None  # the environment name that opened it, for \end matching

    def in_page(name):
        if page is None:
            sc.fail(f"\\{name} outside \\begin{{page}}")

    def set_prop(name, value):
        in_page(name)
        if name in page["content"]:
            sc.fail(f"prop {name!r} set twice on page {page['id']!r}")
        page["content"][name] = value

    while True:
        macro = sc.next_macro()
        if macro is None:
            break

        if macro == "documentclass":
            sc.opt()
            sc.arg()
        elif macro in META_KEYS:
            issue["meta"][macro] = unescape(sc.arg())
        elif macro == "begin":
            env = sc.arg()
            if env == "document":
                continue
            if env == "page":
                if page is not None:
                    sc.fail("nested \\begin{page}")
                page = {"id": sc.arg(), "template": sc.arg()}
                variant = sc.opt()
                if variant is not None:
                    page["variant"] = variant
                page["content"] = {}
            elif env == "seq" or env in SEQ_SUGAR_PROP:
                in_page("begin{" + env + "}")
                if seq is not None:
                    sc.fail("nested block sequence")
                name = sc.arg() if env == "seq" else SEQ_SUGAR_PROP[env]
                seq, seq_env = (name, []), env
                set_prop(name, seq[1])
            else:
                sc.fail(f"unknown environment {env!r}")
        elif macro == "end":
            env = sc.arg()
            if env == "document":
                break
            if env == "page":
                if page is None:
                    sc.fail("\\end{page} without begin")
                if seq is not None:
                    sc.fail("\\end{page} inside a block sequence")
                issue["pages"].append(_ordered(page))
                page = None
            elif env == seq_env:
                seq, seq_env = None, None
            else:
                sc.fail(f"unexpected \\end{{{env}}}")
        elif macro == "block":
            if seq is None:
                sc.fail("\\block outside a block sequence")
            seq[1].append(unescape(sc.arg()))
        elif macro == "slug":
            in_page(macro)
            page["slug"] = unescape(sc.arg())
        elif macro == "chrome":
            in_page(macro)
            key = sc.arg()
            page.setdefault("chrome", {})[key] = unescape(sc.arg())
        elif macro == "field":
            set_prop(sc.arg(), unescape(sc.arg()))
        elif macro in SUGAR_PROP:
            set_prop(SUGAR_PROP[macro], unescape(sc.arg()))
        else:
            sc.fail(f"unknown macro \\{macro}")

    if page is not None:
        sc.fail("unterminated page")
    return issue


def _ordered(page):
    from .model import PAGE_KEY_ORDER
    return {k: page[k] for k in PAGE_KEY_ORDER if k in page}
