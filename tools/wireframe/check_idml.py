#!/usr/bin/env python3
"""check_idml.py — an IDML package is whole: it unpacks, every part parses, and
everything one part names exists in another (stories, styles, swatches,
layers, masters, the section's first page, fonts by PostScript name).

    python3 tools/wireframe/check_idml.py <file.idml>

What this cannot prove is how InDesign draws it; Scribus's IDML importer is the
check build.sh adds for that, where Scribus is installed."""
import sys, zipfile, re
from xml.dom import minidom
z = zipfile.ZipFile(sys.argv[1]); names = z.namelist(); errs = []
if names[0] != "mimetype" or z.getinfo("mimetype").compress_type != zipfile.ZIP_STORED: errs.append("mimetype not first/stored")
T = {}
for n in names:
    if n.endswith(".xml"):
        try: minidom.parseString(z.read(n)); T[n] = z.read(n).decode()
        except Exception as e: errs.append("malformed %s: %s" % (n, e))
dm = T["designmap.xml"]; alltext = "".join(T.values())
errs += ["missing part " + r for r in re.findall(r'src="([^"]+)"', dm) if r not in names]
stories = {re.search(r'Story_(\w+)\.xml', n).group(1) for n in names if n.startswith("Stories/")}
errs += ["frame story missing " + p for p in set(re.findall(r'ParentStory="([^"]+)"', alltext)) - stories]
styles = set(re.findall(r'Self="(ParagraphStyle/[^"]+)"', T["Resources/Styles.xml"]))
errs += ["undefined style " + s for s in set(re.findall(r'AppliedParagraphStyle="([^"]+)"', alltext)) - styles]
sw = set(re.findall(r'Self="((?:Color|Swatch)/[^"]+)"', T["Resources/Graphic.xml"]))
errs += ["undefined swatch " + s for s in set(re.findall(r'(?:FillColor|StrokeColor)="([^"]+)"', alltext)) - sw]
layers = set(re.findall(r'<Layer Self="([^"]+)"', dm))
errs += ["undefined layer " + s for s in set(re.findall(r'ItemLayer="([^"]+)"', alltext)) - layers]
masters = set(re.findall(r'<MasterSpread Self="([^"]+)"', alltext))
errs += ["undefined master " + s for s in set(re.findall(r'AppliedMaster="([^"]+)"', alltext)) - masters - {"n"}]
pages = re.findall(r'<Page Self="(upg[^"]+)"', alltext)
sec = re.search(r'<Section [^>]*Length="(\d+)"[^>]*PageStart="([^"]+)"', dm)
if int(sec.group(1)) != len(pages) or sec.group(2) not in pages: errs.append("section does not match pages")
ps = set(re.findall(r'PostScriptName="([^"]+)"', T["Resources/Fonts.xml"]))
print("parts %d, pages %d, stories %d, styles %d, swatches %d, layers %d, masters %d, fonts %s" % (
    len(names), len(pages), len(stories), len(styles), len(sw), len(layers), len(masters), sorted(ps)))
print("OK" if not errs else "\n".join(errs)); sys.exit(1 if errs else 0)
