/* ============================================================================
   Daily Bread · Issue №1 — the issue itself
   ----------------------------------------------------------------------------
   ONE ISSUE, ONE FILE. This is the content, and the only place it lives. The
   print build (tools/print/build-print.js) compiles it into the A5 page
   templates in db-render/ and imposes it two-up for saddle-stitch; the site
   build renders the same pages for the web. Layout is not described here and
   must not be — "write content, layout is handled" is the whole contract.

   A page is one template plus its content, the way a LaTeX macro takes
   arguments. Reordering the magazine is reordering this list.

   NOTATION
     an array           a block sequence — paragraphs, rows, panels, poems.
                        The build joins it with "||", which is what the
                        templates split on. Write the array; never the "||".
     "a | b | c"        fields within one row (don't use "|" in prose).
     "line one / line two"   line breaks inside a poem.
     "Q: …" / "A: …"    speaker prefixes in interviews.
     "#f0477d" as a row's last field pins that row's accent.
     "none"             hides an optional element entirely.

   chrome  = the running heads, doc number, folio, accent and footer strip.
             Folios are page numbers as PRINTED; the physical order is this
             list's order, and the imposition derives from that.
   ============================================================================ */

module.exports = {
  meta: {
    issue:   '№1',
    theme:   "Kelowna's Collapse",
    edition: '№1 · SUMMER 2026',
    trim:    'A5',            // 148×210mm — the page every template is drawn at
  },

  /* -- the issue, in physical page order (page 1 = front cover) -------------- */
  pages: [
    /* 01 · P01 · FC */
    {
      template: 'Cover',
      variant: 'front',
      slug: 'v2-fc',
      content: {
        art: `uploads/lalalalala.png`,
        issueTag: `№1 — KELOWNA’S COLLAPSE`,
        price: `PAY WHAT YOU CAN`,
        publisher: `RIPOSTE LABORATORIES`,
        publisherLong: `RIPOSTE LABORATORIES INC.`,
        tagline: `Daily Bread is baked quarterly in Kelowna, BC. Free where you found it. Pay what you can where you can’t.`,
        issn: `ISSN PENDING`,
        edition: `№1 · SUMMER 2026`,
      },
    },
    /* 02 · P02 · IC */
    {
      template: 'Letter',
      variant: 'masthead',
      chrome: { footer: `mono`, accent: `#f0477d`, headLeft: `DAILY BREAD №1 · KELOWNA BC`, headRight: `THEME: KELOWNA’S COLLAPSE`, docNo: `DB-000-A`, folio: `IC` },
      content: {
        body: [
          `You found the first issue of a queer magazine in a city that keeps telling us it doesn’t have one. Kelowna has queer history, queer kids, queer elders, queer bakers and bureaucrats — what it hasn’t had is paper that says so out loud.`,
          `This issue is about collapse: the orchards, the venues, the rent math, the bridge traffic. Not because we’re doomers, but because things fall apart here on schedule, and naming the schedule is the first act of repair.`,
          `Rip out the poster. Colour the cartoon. Mail us your fury and your recipes. This thing only works if you get crumbs on it.`
        ],
        lead: `HI.`,
        stamp: `BATCH №1 · FRESH`,
        wordmark: `Daily Bread`,
        subtitle: `A QUEER MAGAZINE FOR THE OKANAGAN`,
        mastheadLabel: `MASTHEAD / №1 · SUMMER 2026`,
        masthead: [
          `EDITOR | your name here`,
          `ART + COMICS | open call — pg 24`,
          `YOUNG VOICES DESK | pg 11`,
          `PRINTED | on unceded syilx territory`
        ],
        ack: `Daily Bread is published on the unceded, ancestral territory of the syilx Okanagan people. We pay rent to a landlord and respect to a Nation, and we know only one of those is owed.`,
        funderLine: `FUNDED BY RIPOSTE LABORATORIES INC.`,
        funderNote: `EDITORIAL INDEPENDENCE CLAUSE: SEE FROM THE LAB`,
        kicker: `00 · EDITOR’S LETTER`,
        title: `Our Daily Dread`,
        signoff: `— the editors ✕`,
      },
    },
    /* 03 · P03 · 01 */
    {
      template: 'Letter',
      variant: 'letter',
      chrome: { footer: `mono`, accent: `#f0477d`, headLeft: `DAILY BREAD №1 · KELOWNA BC`, headRight: `THEME: KELOWNA’S COLLAPSE`, docNo: `DB-000-A`, folio: `01` },
      content: {
        body: [
          `You found the first issue of a queer magazine in a city that keeps telling us it doesn’t have one. Kelowna has queer history, queer kids, queer elders, queer bakers and bureaucrats — what it hasn’t had is paper that says so out loud.`,
          `This issue is about collapse: the orchards, the venues, the rent math, the bridge traffic. Not because we’re doomers, but because things fall apart here on schedule, and naming the schedule is the first act of repair.`,
          `Rip out the poster. Colour the cartoon. Mail us your fury and your recipes. This thing only works if you get crumbs on it.`
        ],
        lead: `HI.`,
        stamp: `BATCH №1 · FRESH`,
        wordmark: `Daily Bread`,
        subtitle: `A QUEER MAGAZINE FOR THE OKANAGAN`,
        mastheadLabel: `MASTHEAD / №1 · SUMMER 2026`,
        masthead: [
          `EDITOR | your name here`,
          `ART + COMICS | open call — pg 24`,
          `YOUNG VOICES DESK | pg 11`,
          `PRINTED | on unceded syilx territory`
        ],
        ack: `Daily Bread is published on the unceded, ancestral territory of the syilx Okanagan people. We pay rent to a landlord and respect to a Nation, and we know only one of those is owed.`,
        funderLine: `FUNDED BY RIPOSTE LABORATORIES INC.`,
        funderNote: `EDITORIAL INDEPENDENCE CLAUSE: SEE FROM THE LAB`,
        kicker: `00 · EDITOR’S LETTER`,
        title: `Our Daily Dread`,
        signoff: `— the editors ✕`,
      },
    },
    /* 04 · P04 · 02 */
    {
      template: 'Contents',
      variant: 'manifest',
      chrome: { footer: `duo`, accent: `#f0477d`, headLeft: `DAILY BREAD №1 · KELOWNA BC`, headRight: `THEME: KELOWNA’S COLLAPSE`, docNo: `DB-002-A`, folio: `02` },
      content: {
        scribble: `none`,
        rows: [
          `01 | Our Daily Dread — editor’s letter | HOUSE`,
          `04 | Before the Bridge — a rude history | HISTORY`,
          `08 | Vacancy — photo essay, Bernard Ave | PHOTO`,
          `11 | Young Voices — three field reports | OPINION`,
          `14 | Crumbs — ep.1, a golem seeks housing | COMIC`,
          `16 | Forty Years of Nerve — Miss Demeanour | INTERVIEW`,
          `19 | Lake Effect / Harvest — poems | LIT`,
          `20 | Peel Me — sticker sheet | STICKERS`,
          `21 | Colour Your Own Collapse | SATIRE`,
          `22 | The Wall — two pieces, centre rip-out | ART`,
          `25 | The Waitlist — healthcare feature | ISSUES`,
          `28 | The Lake Takes — fiction pt.1 | LIT`,
          `30 | From the Lab — funder disclosure | RIPOSTE`,
          `32 | Ask a Local Gay / Reviews | SERVICE`,
          `34 | The Bite Back / Rotation | FOOD+MUSIC`,
          `36 | The Rewind + Movies in the Park | FILM`,
          `38 | Calendar / Directory / Go-Bag | AID`,
          `41 | Crumbs Mail · finale · guest strip | COMIC`,
          `44 | Who Made This — staff, assembled | COLOPHON`
        ],
        title: `Contents`,
        manifestLabel: `MANIFEST / №1`,
        manifestTag: `DB-TOC`,
        whoTag: `WHO’S IN HERE`,
        whoBlurb: `Twelve contributors made №1: writers aged 17–74, two photographers, one cartoonist, one very patient proofreader. Every byline is local. Every fee got paid before the printer did.`,
        subTitle: `SUBMIT TO №2 — “THE THAW”`,
        subRows: [
          `Art for The Wall | one page, yours, 300dpi. We pay.`,
          `Opinion (under 25) | 500 words of correct anger.`,
          `Poems, fiction, comics | weird welcome.`,
          `Deadline | Sept 15 · hello@dailybread.example`
        ],
        footNote: `DAILY BREAD IS FREE / PWYC · PRINT RUN 500 · FONTS: IBM PLEX MONO, UNIFRAKTUR`,
      },
    },
    /* 05 · P05 · 03 */
    {
      template: 'Contents',
      variant: 'contributors',
      chrome: { footer: `duo`, accent: `#f0477d`, headLeft: `DAILY BREAD №1 · KELOWNA BC`, headRight: `THEME: KELOWNA’S COLLAPSE`, docNo: `DB-002-A`, folio: `03` },
      content: {
        scribble: `none`,
        rows: [
          `01 | Our Daily Dread — editor’s letter | HOUSE`,
          `04 | Before the Bridge — a rude history | HISTORY`,
          `08 | Vacancy — photo essay, Bernard Ave | PHOTO`,
          `11 | Young Voices — three field reports | OPINION`,
          `14 | Crumbs — ep.1, a golem seeks housing | COMIC`,
          `16 | Forty Years of Nerve — Miss Demeanour | INTERVIEW`,
          `19 | Lake Effect / Harvest — poems | LIT`,
          `20 | Peel Me — sticker sheet | STICKERS`,
          `21 | Colour Your Own Collapse | SATIRE`,
          `22 | The Wall — two pieces, centre rip-out | ART`,
          `25 | The Waitlist — healthcare feature | ISSUES`,
          `28 | The Lake Takes — fiction pt.1 | LIT`,
          `30 | From the Lab — funder disclosure | RIPOSTE`,
          `32 | Ask a Local Gay / Reviews | SERVICE`,
          `34 | The Bite Back / Rotation | FOOD+MUSIC`,
          `36 | The Rewind + Movies in the Park | FILM`,
          `38 | Calendar / Directory / Go-Bag | AID`,
          `41 | Crumbs Mail · finale · guest strip | COMIC`,
          `44 | Who Made This — staff, assembled | COLOPHON`
        ],
        title: `Contents`,
        manifestLabel: `MANIFEST / №1`,
        manifestTag: `DB-TOC`,
        whoTag: `WHO’S IN HERE`,
        whoBlurb: `Twelve contributors made №1: writers aged 17–74, two photographers, one cartoonist, one very patient proofreader. Every byline is local. Every fee got paid before the printer did.`,
        subTitle: `SUBMIT TO №2 — “THE THAW”`,
        subRows: [
          `Art for The Wall | one page, yours, 300dpi. We pay.`,
          `Opinion (under 25) | 500 words of correct anger.`,
          `Poems, fiction, comics | weird welcome.`,
          `Deadline | Sept 15 · hello@dailybread.example`
        ],
        footNote: `DAILY BREAD IS FREE / PWYC · PRINT RUN 500 · FONTS: IBM PLEX MONO, UNIFRAKTUR`,
      },
    },
    /* 06 · P06 · 04 */
    {
      template: 'Feature',
      variant: 'opener',
      slug: 'v2-p04',
      chrome: { footer: `mono`, accent: `#f0477d`, headLeft: `01 · HISTORY`, headRight: `THEME: KELOWNA’S COLLAPSE`, docNo: `DB-004-A`, folio: `04` },
      content: {
        body: [
          `FOR thousands of years before a single orchard row was staked, this was — and remains — unceded syilx Okanagan territory. The lake fed people. The grasslands were managed with fire, on purpose, by people who understood the valley as a system rather than a view.`,
          `Then came the fur posts, the mission, and in 1892 a townsite plat with straight lines drawn over everything. The sales pitch was permanent abundance: apples forever, sun forever, growth forever.`
        ],
        scribble: `none`,
        stats: `none`,
        byline: `WORDS: STAFF · PHOTOS: CITY OF KELOWNA ARCHIVES`,
        kicker: `01 · HISTORY`,
        title: `Before the Bridge`,
        dek: `This valley did not begin in 1892, and it will not end with the condo towers. A short, rude history of what was here, what got built on top of it, and what collapsed first.`,
        caption: `FIG. 1 — CAPTION SETS THE JOKE, THE IMAGE SETS THE SCENE.`,
        placeholder: `feature photo — drag and drop, 300dpi`,
        contNote: `CONTINUED NEXT PAGE → EVERY BOOM MADE THE SAME PROMISE`,
        boxTitle: `CONTINUED IN №2 — “THE THAW”`,
        boxBody: `Serialized fiction runs across issues. Miss one and the lake keeps your bookmark.`,
      },
    },
    /* 07 · P07 · 05 */
    {
      template: 'Body',
      variant: 'image-text',
      slug: 'v2-p05',
      chrome: { footer: `mono`, accent: `#f0477d`, headLeft: `01 · HISTORY`, headRight: `THEME: KELOWNA’S COLLAPSE`, docNo: `DB-005-A`, folio: `05` },
      content: {
        scribble: `none`,
        scribble2: `none`,
        stamp: `none`,
        placeholder: `archival photo — 1958 floating bridge opening day`,
        imgH: `250px`,
        kicker: `01 · HISTORY`,
        caption: `FIG. 1 — THE FLOATING BRIDGE, 1958. TRAFFIC ARRIVED; THE FERRY DIED THE SAME DAY.`,
        body: [
          `Every boom since has made the same promise, and every bust has been treated as a surprise. Fruit prices collapsed. Sawmills closed. The 2003 firestorm ate 239 homes while the city watched from the beach.`,
          `This issue asks the impolite question: what if collapse isn’t the exception here — what if it’s the business model? The ledger two pages over has the receipts.`
        ],
        body2: `The fix isn’t mysterious: fund the clinic, train the staff, shorten the triangle. Cities that did it saw waits drop within two budget cycles. Ours pilots a task force instead. We’ll print the task force’s org chart when it produces one — the colouring page may get a sequel.`,
        proseLabel: ``,
        quotes: [
          `“My GP is great. My GP is also in Vancouver, where I don’t live.”`,
          `“The pharmacist figured it out before any doctor did. Shout out Deb.”`,
          `“I got my referral the same month my lease ended. Guess which one moved faster.”`,
          `“Honestly? The group chat is the healthcare system.”`
        ],
        note: `FOUR OF ELEVEN INTERVIEWS · ALL ANONYMIZED · METHODOLOGY: SEE DIRECTORY`,
        colA: `ENTRY`,
        colB: `STATUS`,
        table: [
          `1913 | fruit prices crater; scrip economy begins | BUST | #f0477d`,
          `1930s | packinghouse layoffs, valley-wide | BUST | #f0477d`,
          `1958 | bridge opens; ferry workers obsolete overnight | PIVOT | #fe9a0d`,
          `1973 | ALR freezes orchard speculation (briefly) | PARRY | #12b795`,
          `1980s | sawmill era ends; wine era begins | PIVOT | #fe9a0d`,
          `2003 | firestorm; 239 homes, 30k evacuated | BURN | #f0477d`,
          `2017 | flood year — the lake takes the boardwalk | FLOOD | #f0477d`,
          `2021 | heat dome; hottest place in Canada, again | BURN | #f0477d`,
          `2024 | last dedicated queer venue closes | BUST | #f0477d`,
          `2026 | this magazine. your move, city. | RIPOSTE | #12b795`
        ],
        noteTag: `METHOD`,
        note2: `compiled from city archives, newspaper morgues, and elders who were there. Corrections welcome and expected: see Crumbs Mail.`,
        checkTitle: `WHAT ACTUALLY HELPS / CHECKLIST`,
        checklist: [
          `The informed-consent clinic list — updated quarterly, see directory`,
          `Pharmacists can renew more than you think — ask directly`,
          `Telehealth counts. Bad wifi is still shorter than 400 km`,
          `Bring a friend to appointments. Bureaucracy respects witnesses`
        ],
      },
    },
    /* 08 · P08 · 06 */
    {
      template: 'Body',
      variant: 'image-text',
      slug: 'v2-p06',
      chrome: { footer: `mono`, accent: `#f0477d`, headLeft: `01 · HISTORY`, headRight: `THEME: KELOWNA’S COLLAPSE`, docNo: `DB-006-A`, folio: `06` },
      content: {
        scribble: `none`,
        scribble2: `none`,
        stamp: `none`,
        placeholder: `archival photo — orchard crews, 1910s`,
        imgH: `250px`,
        kicker: `01 · HISTORY`,
        caption: `FIG. 2 — PICKING CREWS, RUTLAND BENCHES. THE APPLES WERE A PYRAMID SCHEME WITH ROOTS.`,
        body: [
          `The valley sold itself twice: first as Eden, then as equity. Fruit ranchers went broke so often the packinghouses printed their own scrip; when fruit died, the pitch became retirement sun; when the retirees priced out the pickers, the pitch became lakeside lofts.`,
          `Each act ended the same way — with the people who did the work living further from the water. The queer history is braided through all of it: dance halls with unofficial nights, friendship networks that doubled as housing lists, a scene that survived by being useful and quiet until it didn’t have to be.`
        ],
        body2: `The fix isn’t mysterious: fund the clinic, train the staff, shorten the triangle. Cities that did it saw waits drop within two budget cycles. Ours pilots a task force instead. We’ll print the task force’s org chart when it produces one — the colouring page may get a sequel.`,
        proseLabel: ``,
        quotes: [
          `“My GP is great. My GP is also in Vancouver, where I don’t live.”`,
          `“The pharmacist figured it out before any doctor did. Shout out Deb.”`,
          `“I got my referral the same month my lease ended. Guess which one moved faster.”`,
          `“Honestly? The group chat is the healthcare system.”`
        ],
        note: `FOUR OF ELEVEN INTERVIEWS · ALL ANONYMIZED · METHODOLOGY: SEE DIRECTORY`,
        colA: `ENTRY`,
        colB: `STATUS`,
        table: [
          `1913 | fruit prices crater; scrip economy begins | BUST | #f0477d`,
          `1930s | packinghouse layoffs, valley-wide | BUST | #f0477d`,
          `1958 | bridge opens; ferry workers obsolete overnight | PIVOT | #fe9a0d`,
          `1973 | ALR freezes orchard speculation (briefly) | PARRY | #12b795`,
          `1980s | sawmill era ends; wine era begins | PIVOT | #fe9a0d`,
          `2003 | firestorm; 239 homes, 30k evacuated | BURN | #f0477d`,
          `2017 | flood year — the lake takes the boardwalk | FLOOD | #f0477d`,
          `2021 | heat dome; hottest place in Canada, again | BURN | #f0477d`,
          `2024 | last dedicated queer venue closes | BUST | #f0477d`,
          `2026 | this magazine. your move, city. | RIPOSTE | #12b795`
        ],
        noteTag: `METHOD`,
        note2: `compiled from city archives, newspaper morgues, and elders who were there. Corrections welcome and expected: see Crumbs Mail.`,
        checkTitle: `WHAT ACTUALLY HELPS / CHECKLIST`,
        checklist: [
          `The informed-consent clinic list — updated quarterly, see directory`,
          `Pharmacists can renew more than you think — ask directly`,
          `Telehealth counts. Bad wifi is still shorter than 400 km`,
          `Bring a friend to appointments. Bureaucracy respects witnesses`
        ],
      },
    },
    /* 09 · P09 · 07 */
    {
      template: 'Body',
      variant: 'ledger',
      slug: 'v2-p07',
      chrome: { footer: `mono`, accent: `#f0477d`, headLeft: `01 · HISTORY`, headRight: `THEME: KELOWNA’S COLLAPSE`, docNo: `DB-007-A`, folio: `07` },
      content: {
        scribble: `none`,
        scribble2: `none`,
        stamp: `none`,
        placeholder: `archival photo — orchard crews, 1910s`,
        imgH: `250px`,
        kicker: `LEDGER / WHAT COLLAPSED WHEN`,
        caption: `FIG. 2 — PICKING CREWS, RUTLAND BENCHES. THE APPLES WERE A PYRAMID SCHEME WITH ROOTS.`,
        body: [
          `The valley sold itself twice: first as Eden, then as equity. Fruit ranchers went broke so often the packinghouses printed their own scrip; when fruit died, the pitch became retirement sun; when the retirees priced out the pickers, the pitch became lakeside lofts.`,
          `Each act ended the same way — with the people who did the work living further from the water. The queer history is braided through all of it: dance halls with unofficial nights, friendship networks that doubled as housing lists, a scene that survived by being useful and quiet until it didn’t have to be.`
        ],
        body2: `The fix isn’t mysterious: fund the clinic, train the staff, shorten the triangle. Cities that did it saw waits drop within two budget cycles. Ours pilots a task force instead. We’ll print the task force’s org chart when it produces one — the colouring page may get a sequel.`,
        proseLabel: ``,
        quotes: [
          `“My GP is great. My GP is also in Vancouver, where I don’t live.”`,
          `“The pharmacist figured it out before any doctor did. Shout out Deb.”`,
          `“I got my referral the same month my lease ended. Guess which one moved faster.”`,
          `“Honestly? The group chat is the healthcare system.”`
        ],
        note: `FOUR OF ELEVEN INTERVIEWS · ALL ANONYMIZED · METHODOLOGY: SEE DIRECTORY`,
        colA: `ENTRY`,
        colB: `STATUS`,
        table: [
          `1913 | fruit prices crater; scrip economy begins | BUST | #f0477d`,
          `1930s | packinghouse layoffs, valley-wide | BUST | #f0477d`,
          `1958 | bridge opens; ferry workers obsolete overnight | PIVOT | #fe9a0d`,
          `1973 | ALR freezes orchard speculation (briefly) | PARRY | #12b795`,
          `1980s | sawmill era ends; wine era begins | PIVOT | #fe9a0d`,
          `2003 | firestorm; 239 homes, 30k evacuated | BURN | #f0477d`,
          `2017 | flood year — the lake takes the boardwalk | FLOOD | #f0477d`,
          `2021 | heat dome; hottest place in Canada, again | BURN | #f0477d`,
          `2024 | last dedicated queer venue closes | BUST | #f0477d`,
          `2026 | this magazine. your move, city. | RIPOSTE | #12b795`
        ],
        noteTag: `METHOD`,
        note2: `compiled from city archives, newspaper morgues, and elders who were there. Corrections welcome and expected: see Crumbs Mail.`,
        checkTitle: `WHAT ACTUALLY HELPS / CHECKLIST`,
        checklist: [
          `The informed-consent clinic list — updated quarterly, see directory`,
          `Pharmacists can renew more than you think — ask directly`,
          `Telehealth counts. Bad wifi is still shorter than 400 km`,
          `Bring a friend to appointments. Bureaucracy respects witnesses`
        ],
      },
    },
    /* 10 · P10 · 08 */
    {
      template: 'Photo Essay',
      variant: 'hero',
      slug: 'v2-p08',
      chrome: { headLeft: `02 · PHOTO ESSAY`, headRight: `BERNARD AVE, 6AM`, docNo: `DB-008-A`, folio: `08` },
      content: {
        title: `Vacancy`,
        dek: `Six storefronts, one morning, zero people. A walking tour of what the “best downtown in Canada” looks like before the patios open — and after the leases triple.`,
        capA: `FIG. 3 — “FOR LEASE / GREAT EXPOSURE.” THE EXPOSURE IS DOING A LOT OF WORK.`,
        ph1: `photo — papered-over storefront window`,
        ph2: `photo — empty interior, cords on floor`,
        ph3: `photo — sun-bleached mannequin`,
        ph4: `photo — fourth frame`,
      },
    },
    /* 11 · P11 · 09 */
    {
      template: 'Photo Essay',
      variant: 'title',
      slug: 'v2-p09',
      chrome: { headLeft: `02 · PHOTO ESSAY`, headRight: `BERNARD AVE, 6AM`, docNo: `DB-009-A`, folio: `09` },
      content: {
        title: `Vacancy`,
        dek: `Six storefronts, one morning, zero people. A walking tour of what the “best downtown in Canada” looks like before the patios open — and after the leases triple.`,
        capA: `FIGS. 4–5 — SHOT ON EXPIRED FILM, APPROPRIATELY.`,
        ph1: `photo — papered-over storefront window`,
        ph2: `photo — empty interior, cords on floor`,
        ph3: `photo — sun-bleached mannequin`,
        ph4: `photo — fourth frame`,
      },
    },
    /* 12 · P12 · 10 */
    {
      template: 'Body',
      variant: 'image-text',
      slug: 'v2-p10',
      chrome: { footer: `mono`, accent: `#f0477d`, headLeft: `02 · PHOTO ESSAY`, headRight: `BERNARD AVE, 6AM`, docNo: `DB-010-A`, folio: `10` },
      content: {
        scribble: `none`,
        scribble2: `none`,
        stamp: `none`,
        placeholder: `photo — last frame: hands taping a new poster up`,
        imgH: `430px`,
        kicker: `01 · HISTORY`,
        caption: `FIG. 6 — SOMEBODY ALWAYS TAPES SOMETHING UP. THAT'S THE WHOLE THESIS.`,
        body: `Vacancy isn’t emptiness — it’s a waiting room. Every papered window downtown is a bet someone rich made against someone broke. The essay ends where the bets get called.`,
        body2: `The fix isn’t mysterious: fund the clinic, train the staff, shorten the triangle. Cities that did it saw waits drop within two budget cycles. Ours pilots a task force instead. We’ll print the task force’s org chart when it produces one — the colouring page may get a sequel.`,
        proseLabel: ``,
        quotes: [
          `“My GP is great. My GP is also in Vancouver, where I don’t live.”`,
          `“The pharmacist figured it out before any doctor did. Shout out Deb.”`,
          `“I got my referral the same month my lease ended. Guess which one moved faster.”`,
          `“Honestly? The group chat is the healthcare system.”`
        ],
        note: `FOUR OF ELEVEN INTERVIEWS · ALL ANONYMIZED · METHODOLOGY: SEE DIRECTORY`,
        colA: `ENTRY`,
        colB: `STATUS`,
        table: [
          `1913 | fruit prices crater; scrip economy begins | BUST | #f0477d`,
          `1930s | packinghouse layoffs, valley-wide | BUST | #f0477d`,
          `1958 | bridge opens; ferry workers obsolete overnight | PIVOT | #fe9a0d`,
          `1973 | ALR freezes orchard speculation (briefly) | PARRY | #12b795`,
          `1980s | sawmill era ends; wine era begins | PIVOT | #fe9a0d`,
          `2003 | firestorm; 239 homes, 30k evacuated | BURN | #f0477d`,
          `2017 | flood year — the lake takes the boardwalk | FLOOD | #f0477d`,
          `2021 | heat dome; hottest place in Canada, again | BURN | #f0477d`,
          `2024 | last dedicated queer venue closes | BUST | #f0477d`,
          `2026 | this magazine. your move, city. | RIPOSTE | #12b795`
        ],
        noteTag: `METHOD`,
        note2: `compiled from city archives, newspaper morgues, and elders who were there. Corrections welcome and expected: see Crumbs Mail.`,
        checkTitle: `WHAT ACTUALLY HELPS / CHECKLIST`,
        checklist: [
          `The informed-consent clinic list — updated quarterly, see directory`,
          `Pharmacists can renew more than you think — ask directly`,
          `Telehealth counts. Bad wifi is still shorter than 400 km`,
          `Bring a friend to appointments. Bureaucracy respects witnesses`
        ],
      },
    },
    /* 13 · P13 · 11 */
    {
      template: 'Opinion',
      chrome: { footer: `mono`, accent: `#f0477d`, headLeft: `03 · OPINION`, headRight: `YOUNG VOICES DESK`, docNo: `DB-011-A`, folio: `11` },
      content: {
        note: `none`,
        quote: `“Every viewing is forty people deep and one of them is always crying.”`,
        promise: `UNREVIEWED. UNEDITED. CORRECT. — THE YV DESK PROMISE`,
        scribble: `none`,
        tag: `YOUNG VOICES · REPORT 01`,
        meta: `AGE 19 · HOUSING`,
        title: `Nobody My Age Can Afford to Stay`,
        body: [
          `I work two jobs and split a two-bedroom with three people, and I’m the success story. My group chat is a slow-motion goodbye party: Vernon, Calgary, mom’s basement in Surrey. Every viewing is forty people deep and one of them is always crying.`,
          `The city calls it a “supply challenge.” From down here it looks simpler: the people who own Kelowna decided the people who run Kelowna’s espresso machines should live somewhere else. I’m not asking for a condo. I’m asking to stay in the postal code where my life happens.`
        ],
      },
    },
    /* 14 · P14 · 12 */
    {
      template: 'Opinion',
      chrome: { footer: `mono`, accent: `#fe9a0d`, headLeft: `03 · OPINION`, headRight: `YOUNG VOICES DESK`, docNo: `DB-012-A`, folio: `12` },
      content: {
        note: `none`,
        quote: `none`,
        promise: `none`,
        scribble: `none`,
        tag: `YOUNG VOICES · REPORT 02`,
        meta: `AGE 22 · COMING OUT`,
        title: `Out at the Packinghouse`,
        body: [
          `I came out at a bush party in Glenmore and the worst thing that happened was a guy named Tyler said “cool” and asked if I could drive him home. That’s the Kelowna nobody writes about: not paradise, not hell — just a small city learning faster than its city council.`,
          `The hard part isn’t hate. It’s geography. When the nearest queer bar is a five-hour drive, your community is whoever shows up to the lake at golden hour. So we built our own calendar. It’s on page 38. Show up.`
        ],
      },
    },
    /* 15 · P15 · 13 */
    {
      template: 'Opinion',
      chrome: { footer: `mono`, accent: `#12b795`, headLeft: `03 · OPINION`, headRight: `YOUNG VOICES DESK`, docNo: `DB-013-A`, folio: `13` },
      content: {
        note: `none`,
        quote: `“I am the precedent.”`,
        promise: `none`,
        scribble: `none`,
        tag: `YOUNG VOICES · REPORT 03`,
        meta: `AGE 17 · FIRE SEASON`,
        title: `I've Evacuated Twice and I Can't Vote Yet`,
        body: [
          `My childhood photos are sorted by smoke year. We packed the car in 2021 and again in 2023, and both times the adults on the radio called it unprecedented. It has precedent. I am the precedent.`,
          `Here’s my ask, and it’s small: stop telling my generation to be resilient while approving hillside subdivisions with one road out. Resilience is what you demand from people after you’ve decided not to protect them.`
        ],
      },
    },
    /* 16 · P16 · 14 */
    {
      template: 'Comic',
      variant: 'page',
      chrome: { headLeft: `04 · COMIC`, headRight: `“CRUMBS” — EP.1 OF ∞`, docNo: `DB-014-A`, folio: `14`, footer: `mono` },
      content: {
        title: `Crumbs`,
        endText: `none`,
        scribble: `none`,
        sub: `A SOURDOUGH GOLEM SEEKS HOUSING. EP.1`,
        panels: [
          `PANEL 1 — a sourdough starter in a jar watches an eviction notice slide under the door`,
          `PANEL 2 — the starter OVERFLOWS. it has decided to become a person about this`,
          `PANEL 3 — CRUMB (our golem, 4ft, crusty, kind eyes) reads the rental listings. horror`,
          "PANEL 4 — “$2,100. shared oven. no pets, no yeast.” Crumb: “I AM pets and yeast.”"
        ],
        endNote: `no spoilers but the loaf unionizes`,
        credit: `STORY + ART: [CARTOONIST NAME] · DRAWN PAGES REPLACE THESE PANEL STUBS AT PASTE-UP`,
        guestTag: `GUEST STRIP / ROTATING SLOT`,
        guestText: `FULL-PAGE GUEST COMIC — a different local cartoonist every issue. №1 guest: [NAME], “Parallel Parking as Queer Praxis”`,
      },
    },
    /* 17 · P17 · 15 */
    {
      template: 'Comic',
      variant: 'page',
      chrome: { headLeft: `04 · COMIC`, headRight: `“CRUMBS” — EP.1 OF ∞`, docNo: `DB-015-A`, folio: `15`, footer: `mono` },
      content: {
        title: `none`,
        endText: `TO BE CONTINUED ON PG 42…`,
        scribble: `none`,
        sub: `A SOURDOUGH GOLEM SEEKS HOUSING. EP.1`,
        panels: [
          `PANEL 5 — viewing line around the block. Crumb queues behind 40 humans and one ogopogo in a trench coat`,
          `PANEL 6 — landlord sniffs: “do you have references?” Crumb produces a sourdough hobbyist’s tearful testimonial`,
          `PANEL 7 — DENIED. Crumb sits on the curb. a pigeon shares its crumbs. irony noted`,
          `PANEL 8 — wide shot: Crumb looks at the empty storefronts from the photo essay. a lightbulb (gas lamp, this is Kelowna) appears`,
          `PANEL 9 — Crumb, measuring tape in hand, outside the old venue: “ZONING IS A SOCIAL CONSTRUCT”`
        ],
        endNote: `no spoilers but the loaf unionizes`,
        credit: `STORY + ART: [CARTOONIST NAME] · DRAWN PAGES REPLACE THESE PANEL STUBS AT PASTE-UP`,
        guestTag: `GUEST STRIP / ROTATING SLOT`,
        guestText: `FULL-PAGE GUEST COMIC — a different local cartoonist every issue. №1 guest: [NAME], “Parallel Parking as Queer Praxis”`,
      },
    },
    /* 18 · P18 · 16 */
    {
      template: 'Interview',
      variant: 'portrait',
      slug: 'v2-p16',
      chrome: { footer: `mono`, accent: `#f0477d`, headLeft: `05 · INTERVIEW`, headRight: `40 YEARS OF OKANAGAN QUEER LIFE`, docNo: `DB-016-A`, folio: `16` },
      content: {
        qLabel: `DB`,
        aLabel: `MD`,
        qa: [
          `Q: You started performing here in 1986. What’s actually changed?`,
          `A: The audience got younger and the rent got meaner. In ’86 the danger was people; now the danger is landlords. I know which fight I prefer — you can charm people.`,
          `Q: Where did everyone go when the venues closed?`,
          `A: Nowhere, sweetheart. That’s the secret. We’re all still here — we just meet in gymnasiums and orchards and each other’s kitchens. A scene isn’t an address.`,
          `Q: Advice for the seventeen-year-olds reading this?`,
          `A: Learn to sew, learn to drive, and never let a city tell you it doesn’t contain you. It does. It always did.`
        ],
        kicker: `Q&A / UNCUT`,
        title: `Forty Years of Nerve`,
        quote: `“We didn’t have a bar, darling. We had basements, and we had nerve.”`,
        caption: `FIG. 7 — “MISS DEMEANOUR,” PERFORMING SINCE 1986. HAIR BY GRAVITY DEFIANCE.`,
        placeholder: `portrait — Miss Demeanour in full regalia, backstage`,
        footNote: `FULL 90-MINUTE AUDIO IN THE №1 ARCHIVE · CONTINUED NEXT PAGE →`,
      },
    },
    /* 19 · P19 · 17 */
    {
      template: 'Interview',
      variant: 'qa',
      slug: 'v2-p17',
      chrome: { footer: `mono`, accent: `#f0477d`, headLeft: `05 · INTERVIEW`, headRight: `40 YEARS OF OKANAGAN QUEER LIFE`, docNo: `DB-017-A`, folio: `17` },
      content: {
        qLabel: `DB`,
        aLabel: `MD`,
        qa: [
          `Q: You started performing here in 1986. What’s actually changed?`,
          `A: The audience got younger and the rent got meaner. In ’86 the danger was people; now the danger is landlords. I know which fight I prefer — you can charm people.`,
          `Q: Where did everyone go when the venues closed?`,
          `A: Nowhere, sweetheart. That’s the secret. We’re all still here — we just meet in gymnasiums and orchards and each other’s kitchens. A scene isn’t an address.`,
          `Q: Advice for the seventeen-year-olds reading this?`,
          `A: Learn to sew, learn to drive, and never let a city tell you it doesn’t contain you. It does. It always did.`
        ],
        kicker: `Q&A / UNCUT`,
        title: `Forty Years of Nerve`,
        quote: `“We didn’t have a bar, darling. We had basements, and we had nerve.”`,
        caption: `FIG. 7 — “MISS DEMEANOUR,” PERFORMING SINCE 1986. HAIR BY GRAVITY DEFIANCE.`,
        placeholder: `portrait — Miss Demeanour in full regalia, backstage`,
        footNote: `FULL 90-MINUTE AUDIO IN THE №1 ARCHIVE · CONTINUED NEXT PAGE →`,
      },
    },
    /* 20 · P20 · 18 */
    {
      template: 'Body',
      variant: 'columns',
      slug: 'v2-p18',
      chrome: { footer: `mono`, accent: `#f0477d`, headLeft: `05 · INTERVIEW`, headRight: `THE SHOEBOX FONDS`, docNo: `DB-018-A`, folio: `18` },
      content: {
        scribble: `none`,
        scribble2: `none`,
        stamp: `ARCHIVED · SHOEBOX FONDS`,
        placeholder: `archival photo — orchard crews, 1910s`,
        imgH: `250px`,
        kicker: `05 · INTERVIEW, CONT.`,
        caption: `FIG. 2 — PICKING CREWS, RUTLAND BENCHES. THE APPLES WERE A PYRAMID SCHEME WITH ROOTS.`,
        body: [
          `The valley sold itself twice: first as Eden, then as equity. Fruit ranchers went broke so often the packinghouses printed their own scrip; when fruit died, the pitch became retirement sun; when the retirees priced out the pickers, the pitch became lakeside lofts.`,
          `Each act ended the same way — with the people who did the work living further from the water. The queer history is braided through all of it: dance halls with unofficial nights, friendship networks that doubled as housing lists, a scene that survived by being useful and quiet until it didn’t have to be.`
        ],
        body2: `People ask if I’m bitter about the decades in basements. Bitter? Those basements had better sound systems than half the clubs I’ve played since. We recorded everything on cassette. Someone’s nephew digitized it all last winter and I cried for a week. That’s your history project right there — a drag queen’s shoebox. The city archive called ME. I said darling, you’re forty years late and you’re paying for the shelving. They did. Progress is slow, then it’s sudden, then it sends an invoice.`,
        proseLabel: `MD, continued:`,
        quotes: [
          `“My GP is great. My GP is also in Vancouver, where I don’t live.”`,
          `“The pharmacist figured it out before any doctor did. Shout out Deb.”`,
          `“I got my referral the same month my lease ended. Guess which one moved faster.”`,
          `“Honestly? The group chat is the healthcare system.”`
        ],
        note: `FOUR OF ELEVEN INTERVIEWS · ALL ANONYMIZED · METHODOLOGY: SEE DIRECTORY`,
        colA: `ENTRY`,
        colB: `STATUS`,
        table: [
          `1913 | fruit prices crater; scrip economy begins | BUST | #f0477d`,
          `1930s | packinghouse layoffs, valley-wide | BUST | #f0477d`,
          `1958 | bridge opens; ferry workers obsolete overnight | PIVOT | #fe9a0d`,
          `1973 | ALR freezes orchard speculation (briefly) | PARRY | #12b795`,
          `1980s | sawmill era ends; wine era begins | PIVOT | #fe9a0d`,
          `2003 | firestorm; 239 homes, 30k evacuated | BURN | #f0477d`,
          `2017 | flood year — the lake takes the boardwalk | FLOOD | #f0477d`,
          `2021 | heat dome; hottest place in Canada, again | BURN | #f0477d`,
          `2024 | last dedicated queer venue closes | BUST | #f0477d`,
          `2026 | this magazine. your move, city. | RIPOSTE | #12b795`
        ],
        noteTag: `METHOD`,
        note2: `compiled from city archives, newspaper morgues, and elders who were there. Corrections welcome and expected: see Crumbs Mail.`,
        checkTitle: `WHAT ACTUALLY HELPS / CHECKLIST`,
        checklist: [
          `The informed-consent clinic list — updated quarterly, see directory`,
          `Pharmacists can renew more than you think — ask directly`,
          `Telehealth counts. Bad wifi is still shorter than 400 km`,
          `Bring a friend to appointments. Bureaucracy respects witnesses`
        ],
      },
    },
    /* 21 · P21 · 19 */
    {
      template: 'Poetry',
      chrome: { accent: `#12b795`, headLeft: `06 · POETRY`, headRight: `SUBMISSIONS · LIT`, docNo: `DB-019-A`, folio: `19`, footer: `mono` },
      content: {
        scribble: `none`,
        poems: [
          `Lake Effect | the ogopogo is real and she is tired / of being your tourism budget / she surfaces only for girls / who skip stones left-handed / and boys who came out in a parking lot / she keeps every ring ever thrown in. | — SUBMITTED FROM RUTLAND, AGE 20`,
          `Harvest | my grandmother thinned apples so the rest grow large / i learned it as economics / she meant it as mercy / this town keeps thinning people / and calling the fruit a miracle. | — SUBMITTED FROM EAST KELOWNA, AGE 24`
        ],
        kicker: `06 · POETRY`,
      },
    },
    /* 22 · P22 · 20 */
    {
      template: 'Insert',
      variant: 'stickers',
      slug: 'v2-p20',
      chrome: { headLeft: `09 · STICKERS (KISS-CUT)`, headRight: `STICK RESPONSIBLY(ISH)`, docNo: `DB-020-A`, folio: `20` },
      content: {
        scribble: `none`,
        ripTag: `✂ RIP LINE — THE CREDIT MARGIN SURVIVES`,
        placeholder: `FEATURED LOCAL ARTIST — full-page A5 portrait artwork, 300dpi. Submissions: see The Wall page`,
        credit: `ARTIST NAME · @HANDLE · №1 FEATURED PIECE — THIS MARGIN SURVIVES THE RIP`,
        kicker: `THE WALL / FEATURED ARTIST`,
        bio: `The two pieces you just passed (rip them out — that’s the point) are by a local artist who answered our open call. Each issue, one artist, two wall-worthy pages, printed on heavier stock, credited in the margin so the credit survives the rip.`,
        submitTitle: `SUBMIT / №2 — THE WALL`,
        submitRows: [
          `Two pieces, A5 portrait, 300dpi, any medium that scans`,
          `Fee paid on selection · rights stay yours`,
          `hello@dailybread.example · subject: WALL`
        ],
        title: `Colour Your Own Collapse`,
        edition: `№1`,
        brief: `[ LINE-ART SATIRE CARTOON — COMMISSIONED PER ISSUE ] №1: city council, drawn as cheerful realtors, ride a saddled Ogopogo across the lake while towing the last queer venue on a “LUXURY LOFTS” barge. pure outlines · no fills · crayon-proof paper`,
        figLabel: `FIG. 8 — AISLIN-GRADE DISRESPECT, LOCAL EDITION`,
        crayonLabel: `TEST YOUR CRAYONS:`,
        crayonNote: `TAG US WITH YOUR FINISHED PAGE`,
        brand: `Peel Me`,
        brandSub: `DIE LINES DASHED · STICK RESPONSIBLY(ISH)`,
        stickers: [
          `FRESH DAILY (DREAD) | circle | #f0477d | #f6f1e7`,
          `EAT THE RICH, SHARE THE BREAD | square | #f6f1e7 | #1d1a17`,
          `OGOPOGO SAW YOU | circle | #12b795 | #f6f1e7`,
          `DAILY BREAD — drip wordmark | square | #1d1a17 | #f6f1e7`,
          `LOCAL PEACH, GENDER UNKNOWN | circle | #fe9a0d | #1d1a17`,
          `I SURVIVED ANOTHER TOWER PROPOSAL | square | #f6f1e7 | #1d1a17`,
          `QUIET UNTIL WE DIDN’T HAVE TO BE | square | #1d1a17 | #f6f1e7`,
          `PARRY. RIPOSTE. | circle | #f6f1e7 | #1d1a17`,
          `CRUMB 4 MAYOR | square | #f0477d | #f6f1e7`
        ],
      },
    },
    /* 23 · P23 · 21 */
    {
      template: 'Insert',
      variant: 'colouring',
      slug: 'v2-p21',
      chrome: { headLeft: `08 · SATIRE`, headRight: `CRAYON-PROOF PAPER`, docNo: `DB-021-A`, folio: `21` },
      content: {
        scribble: `none`,
        ripTag: `✂ RIP LINE — THE CREDIT MARGIN SURVIVES`,
        placeholder: `FEATURED LOCAL ARTIST — full-page A5 portrait artwork, 300dpi. Submissions: see The Wall page`,
        credit: `ARTIST NAME · @HANDLE · №1 FEATURED PIECE — THIS MARGIN SURVIVES THE RIP`,
        kicker: `THE WALL / FEATURED ARTIST`,
        bio: `The two pieces you just passed (rip them out — that’s the point) are by a local artist who answered our open call. Each issue, one artist, two wall-worthy pages, printed on heavier stock, credited in the margin so the credit survives the rip.`,
        submitTitle: `SUBMIT / №2 — THE WALL`,
        submitRows: [
          `Two pieces, A5 portrait, 300dpi, any medium that scans`,
          `Fee paid on selection · rights stay yours`,
          `hello@dailybread.example · subject: WALL`
        ],
        title: `Colour Your Own Collapse`,
        edition: `№1`,
        brief: `[ LINE-ART SATIRE CARTOON — COMMISSIONED PER ISSUE ] №1: city council, drawn as cheerful realtors, ride a saddled Ogopogo across the lake while towing the last queer venue on a “LUXURY LOFTS” barge. pure outlines · no fills · crayon-proof paper`,
        figLabel: `FIG. 8 — AISLIN-GRADE DISRESPECT, LOCAL EDITION`,
        crayonLabel: `TEST YOUR CRAYONS:`,
        crayonNote: `TAG US WITH YOUR FINISHED PAGE`,
        brand: `Peel Me`,
        brandSub: `DIE LINES DASHED · STICK RESPONSIBLY(ISH)`,
        stickers: [
          `FRESH DAILY (DREAD) | circle | #f0477d | #f6f1e7`,
          `EAT THE RICH, SHARE THE BREAD | square | #f6f1e7 | #1d1a17`,
          `OGOPOGO SAW YOU | circle | #12b795 | #f6f1e7`,
          `DAILY BREAD — drip wordmark | square | #1d1a17 | #f6f1e7`,
          `LOCAL PEACH, GENDER UNKNOWN | circle | #fe9a0d | #1d1a17`,
          `I SURVIVED ANOTHER TOWER PROPOSAL | square | #f6f1e7 | #1d1a17`,
          `QUIET UNTIL WE DIDN’T HAVE TO BE | square | #1d1a17 | #f6f1e7`,
          `PARRY. RIPOSTE. | circle | #f6f1e7 | #1d1a17`,
          `CRUMB 4 MAYOR | square | #f0477d | #f6f1e7`
        ],
      },
    },
    /* 24 · P24 · 22 */
    {
      template: 'Insert',
      variant: 'art',
      slug: 'v2-p22',
      chrome: { headLeft: ``, headRight: ``, docNo: `DB-019-A`, folio: `19` },
      content: {
        scribble: `none`,
        ripTag: `✂ RIP LINE — THE CREDIT MARGIN SURVIVES`,
        placeholder: `FEATURED LOCAL ARTIST — piece one of two. Full-page A5 portrait artwork, 300dpi`,
        credit: `ARTIST NAME · @HANDLE · №1 FEATURED PIECE 01 OF 02 — THIS MARGIN SURVIVES THE RIP`,
        kicker: `THE WALL / FEATURED ARTIST`,
        bio: `The two pieces you just passed (rip them out — that’s the point) are by a local artist who answered our open call. Each issue, one artist, two wall-worthy pages, printed on heavier stock, credited in the margin so the credit survives the rip.`,
        submitTitle: `SUBMIT / №2 — THE WALL`,
        submitRows: [
          `Two pieces, A5 portrait, 300dpi, any medium that scans`,
          `Fee paid on selection · rights stay yours`,
          `hello@dailybread.example · subject: WALL`
        ],
        title: `Colour Your Own Collapse`,
        edition: `№1`,
        brief: `[ LINE-ART SATIRE CARTOON — COMMISSIONED PER ISSUE ] №1: city council, drawn as cheerful realtors, ride a saddled Ogopogo across the lake while towing the last queer venue on a “LUXURY LOFTS” barge. pure outlines · no fills · crayon-proof paper`,
        figLabel: `FIG. 8 — AISLIN-GRADE DISRESPECT, LOCAL EDITION`,
        crayonLabel: `TEST YOUR CRAYONS:`,
        crayonNote: `TAG US WITH YOUR FINISHED PAGE`,
        brand: `Peel Me`,
        brandSub: `DIE LINES DASHED · STICK RESPONSIBLY(ISH)`,
        stickers: [
          `FRESH DAILY (DREAD) | circle | #f0477d | #f6f1e7`,
          `EAT THE RICH, SHARE THE BREAD | square | #f6f1e7 | #1d1a17`,
          `OGOPOGO SAW YOU | circle | #12b795 | #f6f1e7`,
          `DAILY BREAD — drip wordmark | square | #1d1a17 | #f6f1e7`,
          `LOCAL PEACH, GENDER UNKNOWN | circle | #fe9a0d | #1d1a17`,
          `I SURVIVED ANOTHER TOWER PROPOSAL | square | #f6f1e7 | #1d1a17`,
          `QUIET UNTIL WE DIDN’T HAVE TO BE | square | #1d1a17 | #f6f1e7`,
          `PARRY. RIPOSTE. | circle | #f6f1e7 | #1d1a17`,
          `CRUMB 4 MAYOR | square | #f0477d | #f6f1e7`
        ],
      },
    },
    /* 25 · P25 · 23 */
    {
      template: 'Insert',
      variant: 'art',
      slug: 'v2-p23',
      chrome: { headLeft: ``, headRight: ``, docNo: `DB-019-A`, folio: `19` },
      content: {
        scribble: `none`,
        ripTag: `✂ RIP LINE — THE CREDIT MARGIN SURVIVES`,
        placeholder: `FEATURED LOCAL ARTIST — piece two of two. Full-page A5 portrait artwork, 300dpi`,
        credit: `ARTIST NAME · @HANDLE · №1 FEATURED PIECE 02 OF 02 — THIS MARGIN SURVIVES THE RIP`,
        kicker: `THE WALL / FEATURED ARTIST`,
        bio: `The two pieces you just passed (rip them out — that’s the point) are by a local artist who answered our open call. Each issue, one artist, two wall-worthy pages, printed on heavier stock, credited in the margin so the credit survives the rip.`,
        submitTitle: `SUBMIT / №2 — THE WALL`,
        submitRows: [
          `Two pieces, A5 portrait, 300dpi, any medium that scans`,
          `Fee paid on selection · rights stay yours`,
          `hello@dailybread.example · subject: WALL`
        ],
        title: `Colour Your Own Collapse`,
        edition: `№1`,
        brief: `[ LINE-ART SATIRE CARTOON — COMMISSIONED PER ISSUE ] №1: city council, drawn as cheerful realtors, ride a saddled Ogopogo across the lake while towing the last queer venue on a “LUXURY LOFTS” barge. pure outlines · no fills · crayon-proof paper`,
        figLabel: `FIG. 8 — AISLIN-GRADE DISRESPECT, LOCAL EDITION`,
        crayonLabel: `TEST YOUR CRAYONS:`,
        crayonNote: `TAG US WITH YOUR FINISHED PAGE`,
        brand: `Peel Me`,
        brandSub: `DIE LINES DASHED · STICK RESPONSIBLY(ISH)`,
        stickers: [
          `FRESH DAILY (DREAD) | circle | #f0477d | #f6f1e7`,
          `EAT THE RICH, SHARE THE BREAD | square | #f6f1e7 | #1d1a17`,
          `OGOPOGO SAW YOU | circle | #12b795 | #f6f1e7`,
          `DAILY BREAD — drip wordmark | square | #1d1a17 | #f6f1e7`,
          `LOCAL PEACH, GENDER UNKNOWN | circle | #fe9a0d | #1d1a17`,
          `I SURVIVED ANOTHER TOWER PROPOSAL | square | #f6f1e7 | #1d1a17`,
          `QUIET UNTIL WE DIDN’T HAVE TO BE | square | #1d1a17 | #f6f1e7`,
          `PARRY. RIPOSTE. | circle | #f6f1e7 | #1d1a17`,
          `CRUMB 4 MAYOR | square | #f0477d | #f6f1e7`
        ],
      },
    },
    /* 26 · P26 · 24 */
    {
      template: 'Insert',
      variant: 'artist',
      slug: 'v2-p24',
      chrome: { headLeft: `07 · ART`, headRight: `THE WALL`, docNo: `DB-024-A`, folio: `24` },
      content: {
        scribble: `none`,
        ripTag: `✂ RIP LINE — THE CREDIT MARGIN SURVIVES`,
        placeholder: `FEATURED LOCAL ARTIST — full-page A5 portrait artwork, 300dpi. Submissions: see The Wall page`,
        credit: `ARTIST NAME · @HANDLE · №1 FEATURED PIECE — THIS MARGIN SURVIVES THE RIP`,
        kicker: `THE WALL / FEATURED ARTIST`,
        bio: `The two pieces you just passed (rip them out — that’s the point) are by a local artist who answered our open call. Each issue, one artist, two wall-worthy pages, printed on heavier stock, credited in the margin so the credit survives the rip.`,
        submitTitle: `SUBMIT / №2 — THE WALL`,
        submitRows: [
          `Two pieces, A5 portrait, 300dpi, any medium that scans`,
          `Fee paid on selection · rights stay yours`,
          `hello@dailybread.example · subject: WALL`
        ],
        title: `Colour Your Own Collapse`,
        edition: `№1`,
        brief: `[ LINE-ART SATIRE CARTOON — COMMISSIONED PER ISSUE ] №1: city council, drawn as cheerful realtors, ride a saddled Ogopogo across the lake while towing the last queer venue on a “LUXURY LOFTS” barge. pure outlines · no fills · crayon-proof paper`,
        figLabel: `FIG. 8 — AISLIN-GRADE DISRESPECT, LOCAL EDITION`,
        crayonLabel: `TEST YOUR CRAYONS:`,
        crayonNote: `TAG US WITH YOUR FINISHED PAGE`,
        brand: `Peel Me`,
        brandSub: `DIE LINES DASHED · STICK RESPONSIBLY(ISH)`,
        stickers: [
          `FRESH DAILY (DREAD) | circle | #f0477d | #f6f1e7`,
          `EAT THE RICH, SHARE THE BREAD | square | #f6f1e7 | #1d1a17`,
          `OGOPOGO SAW YOU | circle | #12b795 | #f6f1e7`,
          `DAILY BREAD — drip wordmark | square | #1d1a17 | #f6f1e7`,
          `LOCAL PEACH, GENDER UNKNOWN | circle | #fe9a0d | #1d1a17`,
          `I SURVIVED ANOTHER TOWER PROPOSAL | square | #f6f1e7 | #1d1a17`,
          `QUIET UNTIL WE DIDN’T HAVE TO BE | square | #1d1a17 | #f6f1e7`,
          `PARRY. RIPOSTE. | circle | #f6f1e7 | #1d1a17`,
          `CRUMB 4 MAYOR | square | #f0477d | #f6f1e7`
        ],
      },
    },
    /* 27 · P27 · 25 */
    {
      template: 'Feature',
      variant: 'opener',
      slug: 'v2-p25',
      chrome: { footer: `mono`, accent: `#f0477d`, headLeft: `10 · CURRENT ISSUES`, headRight: `THEME: KELOWNA’S COLLAPSE`, docNo: `DB-025-A`, folio: `25` },
      content: {
        body: `The numbers are placeholder-real: swap in the verified figures before print. The shape of the story won’t change — everyone we interviewed described the same triangle of phone tag, referral limbo, and a highway.`,
        scribble: `none`,
        stats: [
          `14 | MONTHS · AVG GENDER CLINIC WAIT`,
          `2 | PROVIDERS TAKING NEW PATIENTS`,
          `400 | KM TO NEAREST ALTERNATIVE`
        ],
        byline: `none`,
        kicker: `10 · CURRENT ISSUES`,
        title: `The Waitlist`,
        dek: `Trying to find queer-competent healthcare in the Central Okanagan is a part-time job with no benefits. We phoned every clinic so you don’t have to.`,
        caption: `FIG. 1 — CAPTION SETS THE JOKE, THE IMAGE SETS THE SCENE.`,
        placeholder: `feature photo — drag and drop, 300dpi`,
        contNote: `CONTINUED NEXT PAGE → · STREET INTERVIEWS + WHAT ACTUALLY HELPS`,
        boxTitle: `CONTINUED IN №2 — “THE THAW”`,
        boxBody: `Serialized fiction runs across issues. Miss one and the lake keeps your bookmark.`,
      },
    },
    /* 28 · P28 · 26 */
    {
      template: 'Body',
      variant: 'quotes',
      slug: 'v2-p26',
      chrome: { footer: `mono`, accent: `#f0477d`, headLeft: `10 · CURRENT ISSUES`, headRight: `THE WAITLIST, CONT.`, docNo: `DB-026-A`, folio: `26` },
      content: {
        scribble: `none`,
        scribble2: `none`,
        stamp: `none`,
        placeholder: `archival photo — orchard crews, 1910s`,
        imgH: `250px`,
        kicker: `HEARD ON BERNARD / VERBATIM`,
        caption: `FIG. 2 — PICKING CREWS, RUTLAND BENCHES. THE APPLES WERE A PYRAMID SCHEME WITH ROOTS.`,
        body: [
          `The valley sold itself twice: first as Eden, then as equity. Fruit ranchers went broke so often the packinghouses printed their own scrip; when fruit died, the pitch became retirement sun; when the retirees priced out the pickers, the pitch became lakeside lofts.`,
          `Each act ended the same way — with the people who did the work living further from the water. The queer history is braided through all of it: dance halls with unofficial nights, friendship networks that doubled as housing lists, a scene that survived by being useful and quiet until it didn’t have to be.`
        ],
        body2: `The fix isn’t mysterious: fund the clinic, train the staff, shorten the triangle. Cities that did it saw waits drop within two budget cycles. Ours pilots a task force instead. We’ll print the task force’s org chart when it produces one — the colouring page may get a sequel.`,
        proseLabel: ``,
        quotes: [
          `“My GP is great. My GP is also in Vancouver, where I don’t live.”`,
          `“The pharmacist figured it out before any doctor did. Shout out Deb.”`,
          `“I got my referral the same month my lease ended. Guess which one moved faster.”`,
          `“Honestly? The group chat is the healthcare system.”`
        ],
        note: `FOUR OF ELEVEN INTERVIEWS · ALL ANONYMIZED · METHODOLOGY: SEE DIRECTORY`,
        colA: `ENTRY`,
        colB: `STATUS`,
        table: [
          `1913 | fruit prices crater; scrip economy begins | BUST | #f0477d`,
          `1930s | packinghouse layoffs, valley-wide | BUST | #f0477d`,
          `1958 | bridge opens; ferry workers obsolete overnight | PIVOT | #fe9a0d`,
          `1973 | ALR freezes orchard speculation (briefly) | PARRY | #12b795`,
          `1980s | sawmill era ends; wine era begins | PIVOT | #fe9a0d`,
          `2003 | firestorm; 239 homes, 30k evacuated | BURN | #f0477d`,
          `2017 | flood year — the lake takes the boardwalk | FLOOD | #f0477d`,
          `2021 | heat dome; hottest place in Canada, again | BURN | #f0477d`,
          `2024 | last dedicated queer venue closes | BUST | #f0477d`,
          `2026 | this magazine. your move, city. | RIPOSTE | #12b795`
        ],
        noteTag: `METHOD`,
        note2: `compiled from city archives, newspaper morgues, and elders who were there. Corrections welcome and expected: see Crumbs Mail.`,
        checkTitle: `WHAT ACTUALLY HELPS / CHECKLIST`,
        checklist: [
          `The informed-consent clinic list — updated quarterly, see directory`,
          `Pharmacists can renew more than you think — ask directly`,
          `Telehealth counts. Bad wifi is still shorter than 400 km`,
          `Bring a friend to appointments. Bureaucracy respects witnesses`
        ],
      },
    },
    /* 29 · P29 · 27 */
    {
      template: 'Body',
      variant: 'checklist',
      slug: 'v2-p27',
      chrome: { footer: `mono`, accent: `#f0477d`, headLeft: `10 · CURRENT ISSUES`, headRight: `THE WAITLIST, CONT.`, docNo: `DB-027-A`, folio: `27` },
      content: {
        scribble: `none`,
        scribble2: `none`,
        stamp: `none`,
        placeholder: `archival photo — orchard crews, 1910s`,
        imgH: `250px`,
        kicker: ``,
        caption: `FIG. 2 — PICKING CREWS, RUTLAND BENCHES. THE APPLES WERE A PYRAMID SCHEME WITH ROOTS.`,
        body: [
          `The valley sold itself twice: first as Eden, then as equity. Fruit ranchers went broke so often the packinghouses printed their own scrip; when fruit died, the pitch became retirement sun; when the retirees priced out the pickers, the pitch became lakeside lofts.`,
          `Each act ended the same way — with the people who did the work living further from the water. The queer history is braided through all of it: dance halls with unofficial nights, friendship networks that doubled as housing lists, a scene that survived by being useful and quiet until it didn’t have to be.`
        ],
        body2: `The fix isn’t mysterious: fund the clinic, train the staff, shorten the triangle. Cities that did it saw waits drop within two budget cycles. Ours pilots a task force instead. We’ll print the task force’s org chart when it produces one — the colouring page may get a sequel.`,
        proseLabel: ``,
        quotes: [
          `“My GP is great. My GP is also in Vancouver, where I don’t live.”`,
          `“The pharmacist figured it out before any doctor did. Shout out Deb.”`,
          `“I got my referral the same month my lease ended. Guess which one moved faster.”`,
          `“Honestly? The group chat is the healthcare system.”`
        ],
        note: `FOUR OF ELEVEN INTERVIEWS · ALL ANONYMIZED · METHODOLOGY: SEE DIRECTORY`,
        colA: `ENTRY`,
        colB: `STATUS`,
        table: [
          `1913 | fruit prices crater; scrip economy begins | BUST | #f0477d`,
          `1930s | packinghouse layoffs, valley-wide | BUST | #f0477d`,
          `1958 | bridge opens; ferry workers obsolete overnight | PIVOT | #fe9a0d`,
          `1973 | ALR freezes orchard speculation (briefly) | PARRY | #12b795`,
          `1980s | sawmill era ends; wine era begins | PIVOT | #fe9a0d`,
          `2003 | firestorm; 239 homes, 30k evacuated | BURN | #f0477d`,
          `2017 | flood year — the lake takes the boardwalk | FLOOD | #f0477d`,
          `2021 | heat dome; hottest place in Canada, again | BURN | #f0477d`,
          `2024 | last dedicated queer venue closes | BUST | #f0477d`,
          `2026 | this magazine. your move, city. | RIPOSTE | #12b795`
        ],
        noteTag: `METHOD`,
        note2: `compiled from city archives, newspaper morgues, and elders who were there. Corrections welcome and expected: see Crumbs Mail.`,
        checkTitle: `WHAT ACTUALLY HELPS / CHECKLIST`,
        checklist: [
          `The informed-consent clinic list — updated quarterly, see directory`,
          `Pharmacists can renew more than you think — ask directly`,
          `Telehealth counts. Bad wifi is still shorter than 400 km`,
          `Bring a friend to appointments. Bureaucracy respects witnesses`
        ],
      },
    },
    /* 30 · P30 · 28 */
    {
      template: 'Feature',
      variant: 'text-open',
      slug: 'v2-p28',
      chrome: { footer: `mono`, accent: `#f0477d`, headLeft: `11 · FICTION`, headRight: `THEME: KELOWNA’S COLLAPSE`, docNo: `DB-028-A`, folio: `28` },
      content: {
        body: [
          `The realtor said the house had lake access, and it did, the way a mouth has throat access. June found the stairs behind the lilac on the second day — forty-one steps of split cedar going down to a dock that wasn’t in the listing photos, because docks that old don’t photograph, they testify.`,
          `Her grandmother had warned her about the lake in the language June only half-kept: it gives, but it keeps receipts. Every family on the bench had a story with the same shape — a ring, a brother, a hayfork, a name — something the water accepted and never gave back at the same size.`
        ],
        scribble: `none`,
        stats: `none`,
        byline: `BY [AUTHOR] · ILLUSTRATION OPEN CALL`,
        kicker: `SHORT FICTION`,
        title: `The Lake Takes`,
        dek: `Trying to find queer-competent healthcare in the Central Okanagan is a part-time job with no benefits. We phoned every clinic so you don’t have to.`,
        caption: `FIG. 1 — CAPTION SETS THE JOKE, THE IMAGE SETS THE SCENE.`,
        placeholder: `feature photo — drag and drop, 300dpi`,
        contNote: `CONTINUED NEXT PAGE → · STREET INTERVIEWS + WHAT ACTUALLY HELPS`,
        boxTitle: `CONTINUED IN №2 — “THE THAW”`,
        boxBody: `Serialized fiction runs across issues. Miss one and the lake keeps your bookmark.`,
      },
    },
    /* 31 · P31 · 29 */
    {
      template: 'Feature',
      variant: 'text-cont',
      slug: 'v2-p29',
      chrome: { footer: `mono`, accent: `#f0477d`, headLeft: `11 · FICTION`, headRight: `THEME: KELOWNA’S COLLAPSE`, docNo: `DB-029-A`, folio: `29` },
      content: {
        body: [
          `On the dock she found the offerings the winter had rearranged: a doll’s shoe, a fishing licence from 1974, a phone in a sandwich bag, screen up, one notification still glowing like a lure. The lake was flat as a ledger. June, who had moved back for the cheap rent that no longer existed and the family that barely did, rolled her jeans and stepped down onto the first cold plank.`,
          `“Okay,” she told the water, the town, the whole arranged marriage of valley and debt. “Show me what you kept.”`
        ],
        scribble: `none`,
        stats: `none`,
        byline: `BY [AUTHOR] · ILLUSTRATION OPEN CALL`,
        kicker: `SHORT FICTION`,
        title: `The Lake Takes`,
        dek: `Trying to find queer-competent healthcare in the Central Okanagan is a part-time job with no benefits. We phoned every clinic so you don’t have to.`,
        caption: `FIG. 1 — CAPTION SETS THE JOKE, THE IMAGE SETS THE SCENE.`,
        placeholder: `feature photo — drag and drop, 300dpi`,
        contNote: `CONTINUED NEXT PAGE → · STREET INTERVIEWS + WHAT ACTUALLY HELPS`,
        boxTitle: `CONTINUED IN №2 — “THE THAW”`,
        boxBody: `Serialized fiction runs across issues. Miss one and the lake keeps your bookmark.`,
      },
    },
    /* 32 · P32 · 30 */
    {
      template: 'Lab',
      variant: 'disclosure',
      chrome: { headLeft: `RIPOSTE LABORATORIES INC.`, headRight: `EST. 2026 · REV. A`, docNo: `RL-DB-030`, folio: `30` },
      content: {
        stamp: `FUNDER DISCLOSURE · SIGNED`,
        logoSub: `LABORATORIES INC.`,
        title: `From the Lab`,
        body: [
          `Full disclosure, printed large: this magazine is funded by Riposte Laboratories, a Kelowna outfit that counter-attacks waste — recycled-plastic injection molding and reclaimed-cell modular power. We share what we’re building here, in the same pages, at the same volume as everyone else.`,
          `The deal, in writing: the Lab pays the printer and gets two pages. The editors answer to readers, not the funder. If that ever changes, the colouring page will let you know.`
        ],
        sig: `parry. riposte. recycle.`,
        statusLabel: `THIS QUARTER / STATUS BOARD`,
        statusTag: `Q3-26`,
        status: [
          `Plastic Works — molds v2, park benches from #5 tubs | LIVE | #12b795`,
          `Project HEX — reclaimed-cell grading rig | WIP | #fe9a0d`,
          `Esh — shop assistant, currently a whiteboard | DRAWING | #f0477d`,
          `Daily Bread №2 — theme vote (see Crumbs Mail) | OPEN | #1d1a17`,
          `First Friday open doors — bring clean plastics | RECURRING | #12b795`
        ],
        whyTitle: `WHY FUND A MAGAZINE?`,
        whyBody: `Because a lab that fixes material waste in a town losing its cultural material would be doing half a job. Paper is infrastructure. So are drag nights. Line item approved.`,
        footNote: `TOUR THE SHOP: OPEN DOORS FIRST FRIDAYS · BRING CLEAN #2 + #5 PLASTICS`,
      },
    },
    /* 33 · P33 · 31 */
    {
      template: 'Lab',
      variant: 'status',
      chrome: { headLeft: `RIPOSTE LABORATORIES INC.`, headRight: `EST. 2026 · REV. A`, docNo: `RL-DB-031`, folio: `31` },
      content: {
        stamp: `FUNDER DISCLOSURE · SIGNED`,
        logoSub: `LABORATORIES INC.`,
        title: `From the Lab`,
        body: [
          `Full disclosure, printed large: this magazine is funded by Riposte Laboratories, a Kelowna outfit that counter-attacks waste — recycled-plastic injection molding and reclaimed-cell modular power. We share what we’re building here, in the same pages, at the same volume as everyone else.`,
          `The deal, in writing: the Lab pays the printer and gets two pages. The editors answer to readers, not the funder. If that ever changes, the colouring page will let you know.`
        ],
        sig: `parry. riposte. recycle.`,
        statusLabel: `THIS QUARTER / STATUS BOARD`,
        statusTag: `Q3-26`,
        status: [
          `Plastic Works — molds v2, park benches from #5 tubs | LIVE | #12b795`,
          `Project HEX — reclaimed-cell grading rig | WIP | #fe9a0d`,
          `Esh — shop assistant, currently a whiteboard | DRAWING | #f0477d`,
          `Daily Bread №2 — theme vote (see Crumbs Mail) | OPEN | #1d1a17`,
          `First Friday open doors — bring clean plastics | RECURRING | #12b795`
        ],
        whyTitle: `WHY FUND A MAGAZINE?`,
        whyBody: `Because a lab that fixes material waste in a town losing its cultural material would be doing half a job. Paper is infrastructure. So are drag nights. Line item approved.`,
        footNote: `TOUR THE SHOP: OPEN DOORS FIRST FRIDAYS · BRING CLEAN #2 + #5 PLASTICS`,
      },
    },
    /* 34 · P34 · 32 */
    {
      template: 'Review',
      variant: 'advice',
      chrome: { footer: `mono`, accent: `#f0477d`, headLeft: `12 · ADVICE`, headRight: `CERTIFIED · SINCE TUESDAY`, docNo: `DB-032-A`, folio: `32` },
      content: {
        scribble: `none`,
        blurb: `none`,
        stamp: `none`,
        brand: `Ask a Local Gay`,
        brandSub: `CERTIFIED · SINCE TUESDAY`,
        advice: [
          `My parents keep introducing me as their “roommate’s friend.” The roommate is my wife. Escalate or let it ride? — TIRED IN LAKE COUNTRY | Send them a fridge magnet of your wedding photo every month. No note. Bureaucracy respects witnesses and parents respect fridges. By magnet six you’ll be “the girls.” By ten, they’re paying for brunch.`,
          `Is it a red flag if a date says Kelowna has “no culture”? — DEFENSIVE DOWNTOWN | It’s a beige flag. Hand them this magazine, the calendar page, and a pen. If they come to one thing on the calendar, marry them. If they critique the font, you’ve met the editor — run.`
        ],
        features: [
          "WINE BAR · LAKESHORE · $$$$ | 2/5 — GORGEOUS, HUNGRY | #f0477d | The place that replaced the diner | The room is stunning, the playlist is a moodboard, and the “heritage tomato moment” is one tomato. Our server was the best actor in the valley: she said “great choice” about a $19 plate of air with total conviction. We left elegant and starving, then bought gas-station taquitos. Verdict: it photographs like a meal.",
          "DINER · RUTLAND · $ | 5/5 — PROTECT AT ALL COSTS | #12b795 | The 24-hour survivor on Hwy 33 | Coffee refills arrive before you ask, the hashbrowns have structural integrity, and the night cook remembers your order and your pronouns. Every collapse in this issue is survivable from booth six. Bring cash, tip like rent is due, because theirs is too."
        ],
        rulesTag: `HOUSE RULES`,
        rules: `we pay full price · we book under fake names · patios judged by dog traffic · anywhere that feeds evacuation crews gets a permanent star`,
        kicker: `REVIEWS / FIELD-TESTED`,
        cards: [
          `DRAG NIGHT · POP-UP | RIPS | #12b795 | “Harvest Moon” at the community hall | A gymnasium, a rented fog machine, and the best crowd this valley has produced. The floor is lava and the lava is love. Next one: see calendar.`,
          `BAKERY · DOWNTOWN | 4/5 | #fe9a0d | The new sourdough place on Ellis | The loaf is honest, the queue is chatty, and the owner slips day-olds to anyone who compliments the playlist. Crumb declined to comment, citing family.`,
          `CIVIC · ONGOING | 0/5 | #f0477d | Council public-hearing livestream | Buffering as dramaturgy. Runtime: eternal. One star added for the councillor who said “housing is for people” out loud; four removed for the vote after.`
        ],
        rotTitle: `Rotation`,
        rotLabel: `STAFF ROTATION / №1`,
        rotTag: `LOUD`,
        tracks: [
          `“Bench Water” — local EP | the connector, at night`,
          `ballroom sets — Paris Is Burning warm-ups | pre-screening homework`,
          `snotty coast punk — 7″ from a Rutland garage | paste-up fuel`,
          `a syilx songwriter’s live tape | ask at the record stall`,
          `disco edits for the beach assembly | aug 15, bring speakers`,
          `the diner jukebox, booth six | field recording, honestly`,
          `whatever the night cook hums | unreleased. protected.`
        ],
        qrNote: `FULL PLAYLIST QR — UPDATED PER ISSUE`,
        qrSub: `SEND US ONE SONG + ONE SENTENCE`,
      },
    },
    /* 35 · P35 · 33 */
    {
      template: 'Review',
      variant: 'cards',
      chrome: { footer: `mono`, accent: `#f0477d`, headLeft: `13 · REVIEWS`, headRight: `FIELD-TESTED`, docNo: `DB-033-A`, folio: `33` },
      content: {
        scribble: `none`,
        blurb: `Want a review? We cover anything queer-adjacent and Okanagan-made: shows, menus, zines, hot sauce, city council meetings (as performance art). The only criterion is that we can attend, taste, or endure it in person.`,
        stamp: `ENDURED · 3/5`,
        brand: `Ask a Local Gay`,
        brandSub: `CERTIFIED · SINCE TUESDAY`,
        advice: [
          `My parents keep introducing me as their “roommate’s friend.” The roommate is my wife. Escalate or let it ride? — TIRED IN LAKE COUNTRY | Send them a fridge magnet of your wedding photo every month. No note. Bureaucracy respects witnesses and parents respect fridges. By magnet six you’ll be “the girls.” By ten, they’re paying for brunch.`,
          `Is it a red flag if a date says Kelowna has “no culture”? — DEFENSIVE DOWNTOWN | It’s a beige flag. Hand them this magazine, the calendar page, and a pen. If they come to one thing on the calendar, marry them. If they critique the font, you’ve met the editor — run.`
        ],
        features: [
          "WINE BAR · LAKESHORE · $$$$ | 2/5 — GORGEOUS, HUNGRY | #f0477d | The place that replaced the diner | The room is stunning, the playlist is a moodboard, and the “heritage tomato moment” is one tomato. Our server was the best actor in the valley: she said “great choice” about a $19 plate of air with total conviction. We left elegant and starving, then bought gas-station taquitos. Verdict: it photographs like a meal.",
          "DINER · RUTLAND · $ | 5/5 — PROTECT AT ALL COSTS | #12b795 | The 24-hour survivor on Hwy 33 | Coffee refills arrive before you ask, the hashbrowns have structural integrity, and the night cook remembers your order and your pronouns. Every collapse in this issue is survivable from booth six. Bring cash, tip like rent is due, because theirs is too."
        ],
        rulesTag: `HOUSE RULES`,
        rules: `we pay full price · we book under fake names · patios judged by dog traffic · anywhere that feeds evacuation crews gets a permanent star`,
        kicker: `REVIEWS / FIELD-TESTED`,
        cards: [
          `DRAG NIGHT · POP-UP | RIPS | #12b795 | “Harvest Moon” at the community hall | A gymnasium, a rented fog machine, and the best crowd this valley has produced. The floor is lava and the lava is love. Next one: see calendar.`,
          `BAKERY · DOWNTOWN | 4/5 | #fe9a0d | The new sourdough place on Ellis | The loaf is honest, the queue is chatty, and the owner slips day-olds to anyone who compliments the playlist. Crumb declined to comment, citing family.`,
          `CIVIC · ONGOING | 0/5 | #f0477d | Council public-hearing livestream | Buffering as dramaturgy. Runtime: eternal. One star added for the councillor who said “housing is for people” out loud; four removed for the vote after.`
        ],
        rotTitle: `Rotation`,
        rotLabel: `STAFF ROTATION / №1`,
        rotTag: `LOUD`,
        tracks: [
          `“Bench Water” — local EP | the connector, at night`,
          `ballroom sets — Paris Is Burning warm-ups | pre-screening homework`,
          `snotty coast punk — 7″ from a Rutland garage | paste-up fuel`,
          `a syilx songwriter’s live tape | ask at the record stall`,
          `disco edits for the beach assembly | aug 15, bring speakers`,
          `the diner jukebox, booth six | field recording, honestly`,
          `whatever the night cook hums | unreleased. protected.`
        ],
        qrNote: `FULL PLAYLIST QR — UPDATED PER ISSUE`,
        qrSub: `SEND US ONE SONG + ONE SENTENCE`,
      },
    },
    /* 36 · P36 · 34 */
    {
      template: 'Review',
      variant: 'critique',
      chrome: { footer: `mono`, accent: `#f0477d`, headLeft: `15 · FOOD`, headRight: `NO FREE MEALS, NO MERCY`, docNo: `DB-034-A`, folio: `34` },
      content: {
        scribble: `none`,
        blurb: `none`,
        stamp: `none`,
        brand: `The Bite Back`,
        brandSub: `RESTAURANT CRITIQUE · NO FREE MEALS, NO MERCY`,
        advice: [
          `My parents keep introducing me as their “roommate’s friend.” The roommate is my wife. Escalate or let it ride? — TIRED IN LAKE COUNTRY | Send them a fridge magnet of your wedding photo every month. No note. Bureaucracy respects witnesses and parents respect fridges. By magnet six you’ll be “the girls.” By ten, they’re paying for brunch.`,
          `Is it a red flag if a date says Kelowna has “no culture”? — DEFENSIVE DOWNTOWN | It’s a beige flag. Hand them this magazine, the calendar page, and a pen. If they come to one thing on the calendar, marry them. If they critique the font, you’ve met the editor — run.`
        ],
        features: [
          "WINE BAR · LAKESHORE · $$$$ | 2/5 — GORGEOUS, HUNGRY | #f0477d | The place that replaced the diner | The room is stunning, the playlist is a moodboard, and the “heritage tomato moment” is one tomato. Our server was the best actor in the valley: she said “great choice” about a $19 plate of air with total conviction. We left elegant and starving, then bought gas-station taquitos. Verdict: it photographs like a meal.",
          "DINER · RUTLAND · $ | 5/5 — PROTECT AT ALL COSTS | #12b795 | The 24-hour survivor on Hwy 33 | Coffee refills arrive before you ask, the hashbrowns have structural integrity, and the night cook remembers your order and your pronouns. Every collapse in this issue is survivable from booth six. Bring cash, tip like rent is due, because theirs is too."
        ],
        rulesTag: `HOUSE RULES`,
        rules: `we pay full price · we book under fake names · patios judged by dog traffic · anywhere that feeds evacuation crews gets a permanent star`,
        kicker: `REVIEWS / FIELD-TESTED`,
        cards: [
          `DRAG NIGHT · POP-UP | RIPS | #12b795 | “Harvest Moon” at the community hall | A gymnasium, a rented fog machine, and the best crowd this valley has produced. The floor is lava and the lava is love. Next one: see calendar.`,
          `BAKERY · DOWNTOWN | 4/5 | #fe9a0d | The new sourdough place on Ellis | The loaf is honest, the queue is chatty, and the owner slips day-olds to anyone who compliments the playlist. Crumb declined to comment, citing family.`,
          `CIVIC · ONGOING | 0/5 | #f0477d | Council public-hearing livestream | Buffering as dramaturgy. Runtime: eternal. One star added for the councillor who said “housing is for people” out loud; four removed for the vote after.`
        ],
        rotTitle: `Rotation`,
        rotLabel: `STAFF ROTATION / №1`,
        rotTag: `LOUD`,
        tracks: [
          `“Bench Water” — local EP | the connector, at night`,
          `ballroom sets — Paris Is Burning warm-ups | pre-screening homework`,
          `snotty coast punk — 7″ from a Rutland garage | paste-up fuel`,
          `a syilx songwriter’s live tape | ask at the record stall`,
          `disco edits for the beach assembly | aug 15, bring speakers`,
          `the diner jukebox, booth six | field recording, honestly`,
          `whatever the night cook hums | unreleased. protected.`
        ],
        qrNote: `FULL PLAYLIST QR — UPDATED PER ISSUE`,
        qrSub: `SEND US ONE SONG + ONE SENTENCE`,
      },
    },
    /* 37 · P37 · 35 */
    {
      template: 'Review',
      variant: 'playlist',
      chrome: { footer: `mono`, accent: `#f0477d`, headLeft: `16 · LISTENING`, headRight: `LOUD IN THE PASTE-UP ROOM`, docNo: `DB-035-A`, folio: `35` },
      content: {
        scribble: `none`,
        blurb: `none`,
        stamp: `none`,
        brand: `Ask a Local Gay`,
        brandSub: `CERTIFIED · SINCE TUESDAY`,
        advice: [
          `My parents keep introducing me as their “roommate’s friend.” The roommate is my wife. Escalate or let it ride? — TIRED IN LAKE COUNTRY | Send them a fridge magnet of your wedding photo every month. No note. Bureaucracy respects witnesses and parents respect fridges. By magnet six you’ll be “the girls.” By ten, they’re paying for brunch.`,
          `Is it a red flag if a date says Kelowna has “no culture”? — DEFENSIVE DOWNTOWN | It’s a beige flag. Hand them this magazine, the calendar page, and a pen. If they come to one thing on the calendar, marry them. If they critique the font, you’ve met the editor — run.`
        ],
        features: [
          "WINE BAR · LAKESHORE · $$$$ | 2/5 — GORGEOUS, HUNGRY | #f0477d | The place that replaced the diner | The room is stunning, the playlist is a moodboard, and the “heritage tomato moment” is one tomato. Our server was the best actor in the valley: she said “great choice” about a $19 plate of air with total conviction. We left elegant and starving, then bought gas-station taquitos. Verdict: it photographs like a meal.",
          "DINER · RUTLAND · $ | 5/5 — PROTECT AT ALL COSTS | #12b795 | The 24-hour survivor on Hwy 33 | Coffee refills arrive before you ask, the hashbrowns have structural integrity, and the night cook remembers your order and your pronouns. Every collapse in this issue is survivable from booth six. Bring cash, tip like rent is due, because theirs is too."
        ],
        rulesTag: `HOUSE RULES`,
        rules: `we pay full price · we book under fake names · patios judged by dog traffic · anywhere that feeds evacuation crews gets a permanent star`,
        kicker: `16 · WHAT WE’RE LISTENING TO`,
        cards: [
          `DRAG NIGHT · POP-UP | RIPS | #12b795 | “Harvest Moon” at the community hall | A gymnasium, a rented fog machine, and the best crowd this valley has produced. The floor is lava and the lava is love. Next one: see calendar.`,
          `BAKERY · DOWNTOWN | 4/5 | #fe9a0d | The new sourdough place on Ellis | The loaf is honest, the queue is chatty, and the owner slips day-olds to anyone who compliments the playlist. Crumb declined to comment, citing family.`,
          `CIVIC · ONGOING | 0/5 | #f0477d | Council public-hearing livestream | Buffering as dramaturgy. Runtime: eternal. One star added for the councillor who said “housing is for people” out loud; four removed for the vote after.`
        ],
        rotTitle: `Rotation`,
        rotLabel: `STAFF ROTATION / №1`,
        rotTag: `LOUD`,
        tracks: [
          `“Bench Water” — local EP | the connector, at night`,
          `ballroom sets — Paris Is Burning warm-ups | pre-screening homework`,
          `snotty coast punk — 7″ from a Rutland garage | paste-up fuel`,
          `a syilx songwriter’s live tape | ask at the record stall`,
          `disco edits for the beach assembly | aug 15, bring speakers`,
          `the diner jukebox, booth six | field recording, honestly`,
          `whatever the night cook hums | unreleased. protected.`
        ],
        qrNote: `FULL PLAYLIST QR — UPDATED PER ISSUE`,
        qrSub: `SEND US ONE SONG + ONE SENTENCE`,
      },
    },
    /* 38 · P38 · 36 */
    {
      template: 'Listings',
      variant: 'program',
      chrome: { footer: `duo`, accent: `#f0477d`, headLeft: `17 · FILM`, headRight: `CLASSICS, OUTDOORS`, docNo: `DB-036-A`, folio: `36` },
      content: {
        scribble: `none`,
        rows: ``,
        title: `The Calendar`,
        boxLabel: `№1 PROGRAM / NOTES`,
        boxTag: `35MM ENERGY, DIGITAL BUDGET`,
        footNote: `LISTINGS ARE FREE · EMAIL BY THE 15TH · SOBER + ALL-AGES OPTIONS MARKED ◦`,
        dirKicker: `KEEP THIS PAGE / DIRECTORY`,
        brand: `The Rewind`,
        brandSub: `CRITERION-SHELF DEEP CUTS`,
        intro: `Old films, screened like they matter — because a town with no rep cinema deserves one anyway. Each issue: three from the queer canon, then we show them outside. Program notes below; lawn chairs next page.`,
        notes: [
          `Paris Is Burning (1990) | The ballroom documentary that gave the culture its vocabulary. Watch it with people; the applause is part of the text.`,
          `My Own Private Idaho (1991) | River Phoenix falls asleep on every road in the Northwest. The campfire scene alone is worth the mosquitoes.`,
          `The Watermelon Woman (1996) | Cheryl Dunye invents an archive because nobody kept one for her. Relevant to a magazine doing the same thing.`
        ],
        kicker: `MOVIES IN THE PARK / HOSTED BY DAILY BREAD`,
        schedLabel: `SUMMER SLATE / AT DUSK`,
        schedTag: `RAIN MOVES US TO THE LAB`,
        schedFoot: `FREE / PWYC · CAPTIONS ON · POWER: RECLAIMED CELLS, PROJECT HEX`,
        bringTag: `BRING`,
        bring: `a blanket · bug spray · someone you’re nervous around · a thermos (we sell none of these on purpose)`,
        voteTitle: `VOTE — №2 THEME`,
        votes: [
          `THE THAW (what comes back)`,
          `WATER RIGHTS & WRONGS`,
          `NIGHT SHIFT (who runs 2AM Kelowna)`
        ],
        voteNote: `MARK ONE · PHOTOGRAPH · SEND. DEMOCRACY.`,
        qrNote: `TIP JAR + SUBMISSIONS QR`,
        qrSub: `REPLACE WITH REAL CODE AT PASTE-UP`,
      },
    },
    /* 39 · P39 · 37 */
    {
      template: 'Listings',
      variant: 'screenings',
      chrome: { footer: `duo`, accent: `#f0477d`, headLeft: `17 · FILM`, headRight: `DUSK SCREENINGS · FREE / PWYC`, docNo: `DB-037-A`, folio: `37` },
      content: {
        scribble: `none`,
        rows: [
          `AUG 14 | Paris Is Burning (1990) | City Park, at dusk`,
          `SEP 04 | My Own Private Idaho (1991) | Ben Lee Park, at dusk`,
          `SEP 25 | The Watermelon Woman (1996) | Rutland Centennial Park, at dusk`
        ],
        title: `The Calendar`,
        boxLabel: `AUG — OCT 2026`,
        boxTag: `CLIP + FRIDGE`,
        footNote: `LICENSING PAID PER SCREENING · DATES ALSO ON THE CALENDAR`,
        dirKicker: `KEEP THIS PAGE / DIRECTORY`,
        brand: `Crumbs Mail`,
        brandSub: `READER CORRESPONDENCE · №0 EDITION`,
        intro: `This box is empty because you haven’t written yet. First issue problems. Fill it with fury, recipes, corrections, crushes (anonymized), and photos of the colouring page done wrong on purpose.`,
        notes: [
          `Paris Is Burning (1990) | The ballroom documentary that gave the culture its vocabulary. Watch it with people; the applause is part of the text.`,
          `My Own Private Idaho (1991) | River Phoenix falls asleep on every road in the Northwest. The campfire scene alone is worth the mosquitoes.`,
          `The Watermelon Woman (1996) | Cheryl Dunye invents an archive because nobody kept one for her. Relevant to a magazine doing the same thing.`
        ],
        kicker: `MOVIES IN THE PARK / HOSTED BY DAILY BREAD`,
        schedLabel: `SUMMER SLATE / AT DUSK`,
        schedTag: `RAIN MOVES US TO THE LAB`,
        schedFoot: `FREE / PWYC · CAPTIONS ON · POWER: RECLAIMED CELLS, PROJECT HEX`,
        bringTag: `BRING`,
        bring: `a blanket · bug spray · someone you’re nervous around · a thermos (we sell none of these on purpose)`,
        voteTitle: `VOTE — OCTOBER SCREENING`,
        votes: [
          `Portrait of a Lady on Fire (2019)`,
          `Hedwig and the Angry Inch (2001)`,
          `Bound (1996)`
        ],
        voteNote: `MARK ONE · PHOTOGRAPH · SEND. DEMOCRACY.`,
        qrNote: `TIP JAR + SUBMISSIONS QR`,
        qrSub: `REPLACE WITH REAL CODE AT PASTE-UP`,
      },
    },
    /* 40 · P40 · 38 */
    {
      template: 'Listings',
      variant: 'calendar',
      chrome: { footer: `mono`, accent: `#f0477d`, headLeft: `14 · CALENDAR`, headRight: `AUG–OCT 2026`, docNo: `DB-038-A`, folio: `38` },
      content: {
        scribble: `none`,
        rows: [
          `AUG 07 | First Friday at the Lab ◦ | Riposte shop floor — tours, benches, zines`,
          `AUG 14 | Movies in the Park №1 ◦ | City Park — Paris Is Burning`,
          `AUG 15 | Queer Beach Assembly ◦ | Gyro Beach, north end — bring shade to share`,
          `AUG 22 | Harvest Moon drag night | community hall — PWYC at the door`,
          `SEP 05 | Zine-making + submission clinic ◦ | library makerspace — bring your fury`,
          `SEP 15 | №2 SUBMISSION DEADLINE | art, opinion, poems — see contents page`,
          `SEP 19 | Orchard walk with an elder ◦ | East Kelowna benches — history underfoot`,
          `OCT 03 | Cassette night: the Shoebox Fonds | venue TBA — Miss Demeanour presiding`,
          `OCT 17 | Issue №2 launch + colouring contest | location in №2. obviously`
        ],
        title: `The Calendar`,
        boxLabel: `AUG — OCT 2026`,
        boxTag: `CLIP + FRIDGE`,
        footNote: `LISTINGS ARE FREE · EMAIL BY THE 15TH · SOBER + ALL-AGES OPTIONS MARKED ◦`,
        dirKicker: `KEEP THIS PAGE / DIRECTORY`,
        brand: `Crumbs Mail`,
        brandSub: `READER CORRESPONDENCE · №0 EDITION`,
        intro: `This box is empty because you haven’t written yet. First issue problems. Fill it with fury, recipes, corrections, crushes (anonymized), and photos of the colouring page done wrong on purpose.`,
        notes: [
          `Paris Is Burning (1990) | The ballroom documentary that gave the culture its vocabulary. Watch it with people; the applause is part of the text.`,
          `My Own Private Idaho (1991) | River Phoenix falls asleep on every road in the Northwest. The campfire scene alone is worth the mosquitoes.`,
          `The Watermelon Woman (1996) | Cheryl Dunye invents an archive because nobody kept one for her. Relevant to a magazine doing the same thing.`
        ],
        kicker: `MOVIES IN THE PARK / HOSTED BY DAILY BREAD`,
        schedLabel: `SUMMER SLATE / AT DUSK`,
        schedTag: `RAIN MOVES US TO THE LAB`,
        schedFoot: `FREE / PWYC · CAPTIONS ON · POWER: RECLAIMED CELLS, PROJECT HEX`,
        bringTag: `BRING`,
        bring: `a blanket · bug spray · someone you’re nervous around · a thermos (we sell none of these on purpose)`,
        voteTitle: `VOTE — №2 THEME`,
        votes: [
          `THE THAW (what comes back)`,
          `WATER RIGHTS & WRONGS`,
          `NIGHT SHIFT (who runs 2AM Kelowna)`
        ],
        voteNote: `MARK ONE · PHOTOGRAPH · SEND. DEMOCRACY.`,
        qrNote: `TIP JAR + SUBMISSIONS QR`,
        qrSub: `REPLACE WITH REAL CODE AT PASTE-UP`,
      },
    },
    /* 41 · P41 · 39 */
    {
      template: 'Listings',
      variant: 'directory',
      chrome: { footer: `mono`, accent: `#f0477d`, headLeft: `18 · MUTUAL AID`, headRight: `KEEP THIS PAGE`, docNo: `DB-039-A`, folio: `39` },
      content: {
        scribble: `none`,
        rows: [
          `Crisis line (24/7, trans-competent) | placeholder — verify before print`,
          `Informed-consent clinic list | updated quarterly · this page`,
          `Youth drop-in (14–24) ◦ | wed + sat · downtown`,
          `Mutual aid pantry | rutland · no questions`,
          `Legal aid — tenant defence | first mondays · library`,
          `Elder queer social (55+) ◦ | thursdays · lakeshore`,
          `Sober hangs ◦ | see calendar, marked ◦`
        ],
        title: `The Calendar`,
        boxLabel: `VERIFIED QUARTERLY · TEAR OUT OK`,
        boxTag: `CLIP + FRIDGE`,
        footNote: `A RESOURCE MISSING? WRONG NUMBER? TELL US — THIS PAGE IS THE WHOLE POINT.`,
        dirKicker: `KEEP THIS PAGE / DIRECTORY`,
        brand: `Crumbs Mail`,
        brandSub: `READER CORRESPONDENCE · №0 EDITION`,
        intro: `This box is empty because you haven’t written yet. First issue problems. Fill it with fury, recipes, corrections, crushes (anonymized), and photos of the colouring page done wrong on purpose.`,
        notes: [
          `Paris Is Burning (1990) | The ballroom documentary that gave the culture its vocabulary. Watch it with people; the applause is part of the text.`,
          `My Own Private Idaho (1991) | River Phoenix falls asleep on every road in the Northwest. The campfire scene alone is worth the mosquitoes.`,
          `The Watermelon Woman (1996) | Cheryl Dunye invents an archive because nobody kept one for her. Relevant to a magazine doing the same thing.`
        ],
        kicker: `MOVIES IN THE PARK / HOSTED BY DAILY BREAD`,
        schedLabel: `SUMMER SLATE / AT DUSK`,
        schedTag: `RAIN MOVES US TO THE LAB`,
        schedFoot: `FREE / PWYC · CAPTIONS ON · POWER: RECLAIMED CELLS, PROJECT HEX`,
        bringTag: `BRING`,
        bring: `a blanket · bug spray · someone you’re nervous around · a thermos (we sell none of these on purpose)`,
        voteTitle: `VOTE — №2 THEME`,
        votes: [
          `THE THAW (what comes back)`,
          `WATER RIGHTS & WRONGS`,
          `NIGHT SHIFT (who runs 2AM Kelowna)`
        ],
        voteNote: `MARK ONE · PHOTOGRAPH · SEND. DEMOCRACY.`,
        qrNote: `TIP JAR + SUBMISSIONS QR`,
        qrSub: `REPLACE WITH REAL CODE AT PASTE-UP`,
      },
    },
    /* 42 · P42 · 40 */
    {
      template: 'Body',
      variant: 'checklist',
      slug: 'v2-p40',
      chrome: { footer: `mono`, accent: `#f0477d`, headLeft: `18 · SERVICE`, headRight: `FIRE SEASON — CLIP + FRIDGE`, docNo: `DB-040-A`, folio: `40` },
      content: {
        scribble: `none`,
        scribble2: `none`,
        stamp: `none`,
        placeholder: `archival photo — orchard crews, 1910s`,
        imgH: `250px`,
        kicker: ``,
        caption: `FIG. 2 — PICKING CREWS, RUTLAND BENCHES. THE APPLES WERE A PYRAMID SCHEME WITH ROOTS.`,
        body: [
          `The valley sold itself twice: first as Eden, then as equity. Fruit ranchers went broke so often the packinghouses printed their own scrip; when fruit died, the pitch became retirement sun; when the retirees priced out the pickers, the pitch became lakeside lofts.`,
          `Each act ended the same way — with the people who did the work living further from the water. The queer history is braided through all of it: dance halls with unofficial nights, friendship networks that doubled as housing lists, a scene that survived by being useful and quiet until it didn’t have to be.`
        ],
        body2: `Two evacuations in five years says keep it packed, not planned. Know your route out, your meeting spot, and one person out of town who takes the check-in calls. The writer on page 13 shouldn't know this list better than city council does.`,
        proseLabel: ``,
        quotes: [
          `“My GP is great. My GP is also in Vancouver, where I don’t live.”`,
          `“The pharmacist figured it out before any doctor did. Shout out Deb.”`,
          `“I got my referral the same month my lease ended. Guess which one moved faster.”`,
          `“Honestly? The group chat is the healthcare system.”`
        ],
        note: `FOUR OF ELEVEN INTERVIEWS · ALL ANONYMIZED · METHODOLOGY: SEE DIRECTORY`,
        colA: `ENTRY`,
        colB: `STATUS`,
        table: [
          `1913 | fruit prices crater; scrip economy begins | BUST | #f0477d`,
          `1930s | packinghouse layoffs, valley-wide | BUST | #f0477d`,
          `1958 | bridge opens; ferry workers obsolete overnight | PIVOT | #fe9a0d`,
          `1973 | ALR freezes orchard speculation (briefly) | PARRY | #12b795`,
          `1980s | sawmill era ends; wine era begins | PIVOT | #fe9a0d`,
          `2003 | firestorm; 239 homes, 30k evacuated | BURN | #f0477d`,
          `2017 | flood year — the lake takes the boardwalk | FLOOD | #f0477d`,
          `2021 | heat dome; hottest place in Canada, again | BURN | #f0477d`,
          `2024 | last dedicated queer venue closes | BUST | #f0477d`,
          `2026 | this magazine. your move, city. | RIPOSTE | #12b795`
        ],
        noteTag: `METHOD`,
        note2: `compiled from city archives, newspaper morgues, and elders who were there. Corrections welcome and expected: see Crumbs Mail.`,
        checkTitle: `THE GO-BAG / FIRE SEASON CHECKLIST`,
        checklist: [
          `Water — 4L per person, rotate it`,
          `Meds + a photographed prescription list`,
          `Documents in a freezer bag (ID, insurance, lease — ha)`,
          `Chargers, battery bank, cash in small bills`,
          `N95s from the smoke drawer. You have a smoke drawer`,
          `The pets. Count them twice. Then the neighbour's`,
          `This magazine — morale is supplies`
        ],
      },
    },
    /* 43 · P43 · 41 */
    {
      template: 'Listings',
      variant: 'mail',
      chrome: { footer: `mono`, accent: `#f0477d`, headLeft: `19 · CORRESPONDENCE`, headRight: `WRITE TO US`, docNo: `DB-041-A`, folio: `41` },
      content: {
        scribble: `none`,
        rows: ``,
        title: `The Calendar`,
        boxLabel: `AUG — OCT 2026`,
        boxTag: `CLIP + FRIDGE`,
        footNote: `LISTINGS ARE FREE · EMAIL BY THE 15TH · SOBER + ALL-AGES OPTIONS MARKED ◦`,
        dirKicker: `KEEP THIS PAGE / DIRECTORY`,
        brand: `Crumbs Mail`,
        brandSub: `READER CORRESPONDENCE · №0 EDITION`,
        intro: `This box is empty because you haven’t written yet. First issue problems. Fill it with fury, recipes, corrections, crushes (anonymized), and photos of the colouring page done wrong on purpose.`,
        notes: [
          `Paris Is Burning (1990) | The ballroom documentary that gave the culture its vocabulary. Watch it with people; the applause is part of the text.`,
          `My Own Private Idaho (1991) | River Phoenix falls asleep on every road in the Northwest. The campfire scene alone is worth the mosquitoes.`,
          `The Watermelon Woman (1996) | Cheryl Dunye invents an archive because nobody kept one for her. Relevant to a magazine doing the same thing.`
        ],
        kicker: `MOVIES IN THE PARK / HOSTED BY DAILY BREAD`,
        schedLabel: `SUMMER SLATE / AT DUSK`,
        schedTag: `RAIN MOVES US TO THE LAB`,
        schedFoot: `FREE / PWYC · CAPTIONS ON · POWER: RECLAIMED CELLS, PROJECT HEX`,
        bringTag: `BRING`,
        bring: `a blanket · bug spray · someone you’re nervous around · a thermos (we sell none of these on purpose)`,
        voteTitle: `VOTE — №2 THEME`,
        votes: [
          `THE THAW (what comes back)`,
          `WATER RIGHTS & WRONGS`,
          `NIGHT SHIFT (who runs 2AM Kelowna)`
        ],
        voteNote: `MARK ONE · PHOTOGRAPH · SEND. DEMOCRACY.`,
        qrNote: `TIP JAR + SUBMISSIONS QR`,
        qrSub: `REPLACE WITH REAL CODE AT PASTE-UP`,
      },
    },
    /* 44 · P44 · 42 */
    {
      template: 'Comic',
      variant: 'page',
      chrome: { headLeft: `04 · COMIC, CONT.`, headRight: `“CRUMBS” EP.1 — END`, docNo: `DB-042-A`, folio: `42`, footer: `mono` },
      content: {
        title: `none`,
        endText: `none`,
        scribble: `none`,
        sub: `A SOURDOUGH GOLEM SEEKS HOUSING. EP.1`,
        panels: [
          `PANEL 10 — Crumb hosts a “tenants’ potluck” inside the vacant storefront. everyone brings bread. suspiciously communal`,
          `PANEL 11 — bylaw officer arrives. Crumb offers focaccia. officer visibly conflicted`,
          `PANEL 12 — “technically… a bakery is a permitted use.” paperwork montage. flour everywhere`,
          `PANEL 13 — the storefront glows at night: BREAD + BOOKS + BAD KARAOKE. line around the block, again — but happy`,
          `PANEL 14 — landlord returns: “rent’s tripling.” Crumb: “cool. we’re a co-op now. talk to our lawyer.”`,
          `PANEL 15 — final: the lawyer is the ogopogo in the trench coat. END OF EP.1`
        ],
        endNote: `no spoilers but the loaf unionizes`,
        credit: `“CRUMBS” RETURNS IN №2 · THE LOAF HAS A LAWYER NOW`,
        guestTag: `GUEST STRIP / ROTATING SLOT`,
        guestText: `FULL-PAGE GUEST COMIC — a different local cartoonist every issue. №1 guest: [NAME], “Parallel Parking as Queer Praxis”`,
      },
    },
    /* 45 · P45 · 43 */
    {
      template: 'Comic',
      variant: 'guest',
      chrome: { headLeft: `04 · COMIC`, headRight: `“CRUMBS” — EP.1 OF ∞`, docNo: `DB-043-A`, folio: `43`, footer: `mono` },
      content: {
        title: `Crumbs`,
        endText: `none`,
        scribble: `none`,
        sub: `A SOURDOUGH GOLEM SEEKS HOUSING. EP.1`,
        panels: [
          `PANEL 1 — a sourdough starter in a jar watches an eviction notice slide under the door`,
          `PANEL 2 — the starter OVERFLOWS. it has decided to become a person about this`,
          `PANEL 3 — CRUMB (our golem, 4ft, crusty, kind eyes) reads the rental listings. horror`,
          "PANEL 4 — “$2,100. shared oven. no pets, no yeast.” Crumb: “I AM pets and yeast.”"
        ],
        endNote: `no spoilers but the loaf unionizes`,
        credit: `STORY + ART: [CARTOONIST NAME] · DRAWN PAGES REPLACE THESE PANEL STUBS AT PASTE-UP`,
        guestTag: `GUEST STRIP / ROTATING SLOT`,
        guestText: `FULL-PAGE GUEST COMIC — a different local cartoonist every issue. №1 guest: [NAME], “Parallel Parking as Queer Praxis”`,
      },
    },
    /* 46 · P46 · 44 */
    {
      template: 'Colophon',
      variant: 'staff',
      slug: 'v2-p44',
      chrome: { headLeft: `20 · COLOPHON`, headRight: `SEE YOU IN №2`, docNo: `DB-044-A`, folio: `44` },
      content: {
        brand: `Who Made This`,
        placeholder: `staff photo — everyone assembled, gremlin energy, timer on a ladder`,
        caption: `FIG. 9 — THE ENTIRE OPERATION. YES, THE DOG IS ON THE MASTHEAD.`,
        creditsLabel: `ATTRIBUTIONS / EVERY HAND`,
        credits: [
          `EDITOR | your name here`,
          `YOUNG VOICES | three writers`,
          `PHOTOGRAPHY | “Vacancy” — [photographer]`,
          `COMICS | “Crumbs” — [cartoonist] · guest: [name]`,
          `THE WALL | [featured artist], two pieces, №1`,
          `SATIRE CARTOON | [illustrator], with apologies to council`,
          `PROOFREADING | the patient one`,
          `FUNDING | Riposte Laboratories Inc.`,
          `PRINTER | [local print shop], 500 copies`
        ],
        colophon: `Printed on unceded syilx Okanagan territory in a run of 500. Set in IBM Plex Mono and UnifrakturMaguntia. Errors are ours; corrections are yours; the leftover ink went into the stickers.`,
        slogan: `PARRY. RIPOSTE.`,
        adText: `This space is the inside back cover. In №2 it’s for sale to any local business that has never evicted anyone. Rates on request.`,
        sig: `see you at the thaw ✕`,
      },
    },
    /* 47 · P47 · IBC */
    {
      template: 'Colophon',
      variant: 'ad',
      slug: 'colophon',
      chrome: { headLeft: `20 · COLOPHON`, headRight: `SEE YOU IN №2`, docNo: `DB-042-A`, folio: `IBC` },
      content: {
        brand: `Who Made This`,
        placeholder: `staff photo — everyone assembled, gremlin energy, timer on a ladder`,
        caption: `FIG. 9 — THE ENTIRE OPERATION. YES, THE DOG IS ON THE MASTHEAD.`,
        creditsLabel: `ATTRIBUTIONS / EVERY HAND`,
        credits: [
          `EDITOR | your name here`,
          `YOUNG VOICES | three writers`,
          `PHOTOGRAPHY | “Vacancy” — [photographer]`,
          `COMICS | “Crumbs” — [cartoonist] · guest: [name]`,
          `THE WALL | [featured artist], two pieces, №1`,
          `SATIRE CARTOON | [illustrator], with apologies to council`,
          `PROOFREADING | the patient one`,
          `FUNDING | Riposte Laboratories Inc.`,
          `PRINTER | [local print shop], 500 copies`
        ],
        colophon: `Printed on unceded syilx Okanagan territory in a run of 500. Set in IBM Plex Mono and UnifrakturMaguntia. Errors are ours; corrections are yours; the leftover ink went into the stickers.`,
        slogan: `PARRY. RIPOSTE.`,
        adText: `This space is the inside back cover. In №2 it’s for sale to any local business that has never evicted anyone. Rates on request.`,
        sig: `see you at the thaw ✕`,
      },
    },
    /* 48 · P48 · BC */
    {
      template: 'Cover',
      variant: 'back',
      slug: 'cover',
      content: {
        art: ``,
        issueTag: `№1 — KELOWNA’S COLLAPSE`,
        price: `PAY WHAT YOU CAN`,
        publisher: `RIPOSTE LABORATORIES`,
        publisherLong: `RIPOSTE LABORATORIES INC.`,
        tagline: `Daily Bread is baked quarterly in Kelowna, BC. Free where you found it. Pay what you can where you can’t.`,
        issn: `ISSN PENDING`,
        edition: `№1 · SUMMER 2026`,
      },
    },
  ],
};
