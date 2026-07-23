/* ============================================================================
   Daily Bread · English strings (source of truth for the multilingual build)
   ----------------------------------------------------------------------------
   One key = one translatable unit. tools/build.js renders the page from these;
   tools/strings/<lang>.json supplies translations (same keys; missing -> English).
   Inline HTML (<br>, <b>, <span ...>) and glyphs (№ · ◦ ▸ ✕ ↓ ☐) are part of
   the string and MUST be preserved verbatim by translators.
   ============================================================================ */
module.exports = {
  /* ---- <head> / social ---- */
  'meta.title': "Daily Bread №1 · Kelowna's Collapse · A Queer Magazine for the Okanagan",
  'meta.desc': "Daily Bread is a queer magazine for the Okanagan, baked quarterly in Kelowna, BC. Issue №1: Kelowna's Collapse. Free where you found it; pay what you can where you can't. Funded by Riposte Laboratories.",
  'meta.ogTitle': "Daily Bread №1 — Kelowna's Collapse",
  'meta.ogDesc': "A queer magazine for the Okanagan. Free / PWYC. Issue №1, Summer 2026.",

  /* ---- top-bar navigation ---- */
  'nav.letter': 'Letter',
  'nav.contents': 'Contents',
  'nav.history': 'History',
  'nav.voices': 'Voices',
  'nav.calendar': 'Calendar',
  'nav.directory': 'Directory',
  'nav.submit': 'Submit',
  'nav.lab': 'The Lab',

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
  'letter.p3': 'Rip out the poster. Colour the cartoon. Mail us your fury and your recipes. This thing only works if you get crumbs on it.',
  'letter.signoff': '— the editors ✕',
  'letter.mastHd': 'Masthead / №1 · Summer 2026',
  'letter.mh1L': 'Editor',
  'letter.mh1V': 'your name here',
  'letter.mh2L': 'Art + comics',
  'letter.mh2V': 'open call',
  'letter.mh3L': 'Young voices desk',
  'letter.mh3V': 'three writers, 17–24',
  'letter.mh4L': 'Printed on',
  'letter.mh4V': 'unceded syilx territory',
  'letter.landback': 'Daily Bread is published on the unceded, ancestral territory of the syilx Okanagan people. We pay rent to a landlord and respect to a Nation, and we know only one of those is owed.',
  'letter.funded': 'Funded by Riposte<br>Laboratories Inc.',

  /* ---- Sec.01 · contents ---- */
  'contents.tag': '// contents · manifest / 48 pp',
  'contents.h': 'Contents',
  'contents.dek': 'Twelve contributors made №1: writers aged 17–74, two photographers, one cartoonist, one very patient proofreader. Every byline is local. Every fee got paid before the printer did.',
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
  'voices.r1h': 'Nobody My Age Can Afford to Stay',
  'voices.r1p': "I work two jobs and split a two-bedroom with three people, and I'm the success story. My group chat is a slow-motion goodbye party: Vernon, Calgary, mom's basement in Surrey.",
  'voices.r1pull': '"Every viewing is forty people deep and one of them is always crying."',
  'voices.r2tag': 'Report 02',
  'voices.r2meta': 'Age 22 · Coming out',
  'voices.r2h': 'Out at the Packinghouse',
  'voices.r2p': 'I came out at a bush party in Glenmore and the worst thing that happened was a guy named Tyler said "cool" and asked if I could drive him home. Not paradise, not hell, just a small city learning faster than its city council.',
  'voices.r2pull': 'geography is the last closet',
  'voices.r3tag': 'Report 03',
  'voices.r3meta': 'Age 17 · Fire season',
  'voices.r3h': "I've Evacuated Twice and I Can't Vote Yet",
  'voices.r3p': 'My childhood photos are sorted by smoke year. We packed the car in 2021 and again in 2023, and both times the adults on the radio called it unprecedented. It has precedent.',
  'voices.r3pull': '"I am the precedent."',

  /* ---- waitlist stats ---- */
  'waitlist.kicker': '10 · Current issues',
  'waitlist.h': 'The Waitlist',
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
  'calendar.h': 'The Calendar',
  'calendar.dek': 'Listings are free; email by the 15th. Sober and all-ages options marked ◦.',
  'calendar.evHd': 'Aug — Oct 2026',
  'calendar.evHd2': 'Clip + fridge',
  'calendar.moviesKicker': 'Movies in the park / hosted by Daily Bread',
  'calendar.scHd': 'Summer slate / at dusk',
  'calendar.scHd2': 'Rain moves us to the Lab',
  'calendar.scFine': 'Free / PWYC · captions on · projector + power: reclaimed cells, Project HEX',
  'calendar.voteHd': 'Vote — October screening',
  'calendar.vote1': 'Portrait of a Lady on Fire (2019)',
  'calendar.vote2': 'Hedwig and the Angry Inch (2001)',
  'calendar.vote3': 'Bound (1996)',
  'calendar.voteFine': 'Mark one · photograph · send. Film democracy.',

  /* ---- Sec.18 · directory ---- */
  'directory.tag': '// mutual aid · keep this page · verified quarterly',
  'directory.kicker': 'Keep this page / directory',
  'directory.hd': 'Verified quarterly · tear out ok',
  'directory.note': 'A resource missing? Wrong number? Tell us — this page is the whole point.',
  'directory.helpsKicker': 'What actually helps / checklist',
  'directory.helpsHd': 'Field-tested',
  'directory.help1': 'The informed-consent clinic list — updated quarterly',
  'directory.help2': 'Pharmacists can renew more than you think — ask directly',
  'directory.help3': 'Telehealth counts. Bad wifi is still shorter than 400 km',
  'directory.help4': 'Bring a friend to appointments. Bureaucracy respects witnesses',
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
  'lab.h': 'From the Lab',
  'lab.p1': "Full disclosure, printed large: this magazine is funded by Riposte Laboratories, a Kelowna outfit that counter-attacks waste with recycled-plastic injection molding and reclaimed-cell modular power. We share what we're building here, in the same pages, at the same volume as everyone else.",
  'lab.p2': 'The deal, in writing: the Lab pays the printer and gets two pages. The editors answer to readers, not the funder. If that ever changes, the colouring page will let you know.',
  'lab.stamp': 'Funder disclosure · signed',
  'lab.signoff': 'parry. riposte. recycle.',
  'lab.kicker': 'This quarter / status board',
  'lab.whyHd': 'Why fund a magazine?',
  'lab.whyBody': 'Because a lab that fixes material waste in a town losing its cultural material would be doing half a job. Paper is infrastructure. So are drag nights. Line item approved.',
  'lab.tour': 'Tour the shop: open doors first Fridays · bring clean #2 + #5 plastics.',

  /* ---- footer / back cover ---- */
  'footer.blurb': "Daily Bread is baked quarterly in Kelowna, BC. Free where you found it. Pay what you can where you can't.",
  'footer.issn': 'ISSN pending<br>№1 · Summer 2026',
  'footer.signoff': 'see you at the thaw ✕',
  'footer.colophon': 'Printed on unceded syilx Okanagan territory in a run of 500. Set in IBM Plex Mono and UnifrakturMaguntia. Errors are ours; corrections are yours; the leftover ink went into the stickers. · Parry. Riposte.',

  /* ---- i18n chrome ---- */
  'chrome.language': 'Language',
  'chrome.mtnote': 'This is a machine translation of an English original. Read the <a href="/">English edition</a>.',

  /* ---- Sec.01 data · table of contents (18 rows) ---- */
  'toc.0.t': "Our Daily Dread — editor's letter",   'toc.0.k': 'House',
  'toc.1.t': 'Before the Bridge — a rude history',   'toc.1.k': 'History',
  'toc.2.t': 'Vacancy — photo essay, Bernard Ave',   'toc.2.k': 'Photo',
  'toc.3.t': 'Young Voices — three field reports',   'toc.3.k': 'Opinion',
  'toc.4.t': 'Crumbs — ep.1, a golem seeks housing', 'toc.4.k': 'Comic',
  'toc.5.t': 'Forty Years of Nerve — Miss Demeanour', 'toc.5.k': 'Interview',
  'toc.6.t': 'Lake Effect / Harvest — poems',        'toc.6.k': 'Lit',
  'toc.7.t': 'The Wall — rip-out centrefold',        'toc.7.k': 'Art',
  'toc.8.t': 'Colour Your Own Collapse',             'toc.8.k': 'Satire',
  'toc.9.t': 'Peel Me — sticker sheet',              'toc.9.k': 'Stickers',
  'toc.10.t': 'The Waitlist — healthcare feature',   'toc.10.k': 'Issues',
  'toc.11.t': 'The Lake Takes — fiction pt.1',       'toc.11.k': 'Lit',
  'toc.12.t': 'From the Lab — funder disclosure',    'toc.12.k': 'Riposte',
  'toc.13.t': 'Ask a Local Gay / Reviews / Calendar', 'toc.13.k': 'Service',
  'toc.14.t': 'The Bite Back — restaurant critique', 'toc.14.k': 'Food',
  'toc.15.t': "Rotation — what we're listening to",  'toc.15.k': 'Music',
  'toc.16.t': 'The Rewind + Movies in the Park',     'toc.16.k': 'Film',
  'toc.17.t': 'Directory + Crumbs Mail',             'toc.17.k': 'Aid',
  'toc.18.t': 'Who Made This — staff, assembled',    'toc.18.k': 'Colophon',

  /* ---- Sec.02 data · ledger (10 rows) ---- */
  'ledger.0.e': 'fruit prices crater; scrip economy begins',    'ledger.0.s': 'Bust',
  'ledger.1.e': 'packinghouse layoffs, valley-wide',            'ledger.1.s': 'Bust',
  'ledger.2.e': 'bridge opens; ferry workers obsolete overnight', 'ledger.2.s': 'Pivot',
  'ledger.3.e': 'ALR freezes orchard speculation (briefly)',    'ledger.3.s': 'Parry',
  'ledger.4.e': 'sawmill era ends; wine era begins',            'ledger.4.s': 'Pivot',
  'ledger.5.e': 'firestorm; 239 homes, 30k evacuated',          'ledger.5.s': 'Burn',
  'ledger.6.e': 'flood year; the lake takes the boardwalk',     'ledger.6.s': 'Flood',
  'ledger.7.e': 'heat dome; hottest place in Canada, again',    'ledger.7.s': 'Burn',
  'ledger.8.e': 'last dedicated queer venue closes',            'ledger.8.s': 'Bust',
  'ledger.9.e': 'this magazine. your move, city.',              'ledger.9.s': 'Riposte',

  /* ---- Sec.14 data · events (9 rows) ---- */
  'events.0.t': 'First Friday at the Lab ◦',                'events.0.w': 'Riposte shop floor — tours, benches, zines',
  'events.1.t': 'Movies in the Park №1 ◦',                  'events.1.w': 'City Park — Paris Is Burning',
  'events.2.t': 'Queer Beach Assembly ◦',                   'events.2.w': 'Gyro Beach, north end — bring shade to share',
  'events.3.t': 'Harvest Moon drag night',                  'events.3.w': 'community hall — PWYC at the door',
  'events.4.t': 'Zine-making + submission clinic ◦',        'events.4.w': 'library makerspace — bring your fury',
  'events.5.t': '№2 submission deadline',                   'events.5.w': 'art, opinion, poems',
  'events.6.t': 'Orchard walk with an elder ◦',             'events.6.w': 'East Kelowna benches — history underfoot',
  'events.7.t': 'Cassette night: the Shoebox Fonds',        'events.7.w': 'venue TBA — Miss Demeanour presiding',
  'events.8.t': 'Issue №2 launch + colouring contest',      'events.8.w': 'location in №2. obviously',

  /* ---- Sec.14 data · screenings (3 rows) ---- */
  'screenings.0.f': 'Paris Is Burning (1990)',        'screenings.0.p': 'City Park, at dusk',
  'screenings.1.f': 'My Own Private Idaho (1991)',     'screenings.1.p': 'Ben Lee Park, at dusk',
  'screenings.2.f': 'The Watermelon Woman (1996)',     'screenings.2.p': 'Rutland Centennial Park, at dusk',

  /* ---- Sec.18 data · directory (7 rows) ---- */
  'dir.0.t': 'Crisis line (24/7, trans-competent)',   'dir.0.w': 'placeholder — verify before print',
  'dir.1.t': 'Informed-consent clinic list',          'dir.1.w': 'updated quarterly · this page',
  'dir.2.t': 'Youth drop-in (14–24) ◦',               'dir.2.w': 'wed + sat · downtown',
  'dir.3.t': 'Mutual aid pantry',                      'dir.3.w': 'rutland · no questions',
  'dir.4.t': 'Legal aid — tenant defence',            'dir.4.w': 'first mondays · library',
  'dir.5.t': 'Elder queer social (55+) ◦',            'dir.5.w': 'thursdays · lakeshore',
  'dir.6.t': 'Sober hangs ◦',                          'dir.6.w': 'see calendar, marked ◦',

  /* ---- Sec.16 data · lab status board (5 rows) ---- */
  'lab.0.t': 'Plastic Works — molds v2, park benches from #5 tubs', 'lab.0.s': 'Live',
  'lab.1.t': 'Project HEX — reclaimed-cell grading rig',            'lab.1.s': 'WIP',
  'lab.2.t': 'Esh — shop assistant, currently a whiteboard',        'lab.2.s': 'Drawing',
  'lab.3.t': 'Daily Bread №2 — theme vote',                         'lab.3.s': 'Open',
  'lab.4.t': 'First Friday open doors — bring clean plastics',      'lab.4.s': 'Recurring',
};
