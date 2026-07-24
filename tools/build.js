/* ============================================================================
   Daily Bread · multilingual static-site generator
   ----------------------------------------------------------------------------
   Emits the magazine home page in 15 languages (English + the 12 the Government
   of BC officially supports, plus Italian and Polish), matching the language set
   and chrome of the sibling ripostelabs.xyz site.

   Source of truth:
     tools/strings/en.js         English strings (one key = one unit)
     tools/strings/<lang>.json   translations (same keys; missing -> English)
     tools/assets/style.css      the page stylesheet (inlined into <head>)
     assets/                      cover.jpg + riposte-logo.svg (served from /assets)

   URL scheme: English at root ("/"), every other language under "/<lang>/".
   Run:  node tools/build.js            (build all languages)
         node tools/build.js fr         (build one language)
         node tools/build.js --clean    (remove generated language dirs first)
   ============================================================================ */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const STYLE = fs.readFileSync(path.join(__dirname, 'assets', 'style.css'), 'utf8');

/* ---- languages (code = dir name; hreflang = BCP-47; dir = ltr|rtl) ---- */
const LANGS = [
  {code:'en',      hreflang:'en',      endo:'English',      en:'English',              dir:'ltr'},
  {code:'fr',      hreflang:'fr',      endo:'Français',     en:'French',               dir:'ltr'},
  {code:'es',      hreflang:'es',      endo:'Español',      en:'Spanish',              dir:'ltr'},
  {code:'it',      hreflang:'it',      endo:'Italiano',     en:'Italian',              dir:'ltr'},
  {code:'pl',      hreflang:'pl',      endo:'Polski',       en:'Polish',               dir:'ltr'},
  {code:'la',      hreflang:'la',      endo:'Latina',       en:'Latin',                dir:'ltr'},
  {code:'zh-hans', hreflang:'zh-Hans', endo:'简体中文',      en:'Chinese (Simplified)', dir:'ltr'},
  {code:'zh-hant', hreflang:'zh-Hant', endo:'繁體中文',      en:'Chinese (Traditional)', dir:'ltr'},
  {code:'pa',      hreflang:'pa',      endo:'ਪੰਜਾਬੀ',        en:'Punjabi',              dir:'ltr'},
  {code:'ko',      hreflang:'ko',      endo:'한국어',        en:'Korean',               dir:'ltr'},
  {code:'ja',      hreflang:'ja',      endo:'日本語',        en:'Japanese',             dir:'ltr'},
  {code:'tl',      hreflang:'tl',      endo:'Tagalog',      en:'Tagalog',              dir:'ltr'},
  {code:'vi',      hreflang:'vi',      endo:'Tiếng Việt',   en:'Vietnamese',           dir:'ltr'},
  {code:'hi',      hreflang:'hi',      endo:'हिन्दी',         en:'Hindi',                dir:'ltr'},
  {code:'ar',      hreflang:'ar',      endo:'العربية',       en:'Arabic',               dir:'rtl'},
  {code:'fa',      hreflang:'fa',      endo:'فارسی',         en:'Farsi',                dir:'rtl'},
];

const ORIGIN = 'https://dailybre.ad';

/* ---- string loading (translation falls back to English per key) ---- */
const EN = require('./strings/en.js');
function loadStrings(code){
  if(code === 'en') return EN;
  const p = path.join(__dirname, 'strings', code + '.json');
  let tr = {};
  if(fs.existsSync(p)){
    try{ tr = JSON.parse(fs.readFileSync(p,'utf8')); }
    catch(e){ console.warn('bad JSON for', code, e.message); }
  } else {
    console.warn('no translation file for', code, '(using English)');
  }
  return Object.assign({}, EN, tr);
}

/* ---- structural data (non-translatable: page numbers, dates, colours) ---- */
const TOC = ['#1d1a17','#f0477d','#fe9a0d','#12b795','#1d1a17','#f0477d','#fe9a0d','#12b795','#1d1a17','#f0477d','#fe9a0d','#12b795','#1d1a17','#f0477d','#fe9a0d','#f0477d','#12b795','#12b795','#1d1a17']
  .map((c,i)=>({c, pg:['01','04','08','11','14','16','19','20','23','24','25','28','30','32','36','37','38','40','44'][i]}));
const LEDGER = [['1913','#f0477d'],['1930s','#f0477d'],['1958','#fe9a0d'],['1973','#12b795'],['1980s','#fe9a0d'],['2003','#f0477d'],['2017','#f0477d'],['2021','#f0477d'],['2024','#f0477d'],['2026','#12b795']]
  .map(([y,sc])=>({y,sc}));
const EVENTS = [['Aug 07','#12b795'],['Aug 14','#fe9a0d'],['Aug 15','#f0477d'],['Aug 22','#fe9a0d'],['Sep 05','#12b795'],['Sep 15','#f0477d'],['Sep 19','#fe9a0d'],['Oct 03','#f0477d'],['Oct 17','#12b795']]
  .map(([d,c])=>({d,c}));
const SCREENINGS = [['Aug 14','#f0477d'],['Sep 04','#fe9a0d'],['Sep 25','#12b795']].map(([d,c])=>({d,c}));
const LABBOARD = ['#12b795','#fe9a0d','#f0477d','#1d1a17','#12b795'].map(c=>({c}));

const esc = s => String(s).replace(/[&<>]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

/* ---- server-rendered list blocks (byte-identical to the old inline JS) ---- */
function tocRows(t){
  return TOC.map((r,i)=>`<div class="li"><span class="pgchip" style="background:${r.c}">${r.pg}</span><span class="t">${esc(t['toc.'+i+'.t'])}</span><span class="end tagend">${esc(t['toc.'+i+'.k'])}</span></div>`).join('');
}
function ledgerRows(t){
  return LEDGER.map((l,i)=>`<div class="li"><span class="pgchip" style="background:var(--ink);min-width:52px">${l.y}</span><span class="t">${esc(t['ledger.'+i+'.e'])}</span><span class="end"><span class="statuschip" style="background:${l.sc}">${esc(t['ledger.'+i+'.s'])}</span></span></div>`).join('');
}
function eventRows(t){
  return EVENTS.map((e,i)=>`<div class="li"><span class="pgchip" style="background:${e.c};min-width:60px">${e.d}</span><span class="t"><b>${esc(t['events.'+i+'.t'])}</b><br><span class="tagend" style="text-transform:none;letter-spacing:.02em;font-size:12px">${esc(t['events.'+i+'.w'])}</span></span></div>`).join('');
}
function screeningRows(t){
  return SCREENINGS.map((s,i)=>`<div class="li"><span class="pgchip" style="background:${s.c};min-width:60px">${s.d}</span><span class="t"><b>${esc(t['screenings.'+i+'.f'])}</b><br><span class="tagend" style="text-transform:none;letter-spacing:.02em;font-size:12px">${esc(t['screenings.'+i+'.p'])}</span></span></div>`).join('')
    + `<div class="li"><span class="fine">${esc(t['calendar.scFine'])}</span></div>`;
}
function dirRows(t){
  return [0,1,2,3,4,5,6].map(i=>`<div class="li"><span class="t" style="font-weight:700">${esc(t['dir.'+i+'.t'])}</span><span class="end tagend" style="text-transform:none;letter-spacing:.02em">${esc(t['dir.'+i+'.w'])}</span></div>`).join('');
}
function labRows(t){
  return LABBOARD.map((j,i)=>`<div class="li"><span class="t">${esc(t['lab.'+i+'.t'])}</span><span class="end"><span class="statuschip" style="background:${j.c}">${esc(t['lab.'+i+'.s'])}</span></span></div>`).join('');
}

/* ---- shared chrome ---- */
function url(code){ return code === 'en' ? '/' : '/' + code + '/'; }
function langpick(t, code){
  const cur = LANGS.find(l=>l.code===code);
  const items = LANGS.map(l=>{
    const c = l.code===code ? ' aria-current="true"' : '';
    return `<a href="${url(l.code)}" hreflang="${l.hreflang}" lang="${l.hreflang}"${l.dir==='rtl'?' dir="rtl"':''}${c}><span class="endo">${l.endo}</span><span class="en">${l.en}</span></a>`;
  }).join('');
  return `<details class="langpick"><summary aria-label="${esc(t['chrome.language'])}"><span class="globe" aria-hidden="true">\u{1F310}</span> ${cur.endo} <span class="car" aria-hidden="true">▾</span></summary><div class="langmenu">${items}</div></details>`;
}
function hreflangs(){
  const links = LANGS.map(l=>`<link rel="alternate" hreflang="${l.hreflang}" href="${ORIGIN}${url(l.code)}">`);
  links.push(`<link rel="alternate" hreflang="x-default" href="${ORIGIN}${url('en')}">`);
  return links.join('\n');
}
function mtnote(t, code){
  return code==='en' ? '' : `<div class="mtnote">${t['chrome.mtnote']}</div>`;
}

/* ============================================================================
   page
   ============================================================================ */
function page(code){
  const t = loadStrings(code);
  const L = LANGS.find(l=>l.code===code);
  const rtl = L.dir === 'rtl';
  return `<!DOCTYPE html>
<html lang="${L.hreflang}"${rtl?' dir="rtl"':''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t['meta.title'])}</title>
<meta name="description" content="${esc(t['meta.desc'])}">
<meta property="og:title" content="${esc(t['meta.ogTitle'])}">
<meta property="og:description" content="${esc(t['meta.ogDesc'])}">
<meta property="og:image" content="/assets/cover.jpg">
<meta property="og:type" content="website">
<link rel="canonical" href="${ORIGIN}${url(code)}">
${hreflangs()}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=UnifrakturMaguntia&display=swap" rel="stylesheet">
<style>
${STYLE}
</style>
</head>
<body>

<!-- ============ TOP BAR ============ -->
<header class="top">
  <div class="wrap bar">
    <span class="brand">Daily&nbsp;Bread</span>
    <nav>
      <a href="#letter">${esc(t['nav.letter'])}</a>
      <a href="#contents">${esc(t['nav.contents'])}</a>
      <a href="#history">${esc(t['nav.history'])}</a>
      <a href="#voices">${esc(t['nav.voices'])}</a>
      <a href="#calendar">${esc(t['nav.calendar'])}</a>
      <a href="#directory">${esc(t['nav.directory'])}</a>
      <a href="#submit">${esc(t['nav.submit'])}</a>
      <a href="#lab">${esc(t['nav.lab'])}</a>
    </nav>
    ${langpick(t, code)}
  </div>
</header>
${mtnote(t, code)}

<!-- ============ HERO ============ -->
<div class="hero">
  <div class="glow"></div>
  <div class="wrap">
    <div class="hero-grid">
      <div>
        <div class="mast">Daily<br>Bread</div>
        <div class="tagline">${t['hero.tagline']}</div>
        <p class="intro">${t['hero.intro']}</p>
        <div class="issueline">${t['hero.issueA']}<br>${t['hero.issueB']}</div>
        <div class="badges">
          <span class="stamp">${t['hero.batch']}</span>
          <a href="#contents" class="stamp pink" style="cursor:pointer">${t['hero.read']}</a>
        </div>
      </div>
      <div class="cover-wrap">
        <span class="tab">${t['hero.sheet']}</span>
        <div class="cover-frame">
          <img src="/assets/cover.jpg" alt="${esc(t['hero.coverAlt'])}" width="1000" height="1500">
          <div class="cap"><span>${t['hero.capA']}</span><span>${t['hero.capB']}</span></div>
        </div>
        <span class="stamp free">${t['hero.free']}</span>
      </div>
    </div>
  </div>
  <div class="band"></div>
</div>

<!-- ============ EDITOR'S LETTER ============ -->
<section id="letter" class="sec letter">
  <div class="wrap">
    <div class="sechead"><span class="no">Sec.00</span><span class="tag">${t['letter.tag']}</span></div>
    <div class="rule" style="margin-bottom:34px"></div>
    <div class="split">
      <div>
        <h2 class="display">${t['letter.h']}</h2>
        <div class="prose justify" style="margin-top:22px">
          <p>${t['letter.p1']}</p>
          <p>${t['letter.p2']}</p>
          <p>${t['letter.p3']}</p>
        </div>
        <div class="signoff">${t['letter.signoff']}</div>
      </div>
      <div>
        <div class="card masthead-list">
          <div class="hd"><span>${t['letter.mastHd']}</span><span class="r">DB-000</span></div>
          <div class="bd list">
            <div class="li"><span class="lab">${t['letter.mh1L']}</span><span class="val">${t['letter.mh1V']}</span></div>
            <div class="li"><span class="lab">${t['letter.mh2L']}</span><span class="val">${t['letter.mh2V']}</span></div>
            <div class="li"><span class="lab">${t['letter.mh3L']}</span><span class="val">${t['letter.mh3V']}</span></div>
            <div class="li"><span class="lab">${t['letter.mh4L']}</span><span class="val">${t['letter.mh4V']}</span></div>
          </div>
        </div>
        <p class="prose justify" style="margin-top:24px">${t['letter.landback']}</p>
        <div style="margin-top:22px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
          <img src="/assets/riposte-logo.svg" alt="Riposte Laboratories" style="width:160px">
          <div class="meta" style="line-height:1.8">${t['letter.funded']}</div>
        </div>
      </div>
    </div>
  </div>
</section>

<div class="band harl br"></div>

<!-- ============ CONTENTS ============ -->
<section id="contents" class="sec" style="background:var(--paper2)">
  <div class="wrap">
    <div class="sechead"><span class="no">Sec.01</span><span class="tag">${t['contents.tag']}</span></div>
    <h2 class="display">${t['contents.h']}<span class="dot">.</span></h2>
    <p class="dek">${t['contents.dek']}</p>
    <div class="card" style="margin-top:30px">
      <div class="hd"><span>${t['contents.mfHd']}</span><span class="r">DB-TOC</span></div>
      <div class="bd"><div class="toc-grid list" id="toc">${tocRows(t)}</div></div>
    </div>
  </div>
</section>

<!-- ============ HISTORY + LEDGER ============ -->
<section id="history" class="sec">
  <div class="wrap">
    <div class="sechead"><span class="no">Sec.02</span><span class="tag">${t['history.tag']}</span></div>
    <div class="split">
      <div>
        <h2 class="display">${t['history.h']}</h2>
        <div class="prose justify" style="margin-top:22px">
          <p>${t['history.p1']}</p>
          <p>${t['history.p2']}</p>
        </div>
        <div class="annot"><span class="scribble orange">${t['history.annot']}</span></div>
      </div>
      <div>
        <span class="kicker">${t['history.ledgerKicker']}</span>
        <div class="card" style="margin-top:16px">
          <div class="hd"><span>${t['history.entryHd']}</span><span>${t['history.statusHd']}</span></div>
          <div class="bd list" id="ledger">${ledgerRows(t)}</div>
        </div>
        <p class="meta" style="margin-top:14px;line-height:1.7">${t['history.method']}</p>
      </div>
    </div>
  </div>
</section>

<!-- ============ YOUNG VOICES ============ -->
<section id="voices" class="sec field-ink">
  <div class="wrap">
    <div class="sechead"><span class="no">Sec.03</span><span class="tag" style="color:#b7ad9e">${t['voices.tag']}</span></div>
    <h2 class="display">${t['voices.h']}</h2>
    <p class="dek" style="color:#cfc6b6">${t['voices.dek']}</p>
    <div class="thirds" style="margin-top:34px">
      <div class="card report"><div class="hd pink"><span>${t['voices.r1tag']}</span><span>${t['voices.r1meta']}</span></div>
        <div class="bd">
          <h3>${t['voices.r1h']}</h3>
          <p>${t['voices.r1p']}</p>
          <div class="pull">${t['voices.r1pull']}</div>
        </div>
      </div>
      <div class="card report"><div class="hd orange"><span>${t['voices.r2tag']}</span><span>${t['voices.r2meta']}</span></div>
        <div class="bd">
          <h3>${t['voices.r2h']}</h3>
          <p>${t['voices.r2p']}</p>
          <div class="pull orange" style="font-family:'Caveat',cursive;font-style:normal;font-size:26px;color:var(--orange);border:0;padding-left:0">${t['voices.r2pull']}</div>
        </div>
      </div>
      <div class="card report"><div class="hd teal"><span>${t['voices.r3tag']}</span><span>${t['voices.r3meta']}</span></div>
        <div class="bd">
          <h3>${t['voices.r3h']}</h3>
          <p>${t['voices.r3p']}</p>
          <div class="pull teal">${t['voices.r3pull']}</div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ============ WAITLIST STATS ============ -->
<section class="sec">
  <div class="wrap">
    <div class="split center">
      <div>
        <span class="kicker pink">${t['waitlist.kicker']}</span>
        <h2 class="display" style="margin-top:16px">${t['waitlist.h']}</h2>
        <p class="dek">${t['waitlist.dek']}</p>
      </div>
      <div class="stats">
        <div class="stat"><div class="n" style="color:var(--pink)">14</div><div class="l">${t['waitlist.s1']}</div></div>
        <div class="stat"><div class="n" style="color:var(--orange)">2</div><div class="l">${t['waitlist.s2']}</div></div>
        <div class="stat"><div class="n" style="color:var(--teal)">400</div><div class="l">${t['waitlist.s3']}</div></div>
      </div>
    </div>
  </div>
</section>

<!-- ============ INTERVIEW QUOTE ============ -->
<div class="field-ink sec tight">
  <div class="wrap">
    <div class="sechead"><span class="no">Sec.05</span><span class="tag" style="color:#b7ad9e">${t['interview.tag']}</span></div>
    <div class="bigquote"><span class="mk">"</span>${t['interview.quote']}<span class="mk">"</span></div>
    <div class="attrib">${t['interview.attrib']}</div>
    <p class="prose" style="margin-top:26px;color:#e7ddcd;max-width:66ch">${t['interview.body']}</p>
  </div>
</div>

<!-- ============ CALENDAR ============ -->
<section id="calendar" class="sec">
  <div class="wrap">
    <div class="sechead"><span class="no">Sec.14</span><span class="tag">${t['calendar.tag']}</span></div>
    <div class="split">
      <div>
        <h2 class="display">${t['calendar.h']}<span class="dot" style="color:var(--teal)">.</span></h2>
        <p class="dek">${t['calendar.dek']}</p>
        <div class="card" style="margin-top:24px">
          <div class="hd"><span>${t['calendar.evHd']}</span><span class="r">${t['calendar.evHd2']}</span></div>
          <div class="bd list" id="events">${eventRows(t)}</div>
        </div>
      </div>
      <div>
        <span class="kicker teal">${t['calendar.moviesKicker']}</span>
        <div class="card" style="margin-top:16px">
          <div class="hd"><span>${t['calendar.scHd']}</span><span class="r">${t['calendar.scHd2']}</span></div>
          <div class="bd list" id="screenings">${screeningRows(t)}</div>
        </div>
        <div class="card" style="margin-top:24px">
          <div class="hd pink"><span>${t['calendar.voteHd']}</span></div>
          <div class="bd">
            <div class="checkline">☐ ${t['calendar.vote1']}</div>
            <div class="checkline">☐ ${t['calendar.vote2']}</div>
            <div class="checkline">☐ ${t['calendar.vote3']}</div>
            <div class="checkline fine">${t['calendar.voteFine']}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ============ DIRECTORY ============ -->
<section id="directory" class="sec" style="background:var(--paper2)">
  <div class="wrap">
    <div class="sechead"><span class="no">Sec.18</span><span class="tag">${t['directory.tag']}</span></div>
    <div class="split">
      <div>
        <span class="kicker teal">${t['directory.kicker']}</span>
        <div class="card" style="margin-top:16px">
          <div class="hd"><span>${t['directory.hd']}</span></div>
          <div class="bd list" id="dir-list">${dirRows(t)}</div>
        </div>
        <p class="meta" style="margin-top:14px;line-height:1.7">${t['directory.note']}</p>
      </div>
      <div>
        <span class="kicker">${t['directory.helpsKicker']}</span>
        <div class="card" style="margin-top:16px">
          <div class="hd"><span>${t['directory.helpsHd']}</span></div>
          <div class="bd">
            <div class="checkline">☐ ${t['directory.help1']}</div>
            <div class="checkline">☐ ${t['directory.help2']}</div>
            <div class="checkline">☐ ${t['directory.help3']}</div>
            <div class="checkline">☐ ${t['directory.help4']}</div>
          </div>
        </div>
        <div class="annot"><span class="scribble">${t['directory.annot']}</span></div>
      </div>
    </div>
  </div>
</section>

<div class="band harl br"></div>

<!-- ============ SUBMIT ============ -->
<section id="submit" class="sec field-ink">
  <div class="wrap">
    <div class="sechead"><span class="no">Sec.19</span><span class="tag" style="color:#b7ad9e">${t['submit.tag']}</span></div>
    <div class="split">
      <div>
        <h2 class="display">${t['submit.h']}<span class="dot">.</span></h2>
        <p class="dek" style="color:#cfc6b6">${t['submit.dek']}</p>
        <div style="margin-top:26px;display:flex;gap:16px;flex-wrap:wrap;align-items:center">
          <a href="mailto:hello@dailybread.example?subject=WALL" class="stamp pink">hello@dailybread.example</a>
          <span class="stamp">${t['submit.deadline']}</span>
        </div>
        <div class="annot"><span class="scribble teal">${t['submit.annot']}</span></div>
      </div>
      <div>
        <div class="card">
          <div class="hd orange"><span>${t['submit.takeHd']}</span></div>
          <div class="bd">
            <div class="checkline">${t['submit.take1']}</div>
            <div class="checkline">${t['submit.take2']}</div>
            <div class="checkline">${t['submit.take3']}</div>
            <div class="checkline">${t['submit.take4']}</div>
            <div class="checkline">${t['submit.take5']}</div>
          </div>
        </div>
        <div class="card" style="margin-top:24px">
          <div class="hd pink"><span>${t['submit.voteHd']}</span></div>
          <div class="bd">
            <div class="checkline">☐ ${t['submit.vote1']}</div>
            <div class="checkline">☐ ${t['submit.vote2']}</div>
            <div class="checkline">☐ ${t['submit.vote3']}</div>
            <div class="checkline fine">${t['submit.voteFine']}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ============ FROM THE LAB ============ -->
<section id="lab" class="sec">
  <div class="wrap">
    <div class="sechead"><span class="no">Sec.16</span><span class="tag">${t['lab.tag']}</span></div>
    <div class="split">
      <div>
        <img src="/assets/riposte-logo.svg" alt="Riposte Laboratories" style="width:min(280px,80%)">
        <div class="meta" style="letter-spacing:.45em;margin-top:10px">${t['lab.labInc']}</div>
        <h2 class="display" style="margin-top:22px">${t['lab.h']}</h2>
        <div class="prose justify" style="margin-top:18px">
          <p>${t['lab.p1']}</p>
          <p>${t['lab.p2']}</p>
        </div>
        <div style="margin-top:22px"><span class="stamp">${t['lab.stamp']}</span></div>
        <div class="signoff" style="margin-top:20px">${t['lab.signoff']}</div>
      </div>
      <div>
        <span class="kicker">${t['lab.kicker']}</span>
        <div class="card" style="margin-top:16px">
          <div class="hd"><span>Q3 · 2026</span><span class="r">Rev. A</span></div>
          <div class="bd list" id="lab-board">${labRows(t)}</div>
        </div>
        <div class="card" style="margin-top:24px">
          <div class="hd orange"><span>${t['lab.whyHd']}</span></div>
          <div class="bd" style="font-size:14px;line-height:1.7">${t['lab.whyBody']}</div>
        </div>
        <p class="meta" style="margin-top:14px;line-height:1.7">${t['lab.tour']}</p>
      </div>
    </div>
  </div>
</section>

<!-- ============ FOOTER / BACK COVER ============ -->
<footer>
  <div class="band harl" style="border-top:2px solid var(--bone)"></div>
  <div class="wrap inner">
    <img class="logo" src="/assets/riposte-logo.svg" alt="Riposte Laboratories">
    <div class="tg">Riposte Laboratories Inc.</div>
    <p class="blurb">${t['footer.blurb']}</p>
    <div class="fmeta">
      <div class="barcode"></div>
      <div class="meta" style="line-height:1.7;text-align:left">${t['footer.issn']}</div>
    </div>
    <div class="signoff" style="color:var(--pink);margin-top:4px">${t['footer.signoff']}</div>
    <div class="colophon">${t['footer.colophon']}</div>
  </div>
  <div class="band" style="border-top:2px solid var(--bone)"></div>
</footer>

</body>
</html>
`;
}

/* ============================================================================
   write + sitemap + main
   ============================================================================ */
function outPath(code){
  return code === 'en' ? path.join(ROOT, 'index.html') : path.join(ROOT, code, 'index.html');
}
function write(file, html){
  fs.mkdirSync(path.dirname(file), {recursive:true});
  fs.writeFileSync(file, html);
}
function emitSitemap(){
  const urls = LANGS.map(L=>{
    const alts = LANGS.map(l=>`    <xhtml:link rel="alternate" hreflang="${l.hreflang}" href="${ORIGIN}${url(l.code)}"/>`).join('\n')
      + `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}${url('en')}"/>`;
    return `  <url>\n    <loc>${ORIGIN}${url(L.code)}</loc>\n${alts}\n  </url>`;
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n`+
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n`+
    urls.join('\n')+`\n</urlset>\n`;
  fs.writeFileSync(path.join(ROOT,'sitemap.xml'), xml);
  console.log('wrote sitemap.xml:', urls.length, 'urls');
}
function clean(){
  for(const L of LANGS){
    if(L.code==='en') continue;
    const d = path.join(ROOT, L.code);
    if(fs.existsSync(d)){ fs.rmSync(d, {recursive:true, force:true}); console.log('removed', L.code+'/'); }
  }
}
function main(){
  const args = process.argv.slice(2);
  if(args.includes('--clean')) clean();
  const only = args.find(a=>!a.startsWith('--')) || null;
  let n = 0;
  for(const L of LANGS){
    if(only && L.code !== only) continue;
    write(outPath(L.code), page(L.code)); n++;
    console.log('built', L.code);
  }
  if(!only) emitSitemap();
  console.log('done:', n, 'files');
}
main();
