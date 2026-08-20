/* ============================================================================
   Daily Bread · English strings (source of truth for the multilingual build)
   ----------------------------------------------------------------------------
   One key = one translatable unit. tools/build.js renders the page from these;
   tools/strings/<lang>.json supplies translations (same keys; missing -> English).
   Inline HTML (<br>, <b>, <span ...>) and glyphs (№ · ◦ ▸ ✕ ↓ ☐) are part of
   the string and MUST be preserved verbatim by translators.

   NOT EVERY VALUE IS WRITTEN HERE. Ninety-four of them read `at('…')` instead —
   they come from content/issue-01.js, the same file the print edition compiles
   from, because they are the same fact set twice: the calendar entries, the
   directory lines, the screenings, the contents table, the collapse ledger, the
   lab's status board. A date the magazine moved has one place to change.

   The rest stays written here, and should. The website is not the magazine —
   roughly two thirds of these keys say something the printed page never says,
   and making them agree would mean rewriting the site's copy rather than
   sharing it. See tools/strings/from-issue.js for how an address resolves.

   Keys and their order are unchanged by this arrangement, so every
   tools/strings/<lang>.json keeps working exactly as before.
   ============================================================================ */
const { at } = require('./from-issue.js');

module.exports = {
  /* ---- <head> / social ---- */
  'meta.title': "Daily Bread №1 · Kelowna's Collapse · A Queer Magazine for the Okanagan",
  'meta.desc': "Daily Bread is a queer magazine for the Okanagan, baked quarterly in Kelowna, BC. Issue №1: Kelowna's Collapse. Free where you found it; pay what you can where you can't. Funded by Riposte Laboratories.",
  'meta.ogTitle': "Daily Bread №1 — Kelowna's Collapse",
  'meta.ogDesc': "A queer magazine for the Okanagan. Free / PWYC. Issue №1, Summer 2026.",

  /* ---- top-bar navigation ---- */
  'nav.letter': 'Letter',
  'nav.contents': at('p02.content.title'),
  'nav.history': 'History',
  'nav.voices': 'Voices',
  'nav.comics': 'Comics',
  'nav.art': 'Art',
  'nav.calendar': 'Calendar',
  'nav.directory': 'Directory',
  'nav.submit': 'Submit',
  'nav.lab': 'The Lab',
  'nav.stickers': 'Stickers',

  /* ---- hero ---- */
  'hero.tagline': 'A Queer Magazine for the Okanagan',
  'hero.intro': "You found the first issue of a queer magazine in a city that keeps telling us it doesn't have one. Kelowna has queer history, queer kids, queer elders, queer bakers and bureaucrats; what it hasn't had is paper that says so out loud.",
  'hero.issueA': 'Issue №1 · Summer 2026',
  'hero.issueB': "Kelowna's Collapse · 48 pp · Print run 500",
  'hero.batch': 'Batch №1 · Fresh',
  'hero.read': 'Read the issue ↓',
  'hero.sheet': 'Sheet 00 · Front cover',
  'hero.coverAlt': 'Daily Bread №1 cover — an open mouth with dripping teeth over a jewelled tongue, blackletter wordmark overlaid',
  'hero.capA': "№1 — Kelowna's Collapse",
  'hero.capB': 'Riposte Laboratories',
  'hero.free': 'Free / PWYC',

  /* ---- Sec.00 · editor's letter ---- */
  'letter.tag': "// editor's letter",
  'letter.h': 'Our Daily<br>Dread',
  'letter.p1': "<span class=\"drop\">HI.</span> You found the first issue of a queer magazine in a city that keeps telling us it doesn't have one. Kelowna has queer history, queer kids, queer elders, queer bakers and bureaucrats; what it hasn't had is paper that says so out loud.",
  'letter.p2': "This issue is about collapse: the orchards, the venues, the rent math, the bridge traffic. Not because we're doomers, but because things fall apart here on schedule, and naming the schedule is the first act of repair.",
  'letter.p3': at('ic.content.body[2]'),
  'letter.signoff': at('ic.content.signoff'),
  'letter.mastHd': 'Masthead / №1 · Summer 2026',
  'letter.mh1L': 'Editor',
  'letter.mh1V': at('ic.content.masthead[0]|1'),
  'letter.mh2L': 'Art + comics',
  'letter.mh2V': 'open call',
  'letter.mh3L': 'Young voices desk',
  'letter.mh3V': 'three writers, 17–24',
  'letter.mh4L': 'Printed on',
  'letter.mh4V': 'unceded syilx territory',
  'letter.landback': at('ic.content.ack'),
  'letter.funded': 'Funded by Riposte<br>Laboratories Inc.',

  /* ---- Sec.01 · contents ---- */
  'contents.tag': '// contents · manifest / 48 pp',
  'contents.h': at('p02.content.title'),
  'contents.dek': at('p02.content.whoBlurb'),
  'contents.mfHd': 'Manifest / 48 pp',

  /* ---- Sec.02 · history + ledger ---- */
  'history.tag': '// history · before the bridge',
  'history.h': 'A Rude<br>History',
  'history.p1': 'The valley sold itself twice: first as Eden, then as equity. Fruit ranchers went broke so often the packinghouses printed their own scrip; when fruit died, the pitch became retirement sun; when the retirees priced out the pickers, the pitch became lakeside lofts. Each act ended the same way, with the people who did the work living further from the water.',
  'history.p2': "The queer history is braided through all of it: dance halls with unofficial nights, friendship networks that doubled as housing lists, a scene that survived by being useful and quiet until it didn't have to be.",
  'history.annot': "\"quiet until it didn't have to be\" — put on a shirt",
  'history.ledgerKicker': 'Ledger / what collapsed when',
  'history.entryHd': 'Entry',
  'history.statusHd': 'Status',
  'history.method': '<span style="color:var(--pink);font-weight:700">Method</span> — compiled from city archives, newspaper morgues, and elders who were there. Corrections welcome and expected.',

  /* ---- Sec.03 · young voices ---- */
  'voices.tag': '// young voices desk · unreviewed. unedited. correct.',
  'voices.h': 'Young Voices',
  'voices.dek': "Three field reports from writers who can't vote yet but can already do the rent math. We paid them; we didn't touch a word.",
  'voices.r1tag': 'Report 01',
  'voices.r1meta': 'Age 19 · Housing',
  'voices.r1h': at('p11.content.title'),
  'voices.r1p': "I work two jobs and split a two-bedroom with three people, and I'm the success story. My group chat is a slow-motion goodbye party: Vernon, Calgary, mom's basement in Surrey.",
  'voices.r1pull': '"Every viewing is forty people deep and one of them is always crying."',
  'voices.r2tag': 'Report 02',
  'voices.r2meta': 'Age 22 · Coming out',
  'voices.r2h': at('p12.content.title'),
  'voices.r2p': 'I came out at a bush party in Glenmore and the worst thing that happened was a guy named Tyler said "cool" and asked if I could drive him home. Not paradise, not hell, just a small city learning faster than its city council.',
  'voices.r2pull': 'geography is the last closet',
  'voices.r3tag': 'Report 03',
  'voices.r3meta': 'Age 17 · Fire season',
  'voices.r3h': at('p13.content.title'),
  'voices.r3p': 'My childhood photos are sorted by smoke year. We packed the car in 2021 and again in 2023, and both times the adults on the radio called it unprecedented. It has precedent.',
  'voices.r3pull': '"I am the precedent."',

  /* ---- waitlist stats ---- */
  'waitlist.kicker': '10 · Current issues',
  'waitlist.h': at('p25.content.title'),
  'waitlist.dek': "Trying to find queer-competent healthcare in the Central Okanagan is a part-time job with no benefits. We phoned every clinic so you don't have to; everyone we reached described the same triangle of phone tag, referral limbo, and a highway.",
  'waitlist.s1': 'Months · avg gender clinic wait',
  'waitlist.s2': 'Providers taking new patients',
  'waitlist.s3': 'km to the nearest alternative',

  /* ---- Sec.05 · interview ---- */
  'interview.tag': '// interview · forty years of nerve',
  'interview.quote': "We didn't have a bar, darling. We had basements, and we had nerve.",
  'interview.attrib': 'Miss Demeanour · performing in the Okanagan since 1986',
  'interview.body': "\"The audience got younger and the rent got meaner. In '86 the danger was people; now the danger is landlords. Where did everyone go when the venues closed? Nowhere, sweetheart; that's the secret. We're all still here, we just meet in gymnasiums and orchards and each other's kitchens. A scene isn't an address.\"",

  /* ---- Sec.14 · calendar ---- */
  'calendar.tag': '// the calendar · aug–oct 2026 · clip + fridge',
  'calendar.h': at('p36.content.title'),
  'calendar.dek': 'Listings are free; email by the 15th. Sober and all-ages options marked ◦.',
  'calendar.evHd': 'Aug — Oct 2026',
  'calendar.evHd2': 'Clip + fridge',
  'calendar.moviesKicker': 'Movies in the park / hosted by Daily Bread',
  'calendar.scHd': 'Summer slate / at dusk',
  'calendar.scHd2': 'Rain moves us to the Lab',
  'calendar.scFine': 'Free / PWYC · captions on · projector + power: reclaimed cells, Project HEX',
  'calendar.voteHd': 'Vote — October screening',
  'calendar.vote1': at('p37.content.votes[0]'),
  'calendar.vote2': at('p37.content.votes[1]'),
  'calendar.vote3': at('p37.content.votes[2]'),
  'calendar.voteFine': 'Mark one · photograph · send. Film democracy.',

  /* ---- Sec.18 · directory ---- */
  'directory.tag': '// mutual aid · keep this page · verified quarterly',
  'directory.kicker': 'Keep this page / directory',
  'directory.hd': 'Verified quarterly · tear out ok',
  'directory.note': 'A resource missing? Wrong number? Tell us — this page is the whole point.',
  'directory.helpsKicker': 'What actually helps / checklist',
  'directory.helpsHd': 'Field-tested',
  'directory.help1': 'The informed-consent clinic list — updated quarterly',
  'directory.help2': at('p05.content.checklist[1]'),
  'directory.help3': at('p05.content.checklist[2]'),
  'directory.help4': at('p05.content.checklist[3]'),
  'directory.annot': 'shout out Deb, seriously',

  /* ---- Sec.19 · submit ---- */
  'submit.tag': '// submissions · №2 — "the thaw"',
  'submit.h': 'Get Crumbs<br>On It',
  'submit.dek': 'Serialized fiction, an open centrefold, a young-voices desk, a directory that stays current: №1 is a first draft of a scene arguing it exists. №2 is "The Thaw" — what comes back. Send us your fury and your recipes.',
  'submit.deadline': 'Deadline · Sept 15',
  'submit.annot': 'send poems. weird welcome.',
  'submit.takeHd': 'What we take',
  'submit.take1': '▸ <b>Art for the centrefold</b> — A4 landscape, 300dpi, any medium. We pay; rights stay yours.',
  'submit.take2': '▸ <b>Opinion (under 25)</b> — 500 words of correct anger.',
  'submit.take3': '▸ <b>Poems &amp; fiction</b> — we read everything twice.',
  'submit.take4': '▸ <b>Comics</b> — pitch us six panels for the guest slot.',
  'submit.take5': '▸ <b>Listings &amp; corrections</b> — free, always.',
  'submit.voteHd': 'Vote — №2 theme',
  'submit.vote1': 'The Thaw (what comes back)',
  'submit.vote2': 'Water Rights &amp; Wrongs',
  'submit.vote3': 'Night Shift (who runs 2AM Kelowna)',
  'submit.voteFine': 'Mark one · photograph · send. Democracy.',

  /* ---- Sec.16 · from the lab ---- */
  'lab.tag': '// from the lab · funder disclosure, printed large',
  'lab.labInc': 'Laboratories Inc.',
  'lab.h': at('p30.content.title'),
  'lab.p1': "Full disclosure, printed large: this magazine is funded by Riposte Laboratories, a Kelowna outfit that counter-attacks waste with recycled-plastic injection molding and reclaimed-cell modular power. We share what we're building here, in the same pages, at the same volume as everyone else.",
  'lab.p2': at('p30.content.body[1]'),
  'lab.stamp': 'Funder disclosure · signed',
  'lab.signoff': at('p30.content.sig'),
  'lab.kicker': 'This quarter / status board',
  'lab.whyHd': 'Why fund a magazine?',
  'lab.whyBody': at('p30.content.whyBody'),
  'lab.tour': 'Tour the shop: open doors first Fridays · bring clean #2 + #5 plastics.',

  /* ---- footer / back cover ---- */
  'footer.blurb': "Daily Bread is baked quarterly in Kelowna, BC. Free where you found it. Pay what you can where you can't.",
  'footer.issn': 'ISSN pending<br>№1 · Summer 2026',
  'footer.signoff': at('p44.content.sig'),
  'footer.colophon': 'Printed on unceded syilx Okanagan territory in a run of 500. Set in IBM Plex Mono and UnifrakturMaguntia. Errors are ours; corrections are yours; the leftover ink went into the stickers. · Parry. Riposte.',
  'footer.verify': 'Verified publishing ✓ confirm this edition has not been altered',
  /* live self-verification badge (full rendering only; falls back to footer.verify) */
  'verify.checking': 'Checking this edition…',
  'verify.ok': 'Verified — signed & publicly logged',
  'verify.unanchored': 'Signed & logged; not yet anchored',
  'verify.uncheckable': 'Signed & anchored; live copy uncheckable',
  'verify.bad': 'This edition could not be verified',
  'verify.details': 'how ▸',

  /* ---- i18n chrome ---- */
  'chrome.language': 'Language',
  'chrome.mtnote': 'This is a machine translation of an English original. Read the <a href="/">English edition</a>.',

  'chrome.sections': 'Sections',

  /* ---- rendering switch (Full / Lite / E-ink) ---- */
  'chrome.rendering': 'Rendering',
  'chrome.verFull': 'Full',
  'chrome.verLite': 'Lite',
  'chrome.verEink': 'E-ink',
  'chrome.altVersions': 'Lightweight versions',

  /* ---- Sec.01 data · table of contents (18 rows) ---- */
  'toc.0.t': "Our Daily Dread — editor's letter",   'toc.0.k': 'House',
  'toc.1.t': at('p02.content.rows[1]|1'),   'toc.1.k': 'History',
  'toc.2.t': at('p02.content.rows[2]|1'),   'toc.2.k': 'Photo',
  'toc.3.t': at('p02.content.rows[3]|1'),   'toc.3.k': 'Opinion',
  'toc.4.t': at('p02.content.rows[4]|1'), 'toc.4.k': 'Comic',
  'toc.5.t': at('p02.content.rows[5]|1'), 'toc.5.k': 'Interview',
  'toc.6.t': at('p02.content.rows[6]|1'),        'toc.6.k': 'Lit',
  'toc.7.t': 'The Wall — rip-out centrefold',        'toc.7.k': 'Art',
  'toc.8.t': at('p02.content.rows[8]|1'),             'toc.8.k': 'Satire',
  'toc.9.t': at('p02.content.rows[7]|1'),              'toc.9.k': 'Stickers',
  'toc.10.t': at('p02.content.rows[10]|1'),   'toc.10.k': 'Issues',
  'toc.11.t': at('p02.content.rows[11]|1'),       'toc.11.k': 'Lit',
  'toc.12.t': at('p02.content.rows[12]|1'),    'toc.12.k': 'Riposte',
  'toc.13.t': 'Ask a Local Gay / Reviews / Calendar', 'toc.13.k': 'Service',
  'toc.14.t': 'The Bite Back — restaurant critique', 'toc.14.k': 'Food',
  'toc.15.t': "Rotation — what we're listening to",  'toc.15.k': 'Music',
  'toc.16.t': at('p02.content.rows[15]|1'),     'toc.16.k': 'Film',
  'toc.17.t': 'Directory + Crumbs Mail',             'toc.17.k': 'Aid',
  'toc.18.t': at('p02.content.rows[18]|1'),    'toc.18.k': 'Colophon',

  /* ---- Sec.02 data · ledger (10 rows) ---- */
  'ledger.0.e': at('p05.content.table[0]|1'),    'ledger.0.s': 'Bust',
  'ledger.1.e': at('p05.content.table[1]|1'),            'ledger.1.s': 'Bust',
  'ledger.2.e': at('p05.content.table[2]|1'), 'ledger.2.s': 'Pivot',
  'ledger.3.e': at('p05.content.table[3]|1'),    'ledger.3.s': 'Parry',
  'ledger.4.e': at('p05.content.table[4]|1'),            'ledger.4.s': 'Pivot',
  'ledger.5.e': at('p05.content.table[5]|1'),          'ledger.5.s': 'Burn',
  'ledger.6.e': 'flood year; the lake takes the boardwalk',     'ledger.6.s': 'Flood',
  'ledger.7.e': at('p05.content.table[7]|1'),    'ledger.7.s': 'Burn',
  'ledger.8.e': at('p05.content.table[8]|1'),            'ledger.8.s': 'Bust',
  'ledger.9.e': at('p05.content.table[9]|1'),              'ledger.9.s': 'Riposte',

  /* ---- Sec.14 data · events (9 rows) ---- */
  'events.0.t': at('p38.content.rows[0]|1'),                'events.0.w': at('p38.content.rows[0]|2'),
  'events.1.t': at('p38.content.rows[1]|1'),                  'events.1.w': at('p38.content.rows[1]|2'),
  'events.2.t': at('p38.content.rows[2]|1'),                   'events.2.w': at('p38.content.rows[2]|2'),
  'events.3.t': at('p38.content.rows[3]|1'),                  'events.3.w': at('p38.content.rows[3]|2'),
  'events.4.t': at('p38.content.rows[4]|1'),        'events.4.w': at('p38.content.rows[4]|2'),
  'events.5.t': '№2 submission deadline',                   'events.5.w': 'art, opinion, poems',
  'events.6.t': at('p38.content.rows[6]|1'),             'events.6.w': at('p38.content.rows[6]|2'),
  'events.7.t': at('p38.content.rows[7]|1'),        'events.7.w': at('p38.content.rows[7]|2'),
  'events.8.t': at('p38.content.rows[8]|1'),      'events.8.w': at('p38.content.rows[8]|2'),

  /* ---- Sec.14 data · screenings (3 rows) ---- */
  'screenings.0.f': at('p36.content.notes[0]|0'),        'screenings.0.p': at('p37.content.rows[0]|2'),
  'screenings.1.f': at('p36.content.notes[1]|0'),     'screenings.1.p': at('p37.content.rows[1]|2'),
  'screenings.2.f': at('p36.content.notes[2]|0'),     'screenings.2.p': at('p37.content.rows[2]|2'),

  /* ---- Sec.18 data · directory (7 rows) ---- */
  'dir.0.t': at('p39.content.rows[0]|0'),   'dir.0.w': at('p39.content.rows[0]|1'),
  'dir.1.t': at('p39.content.rows[1]|0'),          'dir.1.w': at('p39.content.rows[1]|1'),
  'dir.2.t': at('p39.content.rows[2]|0'),               'dir.2.w': at('p39.content.rows[2]|1'),
  'dir.3.t': at('p39.content.rows[3]|0'),                      'dir.3.w': at('p39.content.rows[3]|1'),
  'dir.4.t': at('p39.content.rows[4]|0'),            'dir.4.w': at('p39.content.rows[4]|1'),
  'dir.5.t': at('p39.content.rows[5]|0'),            'dir.5.w': at('p39.content.rows[5]|1'),
  'dir.6.t': at('p39.content.rows[6]|0'),                          'dir.6.w': at('p39.content.rows[6]|1'),

  /* ---- Sec.16 data · lab status board (5 rows) ---- */
  'lab.0.t': at('p30.content.status[0]|0'), 'lab.0.s': 'Live',
  'lab.1.t': at('p30.content.status[1]|0'),            'lab.1.s': at('p30.content.status[1]|1'),
  'lab.2.t': at('p30.content.status[2]|0'),        'lab.2.s': 'Drawing',
  'lab.3.t': 'Daily Bread №2 — theme vote',                         'lab.3.s': 'Open',
  'lab.4.t': at('p30.content.status[4]|0'),      'lab.4.s': 'Recurring',

  /* ---- Sec.08 · comic · "Crumbs" ---- */
  'comic.tag': '// crumbs · ep.1 · a golem seeks housing',
  'comic.h': at('p14.content.title'),
  'comic.dek': "Our guest strip. Six panels, one loaf, zero vacancies. The slot is open, it pays, and the only brief is: make us laugh about the thing that isn't funny.",
  'comic.credit': 'Ep.1 · pencils, ink & crumbs by open call',
  'comic.p1c': 'On the third day, the sourdough woke up.',
  'comic.p2c': '$2,100 a month. “Cozy.” Shared with four yeasts.',
  'comic.p3c': 'The viewing was forty deep. One other applicant was also bread.',
  'comic.p4c': '“No pets, no plants, no leavening,” said the landlord.',
  'comic.p5c': "The orchard doesn't run a credit check.",
  'comic.p6c': 'Found a home in a magazine. Rent: get crumbs on it.',
  'comic.bubble1': 'oh no. i can feel the rent.',
  'comic.bubble4': 'but rising is all i do',
  'comic.foot': 'To be continued in №2 — “The Thaw.” Want the guest slot? Six panels to <a href="mailto:hello@dailybread.example?subject=CRUMBS">hello@dailybread.example</a>.',

  /* ---- Sec.11 · art · "The Wall" (rip-out centrefold) ---- */
  'art.tag': '// the wall · rip-out centrefold · pull gently',
  'art.h': 'The Wall',
  'art.dek': "The centrefold is a poster. Tear it out along the gutter and put it where a landlord can see it. This issue's wall belongs to the scene that refuses to be an address.",
  'art.posterKicker': 'Centrefold №1 · rip-out poster',
  'art.posterA': "A Scene Isn't",
  'art.posterB': 'an Address',
  'art.posterFoot': 'Daily Bread №1 · pull along the gutter · syilx Okanagan',
  'art.tear': 'tear here',
  'art.annot': 'yes — actually rip it',
  'art.plateKicker': 'Also on the walls / plate room',
  'art.plate1t': at('p08.content.title'),
  'art.plate1by': 'photo essay · Bernard Ave',
  'art.plate2t': at('p28.content.title'),
  'art.plate2by': 'ink on found paper',
  'art.plate3t': 'Orchard, After',
  'art.plate3by': 'riso · two colours',
  'art.colourHd': at('p02.content.rows[8]|1'),
  'art.colourBody': 'The line-art page is yours. Crayon the orchard, redline the rent, sign the bottom. Photograph it and send it back; the best one runs the wall in №2.',
  'art.colourStamp': 'Colouring page · pull out',

  /* ---- Sec.24 · stickers · "Peel Me" (printable sheet) ---- */
  'stickers.tag': '// peel me · sticker sheet · the leftover ink went here',
  'stickers.h': at('p20.content.brand'),
  'stickers.dek': 'The leftover ink went here. Print the page, cut along the dashes, and put the valley on your water bottle. Twelve stickers; no two collapses alike.',
  'stickers.print': 'Print this sheet',
  'stickers.printFull': 'Print the whole issue',
  'stickers.printHint': 'sheet → cut along the dashes · whole issue prints to A4 (Ctrl / ⌘ + P)',
  'stickers.sheetHd': 'Sticker sheet №1 · riso on offcuts',
  'stickers.sheetMeta': 'Cut along dashes',
  'stickers.s1': at('p14.content.title'),
  'stickers.s2': 'Get Crumbs On It',
  'stickers.s3': 'Free / PWYC',
  'stickers.s4': 'Kelowna',
  'stickers.s5': "A Scene Isn't an Address",
  'stickers.s6': at('ic.content.wordmark'),
  'stickers.s7': 'Parry · Riposte · Recycle',
  'stickers.s8': at('p28.content.title'),
  'stickers.s9': 'I Am the Precedent',
  'stickers.s10': 'Quiet No More',
  'stickers.s11': 'Baked in Kelowna',
  'stickers.s12': 'syilx okanagan · with respect',
  'stickers.foot': "Riso-printed on the offcuts. If a colour's off, that's the point.",
};
