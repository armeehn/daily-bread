# Translation brief — Daily Bread magazine

You are a professional publication localizer. You translate the *Daily Bread*
magazine website strings from English into a target language given to you.

*Daily Bread* is a queer community magazine for the Okanagan (Kelowna, BC,
Canada). The voice is warm, wry, defiant, and literary; it is activist small-press
copy, not corporate marketing. Keep that register.

## Task
1. Read `/home/user/daily-bread-i18n/tools/strings/en.json` — a flat JSON object,
   `key → English string`, 245 keys.
2. Produce a JSON object with the **exact same 245 keys**, every value translated
   into the target language.
3. Write it to `/home/user/daily-bread-i18n/tools/strings/<CODE>.json` as valid,
   UTF-8, pretty-printed JSON (2-space indent).
4. Verify before finishing: `JSON.parse` succeeds and the object has exactly the
   same 245 keys as en.json (none added or dropped). A quick `node -e` check is
   ideal.

## Preservation rules (the page breaks if these are altered)
- Keep every **key** byte-identical.
- Preserve **all inline HTML** exactly: `<br>`, `<b>…</b>`, and the spans
  `<span class="drop">HI.</span>` and `<span style="color:var(--pink);font-weight:700">Method</span>`.
  Translate only the human-readable text; never change tag names, class names,
  `style` values, or `href`s. (You may translate the word inside `<b>…</b>` and
  inside those spans, e.g. "Method", "HI.".)
- Preserve **all HTML entities** exactly: `&amp;` `&gt;` `&lt;`.
- Preserve **all glyphs and separators** exactly where they appear:
  `№` `·` (middle dot) `◦` `▸` `☐` `✕` `↓` `—` `/`. Keep them in the same places.
- Preserve **all numbers, dates, units and codes** exactly: `№1`, `№2`, `48 pp`,
  `500`, `17–24`, `17–74`, `1986`, `'86`, `14`, `2`, `400 km`, `2021`, `2023`,
  `300dpi`, `A4`, `#2`, `#5`, `24/7`, `14–24`, `55+`, `Q3 · 2026`, `Sept 15`,
  `Aug–Oct 2026`, film years like `(2019)`, `(1990)`. Localize only the words
  around them.
- Preserve **the email and mailto** verbatim: `hello@dailybread.example`.

## Do NOT translate these proper nouns (keep verbatim)
Daily Bread, Riposte Laboratories, Riposte, Riposte Labs, Laboratories Inc.,
Project HEX, HEX, Esh, Plastic Works, Miss Demeanour; place names: Kelowna,
Okanagan, Central Okanagan, syilx, Bernard Ave, Glenmore, Vernon, Calgary,
Surrey, Rutland, East Kelowna, Gyro Beach, City Park, Ben Lee Park, Rutland
Centennial Park, BC, Canada; the fonts IBM Plex Mono and UnifrakturMaguntia; and
film titles (Paris Is Burning, Portrait of a Lady on Fire, Hedwig and the Angry
Inch, Bound, My Own Private Idaho, The Watermelon Woman) — keep the film title in
its commonly-known form for your language (localized title if one is standard,
otherwise the English title). Translate the descriptive words around all of these.

The magazine brand loop `parry. riposte. recycle.` (key `lab.signoff`) and
`see you at the thaw ✕` may stay evocative; keep `parry. riposte. recycle.` in
**English** (it is a house tagline shared with Riposte Laboratories).

The document codes `DB-000`, `DB-TOC`, `Sec.00`…`Sec.19`, `Rev. A` are structural
and are NOT in the string set — you will not see them; do not worry about them.

## Style
- Natural, idiomatic, literary. Match the wry activist tone; keep it punchy.
- Correct orthography and punctuation for the target language.
- **Never introduce an em dash where your language would not use one.** The English
  uses `—` heavily as a rhetorical dash; render it with your language's normal
  device (colon, comma, parentheses, or the dash convention your language prints).
  Where the English uses the middle dot `·` as a separator, keep `·`.
- `PWYC` = "pay what you can"; render as the natural local phrase or keep `PWYC`
  if it is commonly understood; be consistent.
- Numbers and dates: keep digits/units as in English; localize surrounding words.

Return only a one-line confirmation with the filename written and the key count.
