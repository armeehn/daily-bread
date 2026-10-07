"""The wireframe's shared decisions, so the Scribus and IDML builders agree:
which paragraph styles exist and what they are, what each frame says, and the
swatches as CMYK. Pure Python, no Scribus: build_sla.py runs this inside
Scribus, build_idml.py outside it."""
from collections import Counter

PT = 25.4 / 72                                   # mm per point

ROLE_NAMES = {"wordmark": "Wordmark", "sechead": "Section head", "kicker": "Kicker", "headline": "Headline",
              "dek": "Dek", "body": "Body", "pull": "Pull quote", "caption": "Caption", "cardhead": "Card head",
              "cardbody": "Card body", "stamp": "Stamp", "stat": "Stat"}
# line breaks are a headline's own (<br>); elsewhere they are just where blocks met
KEEP_BREAKS = {"headline", "wordmark", "pull", "stat"}


def cmyk(hexv):
    """A theme colour as CMYK percentages: a plain conversion, not a profile.
    Proof before press; the README says so."""
    r, g, b = (int(hexv[i:i + 2], 16) / 255 for i in (1, 3, 5))
    k = 1 - max(r, g, b)
    if k >= 1:
        return 0.0, 0.0, 0.0, 100.0
    c, m, y = ((1 - v - k) / (1 - k) for v in (r, g, b))
    return tuple(round(v * 100, 1) for v in (c, m, y, k))


def dark_swatches(spec):
    return {s["name"] for s in spec["swatches"]
            if sum(int(s["hex"][i:i + 2], 16) for i in (1, 3, 5)) < 3 * 90}


def fam(st):
    f = (st or {}).get("family") or ""
    return "Fraktur" if f == "UnifrakturMaguntia" else "Script" if f == "Caveat" else "Mono"


PLEX = {400: "Regular", 500: "Medium", 600: "SemiBold", 700: "Bold", 800: "Bold", 900: "Bold"}


def font(st):
    """(family, style) of a measured style, as the desktop fonts name them."""
    f = (st or {}).get("family") or "IBM Plex Mono"
    if f == "Caveat":
        return "Caveat", "Regular"
    if f == "UnifrakturMaguntia":
        return "UnifrakturMaguntia", "Book"
    w = min(PLEX, key=lambda k: abs(k - ((st or {}).get("weight") or 400)))
    style = PLEX[w]
    if (st or {}).get("italic"):
        style = "Italic" if style == "Regular" else style + " Italic"
    return "IBM Plex Mono", style


def styles(spec):
    """{(role, face, reversed): (name, measured style)}: one paragraph style per
    role and face, from its commonest form on pages printed at the magazine's
    text scale (0.8); a reversed twin of each for dark grounds."""
    forms = {}
    for p in spec["pages"]:
        for f in p["frames"]:
            st = f.get("style")
            if st and f["role"] in ROLE_NAMES:
                at_scale = abs((p.get("scale") or 1) - 0.8) < 0.02
                sig = (st.get("weight"), st.get("caps"), st.get("italic"), round(st["sizePt"] * 2) / 2)
                forms.setdefault((f["role"], fam(st)), []).append((at_scale, sig, st))
    faces = {}
    for role, fc in forms:
        faces.setdefault(role, []).append(fc)
    out = {}
    for (role, fc), xs in sorted(forms.items()):
        pool = [x for x in xs if x[0]] or xs
        common = Counter(x[1] for x in pool).most_common(1)[0][0]
        st = next(x[2] for x in pool if x[1] == common)
        for rev in (False, True):
            name = ROLE_NAMES[role] + ("" if len(faces[role]) == 1 else " · " + fc) + (" · reversed" if rev else "")
            out[(role, fc, rev)] = (name, st)
    return out


def style_for(f, page, spec, table):
    """The (name, measured style) a frame takes, and whether it needs its own
    size and leading because its page prints at another scale."""
    st = f.get("style") or {}
    dark = page["ground"] in dark_swatches(spec)
    rev = st.get("color") == "bone" or (dark and st.get("color") not in ("ink",)) or \
        (f["role"] == "cardhead" and f.get("fill") in dark_swatches(spec) | {"pink", "teal"})
    hit = table.get((f["role"], fam(st), bool(rev))) or table.get((f["role"], fam(st), False))
    if not hit:
        return None, False
    base = hit[1]
    own = bool(st.get("sizePt")) and (abs(st["sizePt"] - base["sizePt"]) > 0.005 * base["sizePt"] or
                                      abs(st["leadingPt"] - base["leadingPt"]) > 0.005 * base["leadingPt"])
    return hit, own


def label(f):
    """What a frame says until copy goes in: the copy it holds now, so a frame
    can be told from its neighbours, and for a writer's piece its word budget."""
    t = (f.get("text") or "").strip()
    role = ROLE_NAMES.get(f["role"], f["role"]).upper()
    if f.get("piece"):
        pc = f["piece"]
        return "%s — %s · %d words fit here (%d for the whole piece)" % (role, pc["path"], pc["limit"], pc["total"])
    if f["role"] in ("body", "cardbody", "dek") and t:
        t1 = t.replace("\n", " ")
        return "%s — %d words: %s" % (role, f.get("words") or 0, t1[:140] + ("…" if len(t1) > 140 else ""))
    return t[:160] if t else role


def text_lines(f):
    """The label as paragraphs."""
    t = label(f)
    return t.split("\n") if f["role"] in KEEP_BREAKS else [t.replace("\n", " ")]


def foot(spec):
    return "%s · %s" % (spec["title"], spec["theme"]) if spec.get("theme") else spec["title"]


COVERS = {"hero", "footer"}


def master_for(page, spec):
    """The master a page takes: none on the covers (no folio on a cover), "B"
    (the foot reversed, in bone) on a dark ground, "A" otherwise."""
    if page["key"] in COVERS:
        return None
    return "B" if page["ground"] in dark_swatches(spec) else "A"
