/* ============================================================================
   Daily Bread · multilingual static-site generator
   ----------------------------------------------------------------------------
   Emits the magazine home page in 16 languages (English + the 12 the Government
   of BC officially supports, plus Italian, Polish and Latin), each in three
   renderings — full / lite / e-ink — matching the language set and lightweight
   variants of the sibling ripostelabs.xyz site.

   Source of truth:
     tools/strings/en.js         English strings (one key = one unit)
     tools/strings/<lang>.json   translations (same keys; missing -> English)
     tools/assets/style.css      the page stylesheet (inlined into <head>)
     assets/                      cover.jpg + riposte-logo.svg (served from /assets)

   URL scheme: English full at root ("/"); other languages under "/<lang>/";
   the lite / e-ink renderings add a "/lite/" or "/eink/" segment, e.g. "/lite/",
   "/eink/", "/fr/lite/", "/ar/eink/".
   Run:  node tools/build.js            (build all languages × all renderings)
         node tools/build.js fr         (one language, all renderings)
         node tools/build.js eink       (one rendering, all languages)
         node tools/build.js fr eink    (one language + one rendering)
         node tools/build.js --clean    (remove generated dirs first)
   ============================================================================ */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const STYLE = fs.readFileSync(path.join(__dirname, 'assets', 'style.css'), 'utf8');
const ALT = fs.readFileSync(path.join(__dirname, 'assets', 'alt.css'), 'utf8');

/* ---- renderings: the full page + two lightweight variants ----
   full  = the rich, web-font, colour edition (served at the page root)
   lite  = same content, no web fonts, decoration stripped, colour kept
   eink  = lite + monochrome, high-contrast, motion-free (for e-readers)     */
const VARIANTS = [
  {id:'full', cls:'',        seg:''},
  {id:'lite', cls:'v-lite',  seg:'lite'},
  {id:'eink', cls:'v-eink',  seg:'eink'},
];

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

const ORIGIN = 'https://ourdailybre.ad';

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

/* ============================================================================
   feature art — the comic, the rip-out centrefold, and the sticker sheet.
   All hand-built SVG in the house palette; no runtime JS, translatable captions.
   ============================================================================ */
const INK='#1d1a17', BONE='#f6f1e7', PINK='#f0477d', TEAL='#12b795', ORANGE='#fe9a0d', BREAD='#e4bd79';

/* the bread golem — Daily Bread's mascot, reused in Crumbs and on a sticker */
function golem(mood){
  const eyes = mood==='shut'
    ? `<path d="M39 65 h11 M66 65 h11" fill="none"/>`
    : `<circle cx="45" cy="65" r="4.6" fill="${INK}" stroke="none"/><circle cx="72" cy="65" r="4.6" fill="${INK}" stroke="none"/>`;
  const mouth = mood==='worry'
    ? `<ellipse cx="58" cy="80" rx="7" ry="5" fill="${INK}" stroke="none"/>`
    : `<path d="M49 79 q9 7 18 0" fill="none" stroke-width="2.6"/>`;
  return `<g stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
    <path d="M14 78 Q14 39 58 39 Q102 39 102 78 Q102 93 58 93 Q14 93 14 78 Z" fill="${BREAD}"/>
    <path d="M26 51 q11 -8 21 0 M49 49 q11 -8 21 2 M72 53 q8 -6 15 2" fill="none" stroke-width="2.3"/>
    ${eyes}${mouth}
    <circle cx="58" cy="74" r="1.9" fill="${PINK}" stroke="none"/>
  </g>`;
}
function bubble(x,y,w,txt){
  return `<g><rect x="${x}" y="${y}" width="${w}" height="27" rx="13.5" fill="${BONE}" stroke="${INK}" stroke-width="2.5"/>`
    +`<path d="M${x+18} ${y+25} l4 13 l11 -11 Z" fill="${BONE}" stroke="${INK}" stroke-width="2.5"/>`
    +`<text x="${x+w/2}" y="${y+18}" text-anchor="middle" font-family="'IBM Plex Mono',monospace" font-size="10.5" fill="${INK}">${esc(txt)}</text></g>`;
}
/* six panels of "Crumbs — a golem seeks housing" */
function comicStrip(t){
  const P = v => `<svg viewBox="0 0 220 150" preserveAspectRatio="xMidYMid meet" role="presentation">${v}</svg>`;
  const p1 = P(`<path d="M50 116 L170 116 L158 140 L62 140 Z" fill="#cdb491" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`
    +`<line x1="50" y1="116" x2="170" y2="116" stroke="${INK}" stroke-width="3"/>`
    +`<g transform="translate(52,22)">${golem('open')}</g>`
    +`<text x="150" y="44" font-size="24" fill="${ORANGE}">✦</text><text x="178" y="74" font-size="15" fill="${PINK}">✦</text>`);
  const p2 = P(`<g transform="translate(4,30)">${golem('worry')}</g>`
    +`<g transform="rotate(-7 150 82)"><rect x="120" y="34" width="76" height="94" fill="${BONE}" stroke="${INK}" stroke-width="3"/>`
    +`<text x="158" y="62" text-anchor="middle" font-family="'IBM Plex Mono',monospace" font-weight="700" font-size="17" fill="${PINK}">$2,100</text>`
    +`<line x1="131" y1="76" x2="185" y2="76" stroke="${INK}" stroke-width="2"/><line x1="131" y1="90" x2="185" y2="90" stroke="${INK}" stroke-width="2"/>`
    +`<line x1="131" y1="104" x2="171" y2="104" stroke="${INK}" stroke-width="2"/>`
    +`<text x="158" y="122" text-anchor="middle" font-family="'IBM Plex Mono',monospace" font-size="9" fill="${INK}">“cozy”</text></g>`);
  let heads='';
  for(let r=0;r<4;r++)for(let c=0;c<8;c++){
    const x=20+c*25, y=44+r*26;
    if(r===2&&c===5){ heads+=`<g transform="translate(${x-22},${y-20}) scale(0.42)">${golem('open')}</g>`; }
    else { heads+=`<circle cx="${x}" cy="${y}" r="7" fill="${INK}"/><path d="M${x-8} ${y+22} q8 -13 16 0 Z" fill="${INK}"/>`; }
  }
  const p3 = P(heads+`<circle cx="145" cy="70" r="15" fill="none" stroke="${PINK}" stroke-width="2.5"/>`);
  const p4 = P(`<g transform="translate(120,20)"><rect x="20" y="34" width="46" height="70" rx="6" fill="${INK}"/><circle cx="43" cy="24" r="16" fill="${INK}"/>`
    +`<path d="M20 60 L2 44" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><circle cx="0" cy="42" r="5" fill="${INK}"/></g>`
    +`<g transform="translate(-6,54) scale(0.7)">${golem('worry')}</g>`
    +bubble(60,16,148,esc(t['comic.bubble4'])));
  const p5 = P(`<rect x="0" y="0" width="220" height="150" fill="#241f1a"/>`
    +`<circle cx="176" cy="40" r="20" fill="${BONE}"/><circle cx="168" cy="36" r="20" fill="#241f1a"/>`
    +`<rect x="44" y="70" width="10" height="54" fill="#5a4a34"/><ellipse cx="49" cy="66" rx="38" ry="27" fill="${ORANGE}" stroke="${INK}" stroke-width="2.5"/>`
    +`<circle cx="36" cy="60" r="4" fill="${PINK}"/><circle cx="62" cy="72" r="4" fill="${PINK}"/>`
    +`<g transform="translate(96,58) rotate(90 50 60)">${golem('shut')}</g>`
    +`<text x="150" y="120" font-family="'Caveat',cursive" font-size="22" fill="${BONE}">zzz</text>`);
  const p6 = P(`<g transform="translate(2,26)">${golem('open')}</g>`
    +`<g transform="rotate(6 150 84)"><rect x="120" y="40" width="74" height="92" fill="${INK}"/>`
    +`<text x="157" y="96" text-anchor="middle" font-family="'UnifrakturMaguntia',serif" font-size="42" fill="${PINK}">DB</text></g>`
    +`<text x="120" y="34" font-size="19" fill="${PINK}">♥</text><text x="196" y="60" font-size="14" fill="${TEAL}">♥</text>`);
  const panels = [[p1,'comic.p1c'],[p2,'comic.p2c'],[p3,'comic.p3c'],[p4,'comic.p4c'],[p5,'comic.p5c'],[p6,'comic.p6c']];
  return panels.map(([svg,key],i)=>`<figure class="panel"><span class="pn">${String(i+1).padStart(2,'0')}</span><div class="art${i===4?' night':''}">${svg}</div><figcaption>${esc(t[key])}</figcaption></figure>`).join('');
}

/* the rip-out centrefold poster: "A Scene Isn't an Address" */
function posterSVG(t){
  let diamonds='';
  for(let i=0;i<11;i++){ const c=[PINK,TEAL,ORANGE][i%3]; diamonds+=`<rect x="${i*62}" y="-13" width="26" height="26" transform="rotate(45 ${i*62+13} 0)" fill="${c}"/>`; }
  let orchard='';
  for(let i=0;i<9;i++){ const x=40+i*72; orchard+=`<rect x="${x-3}" y="286" width="6" height="20" fill="#3a2f22"/><circle cx="${x}" cy="284" r="15" fill="${ORANGE}" stroke="${INK}" stroke-width="2"/>`; }
  return `<svg class="poster-svg" viewBox="0 0 680 400" role="img" aria-label="${esc(t['art.posterA'])} ${esc(t['art.posterB'])}">`
    +`<rect width="680" height="400" fill="${INK}"/>`
    +`<g>${diamonds}</g>`
    +`<circle cx="566" cy="128" r="58" fill="${PINK}"/><circle cx="546" cy="112" r="58" fill="${INK}"/>`
    +`<path d="M0 306 L150 176 L300 306 Z" fill="#2a2620" stroke="${BONE}" stroke-width="2"/>`
    +`<path d="M210 306 L400 156 L590 306 Z" fill="#211d18" stroke="${BONE}" stroke-width="2"/>`
    +`<rect x="0" y="306" width="680" height="94" fill="${TEAL}"/>`
    +`<path d="M0 330 q40 -10 80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0" fill="none" stroke="${BONE}" stroke-width="2" opacity="0.5"/>`
    +`<g>${orchard}</g>`
    +`<text x="46" y="150" font-family="'IBM Plex Mono',monospace" font-weight="800" font-size="62" letter-spacing="-2" fill="${BONE}">${esc(t['art.posterA'])}</text>`
    +`<text x="46" y="224" font-family="'IBM Plex Mono',monospace" font-weight="800" font-size="62" letter-spacing="-2" fill="${PINK}">${esc(t['art.posterB'])}</text>`
    +`<text x="46" y="360" font-family="'IBM Plex Mono',monospace" font-size="13" letter-spacing="3" fill="${INK}" font-weight="700">${esc(t['art.posterFoot']).toUpperCase()}</text>`
    +`</svg>`;
}
/* three small gallery plates */
function platesSVG(){
  const facade = `<svg viewBox="0 0 200 150" role="presentation"><rect width="200" height="150" fill="${BONE}"/><rect x="30" y="26" width="140" height="112" fill="#2a2620" stroke="${INK}" stroke-width="3"/>`
    +[36,86,136].map(y=>[44,90,136].map(x=>`<rect x="${x}" y="${y}" width="30" height="30" fill="${(x===90&&y===86)?PINK:'#4a423a'}" stroke="${INK}" stroke-width="2"/>`).join('')).join('')
    +`<rect x="70" y="118" width="60" height="16" fill="${ORANGE}" transform="rotate(-4 100 126)"/></svg>`;
  const lake = `<svg viewBox="0 0 200 150" role="presentation"><rect width="200" height="150" fill="${BONE}"/>`
    +`<rect x="24" y="52" width="120" height="10" fill="#5a4a34"/><rect x="30" y="62" width="8" height="30" fill="#5a4a34"/><rect x="128" y="62" width="8" height="30" fill="#5a4a34"/>`
    +[0,1,2,3].map(i=>`<path d="M0 ${86+i*16} q25 -9 50 0 t50 0 t50 0 t50 0" fill="none" stroke="${TEAL}" stroke-width="4"/>`).join('')
    +`<rect x="0" y="120" width="200" height="30" fill="${TEAL}" opacity="0.9"/></svg>`;
  const orchard = `<svg viewBox="0 0 200 150" role="presentation"><rect width="200" height="150" fill="${BONE}"/>`
    +[30,70,110,150].map((x,i)=>`<rect x="${x-3}" y="70" width="6" height="52" fill="#3a2f22"/>`+(i%2?`<circle cx="${x}" cy="66" r="18" fill="${ORANGE}" stroke="${INK}" stroke-width="2.5"/>`:`<path d="M${x-14} 78 l14 -20 l14 20 Z" fill="none" stroke="${INK}" stroke-width="2.5"/>`)).join('')
    +`<line x1="10" y1="122" x2="190" y2="122" stroke="${INK}" stroke-width="3"/></svg>`;
  const items = [['art.plate1t','art.plate1by',facade],['art.plate2t','art.plate2by',lake],['art.plate3t','art.plate3by',orchard]];
  return items;
}
/* the line-art "Colour Your Own Collapse" page */
function colourSVG(){
  let trees='';
  for(let i=0;i<6;i++){ const x=70+i*95; trees+=`<rect x="${x-4}" y="150" width="8" height="40" fill="none" stroke="${INK}" stroke-width="2.5"/><circle cx="${x}" cy="140" r="26" fill="none" stroke="${INK}" stroke-width="2.5"/>`; }
  return `<svg class="colour-svg" viewBox="0 0 640 240" role="img" aria-label="Colouring page: an orchard under a sun, drawn in outline to colour in">`
    +`<rect width="640" height="240" fill="${BONE}"/>`
    +`<circle cx="560" cy="60" r="34" fill="none" stroke="${INK}" stroke-width="2.5"/>`
    +Array.from({length:8},(_,i)=>{const a=i*Math.PI/4;return `<line x1="${560+Math.cos(a)*42}" y1="${60+Math.sin(a)*42}" x2="${560+Math.cos(a)*52}" y2="${60+Math.sin(a)*52}" stroke="${INK}" stroke-width="2.5"/>`}).join('')
    +`<path d="M0 190 q160 -34 320 0 t320 0" fill="none" stroke="${INK}" stroke-width="2.5"/>`
    +trees
    +`<rect x="250" y="150" width="80" height="60" fill="none" stroke="${INK}" stroke-width="2.5"/><path d="M250 150 l40 -30 l40 30" fill="none" stroke="${INK}" stroke-width="2.5"/>`
    +`<text x="268" y="188" font-family="'IBM Plex Mono',monospace" font-size="11" fill="${INK}">FOR LEASE</text>`
    +`<text x="24" y="34" font-family="'Caveat',cursive" font-size="26" fill="${INK}">colour me →</text>`
    +`<line x1="0" y1="220" x2="640" y2="220" stroke="${INK}" stroke-width="1.5" stroke-dasharray="8 6"/></svg>`;
}

/* the twelve-sticker "Peel Me" sheet (printable) */
function stickerSheet(t){
  const face = `<svg viewBox="0 0 116 108" role="presentation"><g transform="translate(4,4)">${golem('open')}</g></svg>`;
  const mountain = `<svg viewBox="0 0 100 80" role="presentation"><path d="M6 60 L34 22 L58 60 Z" fill="#2a2620"/><path d="M40 60 L66 30 L94 60 Z" fill="${INK}"/><circle cx="80" cy="24" r="10" fill="${PINK}"/><rect x="0" y="60" width="100" height="14" fill="${TEAL}"/></svg>`;
  const drop = `<svg viewBox="0 0 80 96" role="presentation"><path d="M40 6 C40 6 70 46 70 66 A30 30 0 1 1 10 66 C10 46 40 6 40 6 Z" fill="${TEAL}" stroke="${INK}" stroke-width="3"/><path d="M28 62 a12 12 0 0 0 12 12" fill="none" stroke="${BONE}" stroke-width="3"/></svg>`;
  const recycle = `<svg viewBox="0 0 96 96" role="presentation"><g fill="none" stroke="${TEAL}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">`
    +`<path d="M48 20 L64 46 M64 46 L54 44 M64 46 L62 36"/><path d="M70 60 L40 60 M40 60 L48 66 M40 60 L48 54" transform="rotate(120 48 48)"/><path d="M70 60 L40 60 M40 60 L48 66 M40 60 L48 54" transform="rotate(240 48 48)"/></g></svg>`;
  // kinds: g=graphic svg + label under · s=text stamp · q=big quote · m=blackletter monogram
  const S = [
    {k:'g', c:PINK,   svg:face,     key:'stickers.s1'},
    {k:'s', c:PINK,   key:'stickers.s2'},
    {k:'s', c:ORANGE, key:'stickers.s3'},
    {k:'g', c:INK,    svg:mountain, key:'stickers.s4'},
    {k:'q', c:TEAL,   key:'stickers.s5'},
    {k:'m', c:INK,    key:'stickers.s6'},
    {k:'g', c:TEAL,   svg:recycle,  key:'stickers.s7'},
    {k:'g', c:TEAL,   svg:drop,     key:'stickers.s8'},
    {k:'s', c:INK,    key:'stickers.s9'},
    {k:'s', c:PINK,   key:'stickers.s10'},
    {k:'s', c:ORANGE, key:'stickers.s11'},
    {k:'q', c:INK,    key:'stickers.s12'},
  ];
  const cell = (d,i)=>{
    const rot = ['-2.5deg','1.5deg','-1deg','2.5deg','-2deg','1deg'][i%6];
    let inner;
    if(d.k==='g') inner = `<div class="ic">${d.svg}</div><span class="lab" style="color:${d.c}">${esc(t[d.key])}</span>`;
    else if(d.k==='m') inner = `<span class="mono">DB</span><span class="lab">${esc(t[d.key])}</span>`;
    else if(d.k==='q') inner = `<span class="quote" style="color:${d.c}">${esc(t[d.key])}</span>`;
    else inner = `<span class="stampbadge" style="border-color:${d.c};color:${d.c}">${esc(t[d.key])}</span>`;
    return `<div class="sticker k-${d.k}" style="--rot:${rot}">${inner}</div>`;
  };
  return S.map(cell).join('');
}

/* ---- shared chrome ---- */
/* url("fr","lite") -> "/fr/lite/" · url("en","full") -> "/" · url("en","lite") -> "/lite/" */
function url(code, variant){
  const seg = (VARIANTS.find(v=>v.id===variant) || VARIANTS[0]).seg;
  const base = code === 'en' ? '/' : '/' + code + '/';
  return seg ? base + seg + '/' : base;
}
function langpick(t, code, variant){
  const cur = LANGS.find(l=>l.code===code);
  const items = LANGS.map(l=>{
    const c = l.code===code ? ' aria-current="true"' : '';
    return `<a href="${url(l.code, variant)}" hreflang="${l.hreflang}" lang="${l.hreflang}"${l.dir==='rtl'?' dir="rtl"':''}${c}><span class="endo">${l.endo}</span><span class="en">${l.en}</span></a>`;
  }).join('');
  return `<details class="langpick"><summary aria-label="${esc(t['chrome.language'])}"><span class="globe" aria-hidden="true">\u{1F310}</span> ${cur.endo} <span class="car" aria-hidden="true">▾</span></summary><div class="langmenu">${items}</div></details>`;
}
/* rendering switch — same language, hop between full / lite / e-ink */
function vswitch(t, code, variant){
  const key = {full:'chrome.verFull', lite:'chrome.verLite', eink:'chrome.verEink'};
  const items = VARIANTS.map(v=>{
    const cur = v.id===variant ? ' aria-current="true"' : '';
    return `<a href="${url(code, v.id)}"${cur}>${esc(t[key[v.id]])}</a>`;
  }).join('');
  return `<nav class="vswitch" aria-label="${esc(t['chrome.rendering'])}">${items}</nav>`;
}
function fswitch(t, code, variant){
  const key = {full:'chrome.verFull', lite:'chrome.verLite', eink:'chrome.verEink'};
  const items = VARIANTS.map(v=>{
    const cur = v.id===variant ? ' aria-current="true"' : '';
    return `<a href="${url(code, v.id)}"${cur}>${esc(t[key[v.id]])}</a>`;
  }).join(' · ');
  return `<div class="fswitch">${esc(t['chrome.altVersions'])}: ${items}</div>`;
}
function hreflangs(variant){
  const links = LANGS.map(l=>`<link rel="alternate" hreflang="${l.hreflang}" href="${ORIGIN}${url(l.code, variant)}">`);
  links.push(`<link rel="alternate" hreflang="x-default" href="${ORIGIN}${url('en', variant)}">`);
  return links.join('\n');
}
function mtnote(t, code, variant){
  if(code==='en') return '';
  /* point the "read the English edition" link at the same rendering */
  const note = t['chrome.mtnote'].replace('href="/"', `href="${url('en', variant)}"`);
  return `<div class="mtnote">${note}</div>`;
}

/* ============================================================================
   page
   ============================================================================ */
function page(code, variant){
  variant = variant || 'full';
  const V = VARIANTS.find(v=>v.id===variant) || VARIANTS[0];
  const t = loadStrings(code);
  const L = LANGS.find(l=>l.code===code);
  const rtl = L.dir === 'rtl';
  const htmlCls = V.cls ? ` class="${V.cls}"` : '';
  /* e-ink ships a pre-dithered 1-bit cover (Floyd–Steinberg) instead of the
     colour JPEG: a continuous-tone photo would be hard-thresholded to blotches
     by a 1-bit panel, and CSS grayscale() does not dither. Regenerate the asset
     with tools/dither-cover.sh. full / lite keep the JPEG. */
  const cover = variant==='eink'
    ? { src:'/assets/cover-eink.png', w:800,  h:1200 }
    : { src:'/assets/cover.jpg',      w:1000, h:1500 };
  /* full loads the three web fonts; the lightweight variants ship system-only */
  const fonts = variant==='full'
    ? `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=UnifrakturMaguntia&display=swap" rel="stylesheet">`
    : '';
  /* full advertises the lighter renderings to data-saver / monochrome clients */
  const hints = variant==='full'
    ? `<link rel="alternate" media="(prefers-reduced-data: reduce)" href="${url(code,'lite')}">
<link rel="alternate" media="(monochrome)" href="${url(code,'eink')}">`
    : '';
  const css = variant==='full' ? STYLE : STYLE + '\n' + ALT;
  return `<!DOCTYPE html>
<html lang="${L.hreflang}"${rtl?' dir="rtl"':''}${htmlCls}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t['meta.title'])}</title>
<meta name="description" content="${esc(t['meta.desc'])}">
<meta property="og:title" content="${esc(t['meta.ogTitle'])}">
<meta property="og:description" content="${esc(t['meta.ogDesc'])}">
<meta property="og:image" content="/assets/cover.jpg">
<meta property="og:type" content="website">
<link rel="canonical" href="${ORIGIN}${url(code, variant)}">
${hreflangs(variant)}${hints ? '\n'+hints : ''}
${fonts}
<style>
${css}
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
      <a href="#comics">${esc(t['nav.comics'])}</a>
      <a href="#art">${esc(t['nav.art'])}</a>
      <a href="#calendar">${esc(t['nav.calendar'])}</a>
      <a href="#directory">${esc(t['nav.directory'])}</a>
      <a href="#submit">${esc(t['nav.submit'])}</a>
      <a href="#lab">${esc(t['nav.lab'])}</a>
      <a href="#stickers">${esc(t['nav.stickers'])}</a>
    </nav>
    ${vswitch(t, code, variant)}
    ${langpick(t, code, variant)}
  </div>
</header>
${mtnote(t, code, variant)}

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
          <img src="${cover.src}" alt="${esc(t['hero.coverAlt'])}" width="${cover.w}" height="${cover.h}">
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

<!-- ============ COMICS · CRUMBS ============ -->
<section id="comics" class="sec" style="background:var(--paper2)">
  <div class="wrap">
    <div class="sechead"><span class="no">Sec.08</span><span class="tag">${t['comic.tag']}</span></div>
    <h2 class="display">${t['comic.h']}<span class="dot">.</span></h2>
    <p class="dek">${t['comic.dek']}</p>
    <div style="margin-top:16px"><span class="kicker orange">${t['comic.credit']}</span></div>
    <div class="comic-strip">${comicStrip(t)}</div>
    <p class="meta" style="margin-top:24px;line-height:1.9">${t['comic.foot']}</p>
  </div>
</section>

<div class="band harl br"></div>

<!-- ============ ART · THE WALL (rip-out centrefold) ============ -->
<section id="art" class="sec field-ink">
  <div class="wrap">
    <div class="sechead"><span class="no">Sec.11</span><span class="tag" style="color:#b7ad9e">${t['art.tag']}</span></div>
    <div class="split center">
      <div>
        <h2 class="display">${t['art.h']}</h2>
        <p class="dek" style="color:#cfc6b6">${t['art.dek']}</p>
        <div class="annot"><span class="scribble teal">${t['art.annot']}</span></div>
      </div>
      <div style="text-align:right"><span class="kicker pink">${t['art.posterKicker']}</span></div>
    </div>
    <figure class="centrefold">
      <span class="tearstrip" aria-hidden="true">${t['art.tear']}</span>
      ${posterSVG(t)}
    </figure>
    <div class="split" style="margin-top:46px">
      <div>
        <span class="kicker">${t['art.plateKicker']}</span>
        <div class="plate-row">${platesSVG().map(([tk,bk,svg])=>`<figure class="plate">${svg}<figcaption><b>${esc(t[tk])}</b><span>${esc(t[bk])}</span></figcaption></figure>`).join('')}</div>
      </div>
      <div class="card colour-card">
        <div class="hd pink"><span>${t['art.colourStamp']}</span></div>
        <div class="bd">
          <h3 class="colour-h">${t['art.colourHd']}</h3>
          ${colourSVG()}
          <p style="font-size:14px;line-height:1.7;margin-top:14px">${t['art.colourBody']}</p>
        </div>
      </div>
    </div>
  </div>
</section>

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

<div class="band harl br"></div>

<!-- ============ STICKERS · PEEL ME (printable sheet) ============ -->
<section id="stickers" class="sec stickers-sec">
  <div class="wrap">
    <div class="sechead"><span class="no">Sec.24</span><span class="tag">${t['stickers.tag']}</span></div>
    <div class="split center">
      <div>
        <h2 class="display">${t['stickers.h']}<span class="dot" style="color:var(--teal)">.</span></h2>
        <p class="dek">${t['stickers.dek']}</p>
      </div>
      <div class="print-cta">
        <button type="button" class="printbtn" onclick="window.print()">${t['stickers.print']} ⎙</button>
        <span class="fine">${t['stickers.printHint']}</span>
      </div>
    </div>
    <div class="card sheet">
      <div class="hd"><span>${t['stickers.sheetHd']}</span><span class="r">${t['stickers.sheetMeta']}</span></div>
      <div class="bd"><div class="sticker-grid">${stickerSheet(t)}</div></div>
    </div>
    <p class="meta" style="margin-top:18px;line-height:1.9">${t['stickers.foot']}</p>
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
    ${fswitch(t, code, variant)}
    <div class="colophon">${t['footer.colophon']}</div>
    <div class="verify-note"><a href="/verify/">${t['footer.verify']}</a></div>
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
function outPath(code, variant){
  const seg = (VARIANTS.find(v=>v.id===variant) || VARIANTS[0]).seg;
  const dir = code === 'en' ? ROOT : path.join(ROOT, code);
  return seg ? path.join(dir, seg, 'index.html') : path.join(dir, 'index.html');
}
function write(file, html){
  fs.mkdirSync(path.dirname(file), {recursive:true});
  fs.writeFileSync(file, html);
}
function emitSitemap(){
  const urls = [];
  for(const V of VARIANTS){
    for(const L of LANGS){
      const alts = LANGS.map(l=>`    <xhtml:link rel="alternate" hreflang="${l.hreflang}" href="${ORIGIN}${url(l.code, V.id)}"/>`).join('\n')
        + `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}${url('en', V.id)}"/>`;
      urls.push(`  <url>\n    <loc>${ORIGIN}${url(L.code, V.id)}</loc>\n${alts}\n  </url>`);
    }
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n`+
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n`+
    urls.join('\n')+`\n</urlset>\n`;
  fs.writeFileSync(path.join(ROOT,'sitemap.xml'), xml);
  console.log('wrote sitemap.xml:', urls.length, 'urls');
}
function clean(){
  /* remove every generated language dir, plus the root-level lite/ + eink/ */
  for(const L of LANGS){
    if(L.code==='en') continue;
    const d = path.join(ROOT, L.code);
    if(fs.existsSync(d)){ fs.rmSync(d, {recursive:true, force:true}); console.log('removed', L.code+'/'); }
  }
  for(const V of VARIANTS){
    if(!V.seg) continue;
    const d = path.join(ROOT, V.seg);
    if(fs.existsSync(d)){ fs.rmSync(d, {recursive:true, force:true}); console.log('removed', V.seg+'/'); }
  }
}
function main(){
  const args = process.argv.slice(2);
  if(args.includes('--clean')) clean();
  /* positional args (any order): a language code and/or a variant id */
  const pos = args.filter(a=>!a.startsWith('--'));
  const onlyLang = pos.find(a=>LANGS.some(l=>l.code===a)) || null;
  const onlyVar = pos.find(a=>VARIANTS.some(v=>v.id===a)) || null;
  let n = 0;
  for(const V of VARIANTS){
    if(onlyVar && V.id !== onlyVar) continue;
    for(const L of LANGS){
      if(onlyLang && L.code !== onlyLang) continue;
      write(outPath(L.code, V.id), page(L.code, V.id)); n++;
    }
    console.log('built', V.id, '·', (onlyLang || LANGS.length+' languages'));
  }
  if(!onlyLang && !onlyVar) emitSitemap();
  console.log('done:', n, 'files');
}
main();
