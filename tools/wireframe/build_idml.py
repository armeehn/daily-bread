#!/usr/bin/env python3
"""build_idml.py — the page plan (spec.json) as an IDML package, for InDesign
and Affinity Publisher.

    python3 tools/wireframe/build_idml.py <spec.json> <out.idml>

The same document build_sla.py makes in Scribus, from the same plan (plan.py):
A5 facing pages from a right-hand page 1, 3 mm bleed, the magazine's margins
and two columns, a baseline grid, CMYK swatches, paragraph styles, a master
spread with a running foot and an automatic folio, and on every page the
section's ground, its pictures as empty graphic frames and its text as
labelled text frames, on Ground / Art / Text / Notes layers (Notes does not
print). Standard library only.

IDML is a zip of XML: designmap.xml names the parts; Resources/ holds the
swatches, fonts, styles and preferences; MasterSpreads/ and Spreads/ hold the
pages and their frames (in spread coordinates, points, y down, the spread's
origin at its centre); Stories/ holds each frame's text.
"""
import json
import os
import sys
import zipfile
from xml.sax.saxutils import escape, quoteattr

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from plan import PT, ROLE_NAMES, cmyk, dark_swatches, font, styles, style_for, text_lines, foot, master_for  # noqa: E402

DOM = "16.0"
PKG = 'xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging"'
HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'


def pt(mm):
    return mm / PT


def num(v):
    return ("%.4f" % v).rstrip("0").rstrip(".")


class Ids:
    def __init__(self):
        self.n = 0x100

    def __call__(self, prefix="u"):
        self.n += 1
        return "%s%x" % (prefix, self.n)


def path_geometry(x0, y0, x1, y1):
    pts = [(x0, y0), (x0, y1), (x1, y1), (x1, y0)]
    anchors = "".join('<PathPointType Anchor="{0} {1}" LeftDirection="{0} {1}" RightDirection="{0} {1}"/>'
                      .format(num(x), num(y)) for x, y in pts)
    return ('<Properties><PathGeometry><GeometryPathType PathOpen="false"><PathPointArray>%s'
            '</PathPointArray></GeometryPathType></PathGeometry></Properties>' % anchors)


def build(spec):
    ids = Ids()
    W, H = (pt(v) for v in spec["trimMm"])
    B = pt(spec["bleedMm"])
    M = {k: pt(v) for k, v in spec["marginsMm"].items()}
    cols = spec["columns"]
    N = len(spec["pages"])
    files = {}

    # ---- swatches -----------------------------------------------------------
    sw = {s["name"]: "Color/DB " + s["name"] for s in spec["swatches"]}
    colors = [
        '<Color Self="Color/Black" Model="Process" Space="CMYK" ColorValue="0 0 0 100" ColorOverride="Specialblack" '
        'AlternateSpace="NoAlternateColor" AlternateColorValue="" Name="Black" ColorEditable="false" ColorRemovable="false" Visible="true" SwatchCreatorID="7937"/>',
        '<Color Self="Color/Paper" Model="Process" Space="CMYK" ColorValue="0 0 0 0" ColorOverride="Specialpaper" '
        'AlternateSpace="NoAlternateColor" AlternateColorValue="" Name="Paper" ColorEditable="true" ColorRemovable="false" Visible="true" SwatchCreatorID="7937"/>',
        '<Color Self="Color/Registration" Model="Registration" Space="CMYK" ColorValue="100 100 100 100" ColorOverride="Specialregistration" '
        'AlternateSpace="NoAlternateColor" AlternateColorValue="" Name="Registration" ColorEditable="false" ColorRemovable="false" Visible="true" SwatchCreatorID="7937"/>',
    ]
    for s in spec["swatches"]:
        colors.append('<Color Self=%s Model="Process" Space="CMYK" ColorValue="%s" ColorOverride="Normal" '
                      'AlternateSpace="NoAlternateColor" AlternateColorValue="" Name=%s ColorEditable="true" ColorRemovable="true" Visible="true" SwatchCreatorID="7937"/>'
                      % (quoteattr(sw[s["name"]]), " ".join(num(v) for v in cmyk(s["hex"])), quoteattr("DB " + s["name"])))
    files["Resources/Graphic.xml"] = (HEAD + '<idPkg:Graphic %s DOMVersion="%s">\n%s\n'
        '<Swatch Self="Swatch/None" Name="None" ColorEditable="false" ColorRemovable="false" Visible="true" SwatchCreatorID="7937"/>\n'
        '<StrokeStyle Self="StrokeStyle/$ID/Solid" Name="$ID/Solid"/>\n</idPkg:Graphic>\n') % (PKG, DOM, "\n".join(colors))

    # ---- styles -------------------------------------------------------------
    table = styles(spec)
    just = {"left": "LeftAlign", "start": "LeftAlign", "center": "CenterAlign", "right": "RightAlign",
            "end": "RightAlign", "justify": "LeftJustified"}
    fonts_used = {}

    def para_style(name, st, colour):
        fam_, sty = font(st)
        fonts_used.setdefault(fam_, set()).add(sty)
        return ('<ParagraphStyle Self=%s Name=%s Imported="false" PointSize="%s" FontStyle=%s Capitalization="%s" '
                'Tracking="%s" Justification="%s" FillColor=%s KeyboardShortcut="0 0">'
                '<Properties><BasedOn type="string">$ID/NormalParagraphStyle</BasedOn>'
                '<Leading type="unit">%s</Leading><AppliedFont type="string">%s</AppliedFont></Properties></ParagraphStyle>'
                % (quoteattr("ParagraphStyle/" + name), quoteattr(name), num(max(4, st["sizePt"])), quoteattr(sty),
                   "AllCaps" if st.get("caps") else "Normal", num(round((st.get("trackingEm") or 0) * 1000)),
                   just.get(st.get("align"), "LeftAlign"), quoteattr(colour), num(st["leadingPt"]), escape(fam_)))

    pstyles = [para_style(name, st, sw.get("bone" if rev else "ink", "Color/Black"))
               for (_, _, rev), (name, st) in table.items()]
    folio_st = {"family": "IBM Plex Mono", "weight": 700, "sizePt": 6.5, "leadingPt": 8, "caps": True,
                "trackingEm": 0.14, "align": "left"}
    pstyles.append(para_style("Folio left", folio_st, sw.get("ink", "Color/Black")))
    pstyles.append(para_style("Folio right", dict(folio_st, align="right"), sw.get("ink", "Color/Black")))
    pstyles.append(para_style("Folio left · reversed", folio_st, sw.get("bone", "Color/Paper")))
    pstyles.append(para_style("Folio right · reversed", dict(folio_st, align="right"), sw.get("bone", "Color/Paper")))
    pstyles.append(para_style("Note", {"family": "IBM Plex Mono", "weight": 400, "sizePt": 6, "leadingPt": 7.5,
                                       "align": "center"}, sw.get("pink", "Color/Black")))
    files["Resources/Styles.xml"] = (HEAD + '<idPkg:Styles %s DOMVersion="%s">\n'
        '<RootCharacterStyleGroup Self="u79"><CharacterStyle Self="CharacterStyle/$ID/[No character style]" Imported="false" Name="$ID/[No character style]"/></RootCharacterStyleGroup>\n'
        '<RootParagraphStyleGroup Self="u78">'
        '<ParagraphStyle Self="ParagraphStyle/$ID/[No paragraph style]" Name="$ID/[No paragraph style]" Imported="false"/>'
        '<ParagraphStyle Self="ParagraphStyle/$ID/NormalParagraphStyle" Name="$ID/NormalParagraphStyle" Imported="false" PointSize="9.3" FontStyle="Regular">'
        '<Properties><Leading type="unit">15</Leading><AppliedFont type="string">IBM Plex Mono</AppliedFont></Properties></ParagraphStyle>\n%s\n'
        '</RootParagraphStyleGroup>\n'
        '<RootCellStyleGroup Self="u8a"><CellStyle Self="CellStyle/$ID/[None]" Name="$ID/[None]"/></RootCellStyleGroup>\n'
        '<RootTableStyleGroup Self="u8b"><TableStyle Self="TableStyle/$ID/[No table style]" Name="$ID/[No table style]"/></RootTableStyleGroup>\n'
        '<RootObjectStyleGroup Self="u8c"><ObjectStyle Self="ObjectStyle/$ID/[None]" Name="$ID/[None]"/>'
        '<ObjectStyle Self="ObjectStyle/$ID/[Normal Graphics Frame]" Name="$ID/[Normal Graphics Frame]"/>'
        '<ObjectStyle Self="ObjectStyle/$ID/[Normal Text Frame]" Name="$ID/[Normal Text Frame]"/></RootObjectStyleGroup>\n'
        '</idPkg:Styles>\n') % (PKG, DOM, "\n".join(pstyles))

    # PostScript names of the font files the package ships (fonts/): what InDesign,
    # Affinity and Scribus match a style's font by
    PS = {("IBM Plex Mono", "Regular"): "IBMPlexMono", ("IBM Plex Mono", "Italic"): "IBMPlexMono-Italic",
          ("IBM Plex Mono", "Medium"): "IBMPlexMono-Medm", ("IBM Plex Mono", "Medium Italic"): "IBMPlexMono-MedmItalic",
          ("IBM Plex Mono", "SemiBold"): "IBMPlexMono-SmBld", ("IBM Plex Mono", "SemiBold Italic"): "IBMPlexMono-SmBldItalic",
          ("IBM Plex Mono", "Bold"): "IBMPlexMono-Bold", ("IBM Plex Mono", "Bold Italic"): "IBMPlexMono-BoldItalic",
          ("Caveat", "Regular"): "Caveat-Regular", ("UnifrakturMaguntia", "Book"): "UnifrakturMaguntia"}
    fonts_used.setdefault("IBM Plex Mono", set()).add("Regular")
    fam_xml = []
    for i, (fam_, stys) in enumerate(sorted(fonts_used.items())):
        fid = "di%x" % (0x500 + i)
        fam_xml.append('<FontFamily Self="%s" Name=%s>%s</FontFamily>' % (fid, quoteattr(fam_), "".join(
            '<Font Self="%sFont%d" FontFamily=%s Name=%s PostScriptName=%s FontStyleName=%s Status="Installed" FontType="TrueType"/>'
            % (fid, j, quoteattr(fam_), quoteattr(fam_ + " " + s), quoteattr(PS.get((fam_, s), (fam_ + "-" + s).replace(" ", ""))),
               quoteattr(s)) for j, s in enumerate(sorted(stys)))))
    files["Resources/Fonts.xml"] = HEAD + '<idPkg:Fonts %s DOMVersion="%s">\n%s\n</idPkg:Fonts>\n' % (PKG, DOM, "\n".join(fam_xml))

    # ---- preferences ----------------------------------------------------------
    gut = pt(cols["gutterMm"])
    files["Resources/Preferences.xml"] = (HEAD + '<idPkg:Preferences %s DOMVersion="%s">\n'
        '<DocumentPreference PageHeight="%s" PageWidth="%s" PagesPerDocument="%d" FacingPages="true" '
        'DocumentBleedTopOffset="%s" DocumentBleedBottomOffset="%s" DocumentBleedInsideOrLeftOffset="%s" DocumentBleedOutsideOrRightOffset="%s" '
        'DocumentBleedUniformSize="true" SlugTopOffset="0" SlugBottomOffset="0" SlugInsideOrLeftOffset="0" SlugRightOrOutsideOffset="0" '
        'DocumentSlugUniformSize="true" PreserveLayoutWhenShuffling="true" AllowPageShuffle="true" OverprintBlack="true" '
        'PageBinding="LeftToRight" ColumnDirection="Horizontal" Intent="PrintIntent" StartPageNumber="1"/>\n'
        '<MarginPreference ColumnCount="%d" ColumnGutter="%s" Top="%s" Bottom="%s" Left="%s" Right="%s" ColumnDirection="Horizontal" ColumnsPositions="0 %s"/>\n'
        '<GridPreference BaselineStart="%s" BaselineDivision="%s" BaselineShown="false" BaselineGridShown="false" '
        'BaselineGridRelativeOption="TopOfPageOfBaselineGridRelativeOption" DocumentGridShown="false" DocumentGridSnapto="false" '
        'HorizontalGridlineDivision="72" HorizontalGridSubdivision="8" VerticalGridlineDivision="72" VerticalGridSubdivision="8"/>\n'
        '</idPkg:Preferences>\n') % (
        PKG, DOM, num(H), num(W), N, num(B), num(B), num(B), num(B),
        cols["count"], num(gut), num(M["top"]), num(M["bottom"]), num(M["inside"]), num(M["outside"]),
        num(W - M["inside"] - M["outside"]), num(M["top"]), num(spec["baselinePt"]))

    # ---- layers -----------------------------------------------------------------
    layers = [("Ground", "LightBlue", True), ("Art", "Red", True), ("Text", "Green", True), ("Notes", "Magenta", False)]
    L = {name: ids("ul") for name, _, _ in layers}

    def margin_xml(left_page):
        inside, outside = M["inside"], M["outside"]
        l_, r_ = (outside, inside) if left_page else (inside, outside)
        return ('<MarginPreference ColumnCount="%d" ColumnGutter="%s" Top="%s" Bottom="%s" Left="%s" Right="%s" '
                'ColumnDirection="Horizontal" ColumnsPositions="0 %s"/>' % (
                    cols["count"], num(gut), num(M["top"]), num(M["bottom"]), num(l_), num(r_), num(W - l_ - r_)))

    stories = []

    def story(paras, pstyle, override=None, extra=None):
        """paras: [str]; override: (size, leading) for the frame's own scale;
        extra: [(text, size, leading, fontstyle)] paragraphs after (a stat's label)."""
        sid = ids()
        attrs = ""
        props = ""
        if override:
            attrs = ' PointSize="%s"' % num(override[0])
            props = '<Properties><Leading type="unit">%s</Leading></Properties>' % num(override[1])
        body = "<Br/>".join("<Content>%s</Content>" % escape(p) for p in paras)
        runs = '<CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]"%s>%s%s</CharacterStyleRange>' % (attrs, props, body)
        for text, size, lead, fstyle in (extra or []):
            runs += ('<CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]" PointSize="%s" FontStyle=%s>'
                     '<Properties><Leading type="unit">%s</Leading></Properties><Br/><Content>%s</Content></CharacterStyleRange>'
                     % (num(size), quoteattr(fstyle), num(lead), escape(text)))
        stories.append((sid, (HEAD + '<idPkg:Story %s DOMVersion="%s"><Story Self="%s" AppliedTOCStyle="n" TrackChanges="false" '
                       'StoryTitle="$ID/" AppliedNamedGrid="n"><StoryPreference OpticalMarginAlignment="false" OpticalMarginSize="12" '
                       'FrameType="TextFrameType" StoryOrientation="Horizontal" StoryDirection="LeftToRightDirection"/>'
                       '<ParagraphStyleRange AppliedParagraphStyle=%s>%s</ParagraphStyleRange></Story></idPkg:Story>\n')
                       % (PKG, DOM, sid, quoteattr("ParagraphStyle/" + pstyle), runs)))
        return sid

    def text_frame(layer, x0, y0, x1, y1, sid, name, inset=(0, 0, 0, 0)):
        return ('<TextFrame Self="%s" Name=%s ParentStory="%s" PreviousTextFrame="n" NextTextFrame="n" ContentType="TextType" '
                'ItemLayer="%s" FillColor="Swatch/None" StrokeColor="Swatch/None" StrokeWeight="0" ItemTransform="1 0 0 1 0 0">'
                '%s<TextFramePreference TextColumnCount="1" FirstBaselineOffset="LeadingOffset" UseNoLineBreaksForAutoSizing="false" '
                'InsetSpacing="%s"/></TextFrame>' % (ids(), quoteattr(name), sid, L[layer],
                                                     path_geometry(x0, y0, x1, y1), " ".join(num(pt(v)) for v in inset)))

    def rect(layer, x0, y0, x1, y1, name, fill, stroke="Swatch/None", weight=0, graphic=False):
        return ('<Rectangle Self="%s" Name=%s ContentType="%s" ItemLayer="%s" FillColor=%s StrokeColor=%s StrokeWeight="%s" '
                'ItemTransform="1 0 0 1 0 0">%s</Rectangle>' % (ids(), quoteattr(name), "GraphicType" if graphic else "Unassigned",
                                                              L[layer], quoteattr(fill), quoteattr(stroke), num(weight),
                                                              path_geometry(x0, y0, x1, y1)))

    # ---- master spreads: running foot and folio, mirrored; B reversed for dark grounds
    FOOT = foot(spec)
    fy0, fy1 = H - M["bottom"] + pt(4), H - M["bottom"] + pt(9)
    masters = {}
    for prefix, sfx in (("A", ""), ("B", " · reversed")):
        mid = "um" + prefix.lower()
        masters[prefix] = mid
        mitems = []
        for left_page, tx in ((True, -W), (False, 0.0)):
            ty = -H / 2
            x0 = tx + (M["outside"] if left_page else M["inside"])
            x1 = tx + W - (M["inside"] if left_page else M["outside"])
            folio = story(["\x00ACE18"], ("Folio left" if left_page else "Folio right") + sfx)
            tagline = story([FOOT], ("Folio right" if left_page else "Folio left") + sfx)
            mitems.append(text_frame("Text", x0, ty + fy0, x1, ty + fy1, folio, "folio"))
            mitems.append(text_frame("Text", x0, ty + fy0, x1, ty + fy1, tagline, "running foot"))
        files["MasterSpreads/MasterSpread_%s.xml" % mid] = (HEAD + '<idPkg:MasterSpread %s DOMVersion="%s">'
            '<MasterSpread Self="%s" Name="%s-%s" NamePrefix="%s" BaseName="%s" ShowMasterItems="true" PageCount="2" '
            'OverriddenPageItemProps="" PrimaryTextFrame="n" ItemTransform="1 0 0 1 0 0">'
            '<Page Self="%sp1" Name="%s" AppliedTrapPreset="TrapPreset/$ID/kDefaultTrapStyleName" GeometricBounds="0 0 %s %s" '
            'ItemTransform="1 0 0 1 %s %s" OverrideList="" AppliedMaster="n" MasterPageTransform="1 0 0 1 0 0" TabOrder="" '
            'GridStartingPoint="TopOutside" UseMasterGrid="true">%s</Page>'
            '<Page Self="%sp2" Name="%s" AppliedTrapPreset="TrapPreset/$ID/kDefaultTrapStyleName" GeometricBounds="0 0 %s %s" '
            'ItemTransform="1 0 0 1 0 %s" OverrideList="" AppliedMaster="n" MasterPageTransform="1 0 0 1 0 0" TabOrder="" '
            'GridStartingPoint="TopOutside" UseMasterGrid="true">%s</Page>%s</MasterSpread></idPkg:MasterSpread>\n') % (
            PKG, DOM, mid, prefix, "Light" if prefix == "A" else "Dark", prefix, "Light" if prefix == "A" else "Dark",
            mid, prefix, num(H), num(W), num(-W), num(-H / 2), margin_xml(True),
            mid, prefix, num(H), num(W), num(-H / 2), margin_xml(False), "".join(mitems))

    # ---- the pages ----------------------------------------------------------------
    dark = dark_swatches(spec)
    spreads, page_ids = [], []
    groups = [[1]] + [[n, n + 1] if n + 1 <= N else [n] for n in range(2, N + 1, 2)]
    by_n = {p["n"]: p for p in spec["pages"]}
    for si, group in enumerate(groups):
        spid = ids("usp")
        pages_xml, items = [], []
        for n in group:
            page = by_n[n]
            left_page = n % 2 == 0
            tx, ty = (-W if left_page else 0.0), -H / 2
            pid = ids("upg")
            page_ids.append(pid)
            pages_xml.append(
                '<Page Self="%s" Name="%d" AppliedTrapPreset="TrapPreset/$ID/kDefaultTrapStyleName" GeometricBounds="0 0 %s %s" '
                'ItemTransform="1 0 0 1 %s %s" OverrideList="" AppliedMaster="%s" MasterPageTransform="1 0 0 1 0 0" TabOrder="" '
                'GridStartingPoint="TopOutside" UseMasterGrid="true">%s</Page>' % (
                    pid, n, num(H), num(W), num(tx), num(ty), masters[master_for(page, spec)] if master_for(page, spec) else "n",
                    margin_xml(left_page)))
            X = lambda mm: tx + pt(mm)                    # noqa: E731
            Y = lambda mm: ty + pt(mm)                    # noqa: E731
            # the ground bleeds off the outer edge, the head and the foot, never across the spine
            gx0 = tx - (B if left_page else 0)
            gx1 = tx + W + (0 if left_page else B)
            items.append(rect("Ground", gx0, ty - B, gx1, ty + H + B, "p%02d ground" % n,
                              sw.get(page["ground"] or "bone", "Color/Paper")))
            for f in page["frames"]:
                role = f["role"]
                x0, y0, x1, y1 = X(f["x"]), Y(f["y"]), X(f["x"] + f["w"]), Y(f["y"] + f["h"])
                nm = "p%02d %s %s" % (n, page["key"], ROLE_NAMES.get(role, role).lower())
                if role == "image":
                    items.append(rect("Art", x0, y0, x1, y1, nm, sw.get("panel", "Color/Paper"),
                                      sw.get("muted", "Color/Black"), 0.5, graphic=True))
                    sid = story(["IMAGE — " + (f.get("alt") or "picture")[:120]], "Note")
                    cy = (y0 + y1) / 2
                    items.append(text_frame("Notes", x0 + pt(2), cy - pt(6), x1 - pt(2), cy + pt(6), sid, nm + " note"))
                    continue
                if role in ("card", "stat"):
                    if f.get("shadow") or role == "stat":
                        o = pt(1.27)
                        items.append(rect("Art", x0 + o, y0 + o, x1 + o, y1 + o, nm + " shadow", sw.get("ink", "Color/Black")))
                    items.append(rect("Art", x0, y0, x1, y1, nm, sw.get(f.get("fill") or ("dark" if page["ground"] in dark else "bone"), "Color/Paper"),
                                      sw.get(f.get("stroke") or "ink", "Color/Black"), 1.2))
                    if role == "card":
                        continue
                if role == "cardhead" and f.get("fill"):
                    items.append(rect("Art", x0, y0, x1, y1, nm + " bar", sw.get(f["fill"], "Color/Black")))
                if role not in ROLE_NAMES:
                    continue
                st = f.get("style") or {}
                hit, own = style_for(f, page, spec, table)
                pname = hit[0] if hit else "$ID/NormalParagraphStyle"
                lines = text_lines(f)
                extra = None
                if role == "stat" and len(lines) > 1:
                    size = (st.get("sizePt") or 26)
                    extra = [(" ".join(lines[1:]), max(4.0, size * 0.23), max(5.0, size * 0.36), "Regular")]
                    lines = lines[:1]
                sid = story(lines, pname, (max(4.0, st["sizePt"]), st["leadingPt"]) if own else None, extra)
                pad = (0.6 if role in ("headline", "wordmark", "pull") else 0.35) * (st.get("leadingPt") or 10)
                inset = (2, 3, 1, 3) if role == "cardhead" else (3.0, 3.4, 3.0, 3.4) if role == "cardbody" else (0, 0, 0, 0)
                items.append(text_frame("Text", x0, y0, x0 + (x1 - x0) * 1.04, y1 + pad, sid, nm, inset))
        files["Spreads/Spread_%s.xml" % spid] = (HEAD + '<idPkg:Spread %s DOMVersion="%s"><Spread Self="%s" PageCount="%d" '
            'BindingLocation="%d" AllowPageShuffle="true" ItemTransform="1 0 0 1 0 %s" ShowMasterItems="true" '
            'PageTransitionType="None" PageTransitionDirection="NotApplicable" PageTransitionDuration="Medium" FlattenerOverride="Default">'
            '%s%s</Spread></idPkg:Spread>\n') % (PKG, DOM, spid, len(group), 0 if len(group) == 1 else 1,
                                                 num(si * (H + 72)), "".join(pages_xml), "".join(items))
        spreads.append(spid)

    for sid, xml in stories:
        # the folio: InDesign's automatic page number is a processing instruction in the text
        files["Stories/Story_%s.xml" % sid] = xml.replace("<Content>\x00ACE18</Content>", "<Content><?ACE 18?></Content>")

    files["XML/Tags.xml"] = (HEAD + '<idPkg:Tags %s DOMVersion="%s"><XMLTag Self="XMLTag/Root" Name="Root">'
                             '<Properties><TagColor type="enumeration">LightBlue</TagColor></Properties></XMLTag></idPkg:Tags>\n') % (PKG, DOM)
    files["XML/BackingStory.xml"] = (HEAD + '<idPkg:BackingStory %s DOMVersion="%s"><XmlStory Self="ubs" AppliedTOCStyle="n" '
                                     'TrackChanges="false" StoryTitle="$ID/" AppliedNamedGrid="n"><ParagraphStyleRange '
                                     'AppliedParagraphStyle="ParagraphStyle/$ID/NormalParagraphStyle"><CharacterStyleRange '
                                     'AppliedCharacterStyle="CharacterStyle/$ID/[No character style]"/></ParagraphStyleRange>'
                                     '</XmlStory></idPkg:BackingStory>\n') % (PKG, DOM)

    layer_xml = "".join(
        '<Layer Self="%s" Name=%s Visible="true" Locked="false" IgnoreWrap="false" ShowGuides="true" LockGuides="false" '
        'UI="true" Expendable="true" Printable="%s"><Properties><LayerColor type="enumeration">%s</LayerColor></Properties></Layer>'
        % (L[name], quoteattr(name), "true" if printable else "false", colour) for name, colour, printable in layers)
    files["designmap.xml"] = (HEAD + '<?aid style="50" type="document" readerVersion="6.0" featureSet="257" product="16.0(98)" ?>\n'
        '<Document %s DOMVersion="%s" Self="d" StoryList="%s" Name=%s ZeroPoint="0 0" ActiveLayer="%s" '
        'CMYKProfile="Coated FOGRA39 (ISO 12647-2:2004)" RGBProfile="sRGB IEC61966-2.1" SolidColorIntent="UseColorSettings" '
        'AfterBlendingIntent="UseColorSettings" DefaultImageIntent="UseColorSettings" RGBPolicy="PreserveEmbeddedProfiles" '
        'CMYKPolicy="CombinationOfPreserveAndSafeCmyk" AccurateLABSpots="false">\n'
        '<idPkg:Graphic src="Resources/Graphic.xml"/>\n<idPkg:Fonts src="Resources/Fonts.xml"/>\n'
        '<idPkg:Styles src="Resources/Styles.xml"/>\n<idPkg:Preferences src="Resources/Preferences.xml"/>\n'
        '<idPkg:Tags src="XML/Tags.xml"/>\n%s\n%s\n%s\n'
        '<Section Self="usec" Length="%d" Name="" ComboName="" PageNumberStyle="Arabic" ContinueNumbering="false" '
        'IncludeSectionPrefix="false" PageNumberStart="1" SectionPrefix="" PageStart="%s" Marker=""/>\n'
        '<idPkg:BackingStory src="XML/BackingStory.xml"/>\n%s\n</Document>\n') % (
        PKG, DOM, " ".join(["ubs"] + [s for s, _ in stories]), quoteattr(spec["title"] + " — wireframe"), L["Text"],
        layer_xml,
        "\n".join('<idPkg:MasterSpread src="MasterSpreads/MasterSpread_%s.xml"/>' % m for m in masters.values()),
        "\n".join('<idPkg:Spread src="Spreads/Spread_%s.xml"/>' % s for s in spreads),
        N, page_ids[0],
        "\n".join('<idPkg:Story src="Stories/Story_%s.xml"/>' % s for s, _ in stories))
    files["META-INF/container.xml"] = (HEAD + '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">'
                                       '<rootfiles><rootfile full-path="designmap.xml" media-type="text/xml"/></rootfiles></container>\n')
    return files


def write(files, out):
    with zipfile.ZipFile(out, "w") as z:
        # the mimetype first and stored, as the IDML package format requires
        z.writestr(zipfile.ZipInfo("mimetype"), "application/vnd.adobe.indesign-idml-package", compress_type=zipfile.ZIP_STORED)
        for name in sorted(files):
            z.writestr(name, files[name], compress_type=zipfile.ZIP_DEFLATED)


if __name__ == "__main__":
    spec = json.load(open(sys.argv[1], encoding="utf-8"))
    files = build(spec)
    write(files, sys.argv[2])
    n_frames = sum(f.count("<TextFrame ") + f.count("<Rectangle ") for k, f in files.items() if k.startswith("Spreads/"))
    print("%s: %d pages, %d page items, %d stories, %d parts" % (
        sys.argv[2], len(spec["pages"]), n_frames, sum(1 for k in files if k.startswith("Stories/")), len(files) + 1))
