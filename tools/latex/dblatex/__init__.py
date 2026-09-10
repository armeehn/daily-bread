"""Daily Bread LaTeX pipeline.

One .tex per edition is the source of truth. Two consumers:

    content/<edition>.tex
            |
            |  reader.py  (hand-written parser over the documented macros)
            v
       issue dict  {meta, pages:[{id, template, variant, slug, chrome, content}]}
            |                                   |
            |  web.py                           |  press.py
            v                                   v
    content/<edition>.js               build/latex/<edition>/print.pdf   (A5, one-up)
    node tools/build.js                build/latex/<edition>/booklet.pdf (Letter landscape, 2-up)
    (unchanged renderer + newsproof)   via lualatex + tools/latex/dailybread.cls

Layers only talk to their neighbour: cli -> {web, press} -> reader/writer ->
model. Nothing below `web` knows about node; nothing below `press` knows about
lualatex.
"""
