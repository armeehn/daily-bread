/* ============================================================================
   Daily Bread — pages
   ----------------------------------------------------------------------------
   One renderer for every output. DB.render(model) is the magazine; this lays
   that document out on sheets of the edition's trim: the studio's Web PDF, and
   the press's printed PDFs (tools/press/render.mjs runs this same file in
   headless Chromium), so the website, the Web PDF and the printed booklet are
   the same pages drawn by the same CSS, in the same fonts.

   Each unit — the cover, every section, a sheet per Young Voices report, the
   back cover — goes on a sheet of its own, scaled down only if it would not fit.
   The long pieces (LONG_PIECES) carry on onto a Continued sheet before the back
   cover instead: what their first sheet cannot hold at full size moves there.

   Exposed as global `DBPrint` (browser) and module.exports (Node).
   ========================================================================== */
(function (root) {
  "use strict";
  var DB = root.DB || (typeof require === "function" ? require("./db.js") : null);
  if (!DB) throw new Error("db-print.js needs db.js loaded first");
  var PLAIN = function(s){ return String(s == null ? "" : s).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(); };

  // pieces print lets run on: first sheet, then a Continued sheet of their own
  function longPieces(m){
    var out = ["letter.paragraphs", "history.paragraphs"];
    ((m.voices && m.voices.reports) || []).forEach(function(_, i){ out.push("voices.reports." + i + ".body"); });
    out.push("lab.paragraphs");
    return out;
  }
  // the sheet a piece prints on
  function pieceSheet(path){ var r = path.match(/^voices\.reports\.(\d+)\./); return r ? "voices." + r[1] : path.split(".")[0]; }

function bleedPx(doc, m){
  const probe = doc.createElement("div");
  probe.style.cssText = "position:absolute;left:0;top:0;visibility:hidden;width:" + DB.printGeom(m).bleed;
  doc.body.appendChild(probe);
  const w = probe.getBoundingClientRect().width; probe.remove();
  return w;
}
function sheetPx(doc, m){
  const g = DB.printGeom(m), extra = "calc(" + g.bleed + "*2 + " + g.slug + "*2)";
  const probe = doc.createElement("div");
  probe.style.cssText = "position:absolute;left:0;top:0;visibility:hidden;width:calc(" + g.tw + " + " + extra + ");height:calc(" + g.th + " + " + extra + ")";
  doc.body.appendChild(probe);
  const r = probe.getBoundingClientRect(); probe.remove();
  return { w: r.width, h: r.height };
}
// Lay doc (a DB.render document, loaded in a frame) out one unit per sheet.
// `zooms` sets a sheet's scale by its key (the calibration that makes a
// writer's page hold what its printed page holds); a sheet with no entry is
// shrunk only if it would not fit. `opts.conts` (model paths) are the long
// pieces that carry on, as in print, onto a Continued sheet of their own
// before the back cover: what their first sheet cannot hold at its scale moves
// there. `opts.measure` keeps every Continued sheet, empty, and splits nothing
// (the word-limit measure fills them itself).
// Returns [{ key, label, scale, fit, unit, cont }].
async function paginate(ctx, m, zooms, opts){
  zooms = zooms || {}; opts = opts || {};
  const doc = ctx.doc, win = ctx.win;
  // the print rules become the only rules, so what is measured is what prints
  doc.querySelectorAll("style").forEach(st=>{ st.textContent = st.textContent.replace(/@media\s+print\s*\{/g, "@media all{"); });
  const S = sheetPx(doc, m);
  await ctx.size(S.w, S.h);                                  // 100vh is a sheet, as on paper
  // What is laid out is the trim: the bleed around it carries only the section's
  // ground (the sheet's background), so nothing that matters is cut off with it.
  const B = bleedPx(doc, m), A = { w: S.w - 2 * B, h: S.h - 2 * B };
  const units = [];
  Array.from(doc.body.querySelectorAll(".hero, .sec, footer"))
    .filter(el=> !el.parentElement.closest(".hero, .sec, footer"))
    .forEach(u=>{
      const key = unitKey(u, m);
      const reports = key === "voices" ? u.querySelectorAll(".thirds > .report") : [];
      if(reports.length < 2){ units.push({ el:u, key }); return; }
      // Print gives each young writer a page; so does the Web PDF: one sheet per
      // report, the section's head on the first, each report the full width.
      Array.from(reports).forEach((_, i)=>{
        const c = i === reports.length - 1 ? u : u.cloneNode(true);
        Array.from(c.querySelectorAll(".thirds > .report")).forEach((r, j)=>{ if(j !== i) r.remove(); });
        c.querySelector(".thirds").style.gridTemplateColumns = "1fr";
        if(i){ c.querySelectorAll("h2.display, .dek").forEach(n=> n.remove()); c.removeAttribute("id"); }
        units.push({ el:c, key:"voices." + i });
      });
    });
  const conts = (opts.conts || []).map(path=>{
    const key = pieceSheet(path), un = units.find(u=> u.key === key);
    const box = un && pieceBox(un.el, path);
    if(!box) return null;
    // the Continued sheet takes its section's classes, so its ground and ink
    const el = doc.createElement("section"); el.className = un.el.className + " pp-cont"; el.removeAttribute("id");
    el.innerHTML = '<div class="wrap"><div class="pp-cont-hd"><span class="pp-cont-k">Continued</span><h3 class="display pp-cont-t"></h3></div>' +
      '<div class="prose justify pp-cont-body"></div></div>';
    el.querySelector(".pp-cont-t").textContent = pieceTitle(un.el, path);
    const jump = doc.createElement("p"); jump.className = "pp-jump"; jump.textContent = "Continued on sheet 00 →";
    if(box.tagName === "P") box.parentNode.insertBefore(jump, box.nextSibling); else box.appendChild(jump);
    if(!opts.measure) jump.style.display = "none";
    return { path, key, main: un, box, jump, el, body: el.querySelector(".pp-cont-body"), head: el.querySelector(".pp-cont-k") };
  }).filter(Boolean);
  // before the back cover, as print's Continued pages go before its inside back cover
  const fi = units.findIndex(u=> u.key === "footer");
  units.splice(fi < 0 ? units.length : fi, 0, ...conts.map(c=> ({ el: c.el, key: c.key + ".cont", cont: c })));
  const st = doc.createElement("style"); st.id = "pp-style";
  st.textContent =
    "@page{ size:" + S.w + "px " + S.h + "px; margin:0 }\n" +
    "html,body{ margin:0 !important; padding:0 !important }\n" +
    "body > :not(.pp-book){ display:none !important }\n" +
    ".pp-sheet{ width:" + S.w + "px; height:" + S.h + "px; padding:" + B + "px; box-sizing:border-box; overflow:hidden; position:relative; " +
      "break-after:page; page-break-after:always; break-inside:avoid; page-break-inside:avoid; " +
      "display:flex; justify-content:center; align-items:flex-start }\n" +
    ".pp-sheet:last-child{ break-after:auto; page-break-after:auto }\n" +
    ".pp-fit{ flex:none }\n" +
    ".pp-fit > *{ margin:0 !important }\n" +
    // inside a sheet nothing may start another one
    ".pp-sheet *{ break-before:auto !important; page-break-before:auto !important; break-after:auto !important; page-break-after:auto !important }\n" +
    ".pp-sheet footer{ min-height:" + A.h + "px !important }\n" +
    // In print the interview's quote has a page; on the web it is held to 20ch,
    // three words a line, and no scale gives it print's room. On a sheet it
    // takes the sheet's width, as the printed page gives it.
    ".pp-sheet .bigquote{ max-width:none !important }\n" +
    // a Continued sheet: a running head, then the rest of the piece in two columns
    ".pp-cont-hd{ display:flex; flex-direction:column; gap:8px; margin:0 0 24px; padding-bottom:14px; border-bottom:2px solid currentColor }\n" +
    ".pp-cont-k, .pp-jump{ font-family:var(--mono); font-size:12px; letter-spacing:.14em; text-transform:uppercase; color:var(--pink) }\n" +
    ".pp-cont .pp-cont-t{ font-size:30px; line-height:1.04; margin:0 }\n" +
    ".pp-cont .pp-cont-body{ columns:2; column-gap:34px; max-width:none; font-size:15.5px; line-height:1.62 }\n" +
    ".pp-jump{ text-align:right; margin:12px 0 0 !important }";
  doc.head.appendChild(st);
  const book = doc.createElement("div"); book.className = "pp-book";
  const fits = units.map(un=>{
    const sheet = doc.createElement("div"); sheet.className = "pp-sheet";
    const fit = doc.createElement("div"); fit.className = "pp-fit";
    sheet.appendChild(fit); fit.appendChild(un.el); book.appendChild(sheet);
    return fit;
  });
  doc.body.insertBefore(book, doc.body.firstChild);
  try{ await doc.fonts.ready; }catch(e){}
  await Promise.all(Array.from(doc.images).map(im=> im.complete ? 0 : new Promise(r=>{ im.onload = im.onerror = r; })));
  // Long pieces: what the first sheet does not hold at its scale moves on to
  // the Continued sheet; one that fits leaves its Continued sheet out.
  if(!opts.measure){
    conts.forEach(c=>{
      const fit = fits[units.indexOf(c.main)];
      const z = c.z = pieceScale(fit, c, A, zooms[c.key] || capFor(c.key));
      fit.style.zoom = ""; fit.style.width = (A.w / z) + "px";
      const ok = ()=> fit.offsetHeight <= A.h / z + 0.5;
      if(ok()) return;
      c.jump.style.display = "";
      splitPiece(doc, c, ok);
      c.used = /\S/.test(c.body.textContent);
      if(!c.used) c.jump.style.display = "none";
    });
    for(let i = units.length - 1; i >= 0; i--){
      const c = units[i].cont;
      if(c && !c.used){ fits[i].parentElement.remove(); fits.splice(i, 1); units.splice(i, 1); }
    }
  }
  // Sections too long for one sheet at a readable size run on to more sheets,
  // divided between their blocks, as a magazine runs a feature over pages.
  // Readable is FLOW_MIN: the body's 15.5 px at 0.8 is 9.3 pt, the size the
  // printed edition has always set its body copy. Picture pages (NO_FLOW) keep
  // their shape and are scaled whole instead, so a strip is never cut.
  if(!opts.measure){
    for(let i = 0; i < units.length; i++){
      const un = units[i];
      if(NO_FLOW.test(un.key)) continue;
      const fit = fits[i], s = Math.min(FLOW_MIN, zooms[un.key] || capFor(un.key));
      fit.style.zoom = ""; fit.style.width = (A.w / s) + "px";
      const ok = ()=> fit.offsetHeight <= A.h / s + 0.5;
      if(ok()) continue;
      // a few lines over: a slightly smaller type (FLOW_SNUG) beats a near-empty sheet
      const s2 = s * FLOW_SNUG;
      fit.style.width = (A.w / s2) + "px";
      if(fit.offsetHeight <= A.h / s2 + 0.5){ un.cap = s2; continue; }
      fit.style.width = (A.w / s) + "px";
      const rest = splitFlow(un.el, ok);
      if(!rest) continue;
      un.cap = s;
      const sheet = doc.createElement("div"); sheet.className = "pp-sheet";
      const f2 = doc.createElement("div"); f2.className = "pp-fit";
      sheet.appendChild(f2); f2.appendChild(rest);
      fit.parentElement.after(sheet);
      units.splice(i + 1, 0, { el: rest, key: un.key, cap: s, part: (un.part || 1) + 1, cont: un.cont, of: un.of || un });
      fits.splice(i + 1, 0, f2);
    }
  }
  conts.forEach(c=>{
    const a = units.indexOf(c.main) + 1, b = units.findIndex(u=> u.cont === c) + 1;
    if(!b) return;
    c.jump.textContent = "Continued on sheet " + b + " →";
    c.head.textContent = "Continued from sheet " + a;
  });
  const bone = win.getComputedStyle(doc.body).backgroundColor;
  const laid = fits.map((fit, i)=>{
    const u = units[i].el, key = units[i].key, cap = units[i].cap || zooms[key] || capFor(key);
    // the sheet takes its section's ground, so a scaled section leaves no bare strip
    const bg = win.getComputedStyle(u).backgroundColor;
    fit.parentElement.style.background = (!bg || bg === "rgba(0, 0, 0, 0)" || bg === "transparent") ? bone : bg;
    // Two ways to fit a tall section: shrink it as laid out (keeps its columns),
    // or lay it out wider and shrink that (text reflows into the room). Take
    // whichever ends up bigger; plates with a fixed shape win the first way.
    // A width's scale is whatever makes BOTH its width and its height fit the
    // sheet, measured at that width: pictures with a fixed shape grow taller as
    // the column widens, so a scale found at one width is wrong at another.
    // A calibrated sheet starts from its scale and never goes above it.
    const own = conts.find(c=> c.main === units[i]);
    const best = bestFit(fit, u, A, cap, !NO_FLOW.test(key), own && own.used ? own.z : null);
    // zoom, not transform: print breaks pages on the laid-out height, and a
    // transform leaves that at full size — the sheet then clipped all but the top
    fit.style.width = best.w + "px";
    fit.style.zoom = best.s !== 1 ? String(best.s) : "";
    // centre what is painted, not the box: a row wider than its section would
    // otherwise hang off the right-hand side
    fit.style.marginLeft = best.wide > best.w + 0.5 ? (-(best.wide - best.w)) + "px" : "";
    const lead = units[i].of ? units[i].of.el : u, head = lead.querySelector(".sechead, h1, h2, .mast");
    const label = units[i].cont && !units[i].of ? "continued: " + units[i].cont.key.replace(/^voices\.(\d+)$/, (_, n)=> "voices, report " + (+n + 1))
        : /^voices\./.test(key) ? "voices, report " + (+key.split(".")[1] + 1)
        : lead.id || (lead.tagName === "FOOTER" ? "back cover" : lead.classList.contains("hero") ? "cover" : (head ? head.textContent.trim().slice(0, 30) : "section"));
    return { key, fit, unit: u, scale: best.s, cont: units[i].of ? null : units[i].cont, part: units[i].part || 1,
      label: units[i].part ? label + " (" + units[i].part + ")" : label };
  });
  laid.area = A;                                  // the trim, in px: what a sheet lays out
  return laid;
}

  /* ---- word limits: what a writer's piece may hold, on exactly these pages ----
     A piece's limit is measured, not estimated: its own text on its sheet is
     grown with words of its section until the sheet would overflow. The long
     pieces hold their first sheet and their Continued sheet, both at full size;
     every other piece holds its sheet at the size the sheet prints at (never
     below the run-on size, FLOW_MIN x FLOW_SNUG). The studio shows these numbers,
     and tools/press/limits.js writes them to press/<edition>/limits.json for the
     submissions desk. */
  var TOK = "⁣", TOK_RE = /⁣(\d+)⁣/g;   // invisible separator: survives esc() and rich()
  var WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}'’\-]*/gu;
  var PARA_WORDS = 45;                                   // grown copy comes in paragraphs, as writers write
  function countWords(s){ return (PLAIN(s).match(WORD_RE) || []).length; }
  function getPath(o, p){ return p.split(".").reduce(function(c, k){ return c == null ? c : c[k]; }, o); }
  function setPath(o, p, v){ var ks = p.split("."), c = o; for(var i = 0; i < ks.length - 1; i++) c = c[ks[i]]; c[ks[ks.length - 1]] = v; }
  // the writer's slot in each section: the copy a writer sends in, not the furniture around it
  function writerSlots(m){
    var out = [["letter", "letter.paragraphs"], ["contents", "contents.dek"], ["history", "history.paragraphs"]];
    ((m.voices && m.voices.reports) || []).forEach(function(_, i){ out.push(["voices", "voices.reports." + i + ".body"]); });
    out.push(["waitlist", "waitlist.dek"], ["interview", "interview.quote"], ["calendar", "calendar.dek"],
             ["directory", "directory.note"], ["lab", "lab.paragraphs"]);
    return out.filter(function(sl){ return getPath(m, sl[1]) != null; });
  }
  // a copy of m with each path's text tagged, so the measure can find it on the page
  function markModel(m, paths){
    var c = DB.clone(m);
    c.print = Object.assign({}, c.print, { marks: "off" });
    paths.forEach(function(p, k){
      var v = getPath(c, p), tag = TOK + k + TOK;
      if(Array.isArray(v)){ if(v.length) v[v.length - 1] = v[v.length - 1] + tag; }
      else if(typeof v === "string") setPath(c, p, v + tag);
    });
    return c;
  }
// How many words `target`'s piece can hold on its sheet printed at `zoom`: the
// sheet is laid out 1/zoom wider and taller, the piece grown until it overflows.
// null when the sheet overflows with the piece empty (its pictures fill it).
function sheetCapacity(fit, target, W, H, zoom, now, pool){
  const base = target.innerHTML;
  fit.style.zoom = ""; fit.style.width = (W / zoom) + "px";
  const ok = ()=> fit.offsetHeight <= H / zoom + 0.5;
  const fits = n=>{ let add = ""; for(let j=0; j<n; j++) add += " " + pool[j % pool.length]; target.innerHTML = base + add; return ok(); };
  let lim;
  try{
    if(!fits(0)){
      const words = target.textContent.trim().split(/\s+/);
      const cut = k=>{ target.textContent = words.slice(0, words.length - k).join(" "); return ok(); };
      let lo = 0, hi = words.length;
      if(!cut(hi)) return null;
      while(hi - lo > 1){ const mid = (lo + hi) >> 1; if(cut(mid)) hi = mid; else lo = mid; }
      lim = Math.max(0, now - hi);
    } else {
      let lo = 0, hi = 64;
      while(fits(hi) && hi < 40000){ lo = hi; hi *= 2; }
      while(hi - lo > 1){ const mid = (lo + hi) >> 1; if(fits(mid)) lo = mid; else hi = mid; }
      lim = now + lo;
    }
  } finally { target.innerHTML = base; }
  return lim;
}
// Words a sheet holds at `zoom` when `fill(n)` puts n words in the piece's place.
function growCapacity(fit, W, H, zoom, fill){
  fit.style.zoom = ""; fit.style.width = (W / zoom) + "px";
  const fits = n=>{ fill(n); return fit.offsetHeight <= H / zoom + 0.5; };
  if(!fits(0)) return null;
  let lo = 0, hi = 64;
  while(fits(hi) && hi < 40000){ lo = hi; hi *= 2; }
  while(hi - lo > 1){ const mid = (lo + hi) >> 1; if(fits(mid)) lo = mid; else hi = mid; }
  return lo;
}
// n words of `pool` in paragraphs: into `first` (after anything in `keep`), then
// new paragraphs before `before` in first's parent; `one` keeps them in one
// paragraph (a report is one paragraph on the web)
function paraFill(first, keep, before, pool, one){
  const made = [];
  return n=>{
    made.forEach(p=> p.remove()); made.length = 0;
    Array.from(first.childNodes).forEach(x=>{ if(keep.indexOf(x) < 0) x.remove(); });
    let j = 0;
    const take = k=>{ const w = []; for(; k > 0; k--, j++) w.push(pool[j % pool.length]); return w.join(" "); };
    const size = one ? n : PARA_WORDS;
    first.appendChild(first.ownerDocument.createTextNode((keep.length ? " " : "") + take(Math.min(n, size))));
    while(j < n){
      const p = first.ownerDocument.createElement("p"); p.textContent = take(Math.min(n - j, PARA_WORDS));
      first.parentNode.insertBefore(p, before); made.push(p);
    }
  };
}
// Measure the writers' pieces on `sheets` (paginate(..., { measure: true }) of
// markModel(model, paths)). Returns [{ section, path, now, limit, pages?, scale }].
async function measurePieces(doc, sheets, model, slots){
  var A = sheets.area, paths = slots.map(function(s){ return s[1]; });
  var targets = {}, hits = [];
  var tw = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  for(var n = tw.nextNode(); n; n = tw.nextNode()) if(n.nodeValue.indexOf(TOK) >= 0) hits.push(n);
  hits.forEach(function(n){
    var mm; TOK_RE.lastIndex = 0;
    while((mm = TOK_RE.exec(n.nodeValue))) targets[paths[+mm[1]]] = n.parentElement;
    n.nodeValue = n.nodeValue.replace(TOK_RE, "");
  });
  var bySheet = {}; sheets.forEach(function(sh){ if(!bySheet[sh.key]) bySheet[sh.key] = sh; });
  var out = [];
  for(var i = 0; i < slots.length; i++){
    // one piece at a time, giving the page a turn between them
    await new Promise(function(r){ setTimeout(r, 0); });
    var sec = slots[i][0], path = slots[i][1];
    var target = targets[path], sh = bySheet[pieceSheet(path)];
    if(!target || !sh || !sh.fit.contains(target)) continue;
    var now = countWords([].concat(getPath(model, path) || []).join(" "));
    var pool = PLAIN(sh.unit.textContent).match(WORD_RE) || ["word"];
    var csh = bySheet[sh.key + ".cont"];
    if(csh && csh.cont){
      var c = csh.cont, single = c.box.tagName === "P";
      var first = single ? c.box : Array.from(c.box.children).find(function(x){ return x !== c.jump && x.tagName === "P"; });
      if(!first) continue;
      if(!single) Array.from(c.box.children).forEach(function(x){ if(x !== first && x !== c.jump) x.remove(); });
      var drop = Array.from(first.children).filter(function(x){ return x.classList.contains("drop"); });
      c.jump.style.display = "";
      var fillMain = paraFill(first, drop, single ? null : c.jump, pool, single);
      fillMain(0);
      var z1 = pieceScale(sh.fit, c, A, TEXT_SCALE);
      var F = growCapacity(sh.fit, A.w, A.h, z1, fillMain);
      c.body.innerHTML = "<p></p>";
      var C = growCapacity(csh.fit, A.w, A.h, TEXT_SCALE, paraFill(c.body.firstChild, [], null, pool, false));
      if(F == null || C == null) continue;
      out.push({ section: sec, path: path, now: now, limit: F + C, pages: [F, C], scale: +z1.toFixed(4) });
    } else {
      var z = Math.min(TEXT_SCALE, Math.max(sh.scale, FLOW_MIN * FLOW_SNUG));
      var lim = sheetCapacity(sh.fit, target, A.w, A.h, z, now, pool);
      if(lim == null) continue;
      out.push({ section: sec, path: path, now: now, limit: lim, scale: +z.toFixed(4) });
    }
  }
  return out;
}
const FLOW_MIN = 0.8;
// One body size for the whole magazine: text pages print at TEXT_SCALE of the
// website's type (15.5 px x 0.8: 9.3 pt, near the 8.8 pt the printed edition
// has always set its body in) and never larger, so a short section does not
// come out in bigger type than its neighbour. Covers and picture pages fill
// their sheet instead.
const TEXT_SCALE = FLOW_MIN;
function capFor(key){ return NO_FLOW.test(key) ? 1 : TEXT_SCALE; }
const FLOW_SNUG = 0.92;          // 0.8 x 0.92: 8.6 pt, still the printed edition's body size
const NO_FLOW = /^(hero|footer|comics|art|stickers)$/;
// The part of `unit` that does not fit (`ok()` false) moved into a copy of it,
// returned as a unit of its own; null if nothing could move. Blocks move from
// the end until the rest fits; one block that is itself too tall is divided the
// same way, one level down (a two-column grid gives up its last column first,
// a list its last items). A block that moved whole but would half fit comes back
// and gives up only its tail, so each sheet goes as full as it can.
function splitFlow(unit, ok){
  const kids = E=> Array.from(E.children).filter(k=>{
    const cs = k.ownerDocument.defaultView.getComputedStyle(k);
    return cs.display !== "none" && cs.position !== "absolute" && cs.position !== "fixed";
  });
  const shell = E=>{ const c = E.cloneNode(false); c.removeAttribute("id"); return c; };
  function tail(E, into){
    const ks = kids(E);
    while(!ok() && ks.length > 1) into.insertBefore(ks.pop(), into.firstChild);
    let k;
    if(ok()){
      k = into.firstElementChild;                    // the last block to move: can part of it stay?
      if(!k || kids(k).length < 2) return;
      E.appendChild(k);
      if(ok()) return;                                 // it fits after all (the layout changed)
    } else {
      k = ks[0];
      if(!k || kids(k).length < 2) return;             // one block, indivisible: the sheet will shrink it
    }
    const kc = shell(k);
    into.insertBefore(kc, into.firstChild);
    tail(k, kc);
    if(!kc.firstChild) kc.remove();
    if(!kids(k).length && !/\S/.test(k.textContent)) { into.insertBefore(k, kc.nextSibling || null); if(kc.parentNode) kc.remove(); }
  }
  const rest = shell(unit);
  tail(unit, rest);
  return rest.firstChild ? rest : null;
}
// The scale `u` prints at on a sheet whose trim is A (px), never above `cap`, and
// the width it is laid out at. Two ways to fit a tall section: shrink it as laid
// out (keeps its columns), or lay it out wider and shrink that (text reflows into
// the room); whichever ends up bigger. A width's scale is whatever makes BOTH its
// width and its height fit, measured at that width: pictures with a fixed shape
// grow taller as the column widens, so a scale found at one width is wrong at another.
function bestFit(fit, u, A, cap, flowable, hint){
  const at = w=>{ fit.style.width = w + "px"; fit.style.zoom = "";
    // content wider than its box (a row of cards that will not wrap) counts too
    const wide = Math.max(w, fit.scrollWidth, u.scrollWidth);
    return { w, wide, s: Math.min(cap, A.w / wide, A.h / fit.offsetHeight) }; };
  let best = at(A.w / cap);
  // the width the run-on check measures at: a section that passed it fits at FLOW_MIN there
  if(flowable){ const f = at(A.w / Math.min(cap, FLOW_MIN)); if(f.s > best.s) best = f; }
  // a scale the sheet is known to fit at (a long piece was split to it)
  if(hint && hint < cap){ const f = at(A.w / hint); if(f.s > best.s) best = f; }
  for(let k = 0, s = best.s; k < 5 && s < cap - 0.001; k++){
    const c = at(A.w / s);
    if(c.s > best.s) best = c;
    if(Math.abs(c.s - s) < 0.004) break;
    s = Math.max(c.s, best.s * 0.98);             // walk toward the width that fits
  }
  return best;
}
// The scale a long piece's first sheet prints at: what the sheet needs with the
// piece taken out (the rest of the page is what it is). The piece then gets
// whatever room is left at that scale, and the rest goes to its Continued sheet.
function pieceScale(fit, c, A, cap){
  const held = [];
  Array.from(c.box.childNodes).forEach(n=>{ if(n !== c.jump){ held.push([n, n.nextSibling]); } });
  const frag = c.box.ownerDocument.createDocumentFragment();
  held.forEach(h=> frag.appendChild(h[0]));
  const jd = c.jump.style.display; c.jump.style.display = "";
  const z = bestFit(fit, c.main.el, A, cap, false).s;
  c.jump.style.display = jd;
  held.forEach(h=> c.box.insertBefore(h[0], c.box.contains(h[1]) ? h[1] : (c.box.tagName === "P" ? null : c.jump)));
  return z;
}
// A long piece's text on its sheet: the report's paragraph, or the section's prose
function pieceBox(unit, path){
  return /^voices\./.test(path) ? unit.querySelector(".report .bd > p") : unit.querySelector(".prose");
}
function pieceTitle(unit, path){
  const h = /^voices\./.test(path) ? unit.querySelector(".report h3") : unit.querySelector("h2, h3");
  if(!h) return path;
  const c = h.cloneNode(true); c.querySelectorAll("br").forEach(b=> b.replaceWith(" "));   // a headline's line breaks are spaces
  return PLAIN(c.textContent).replace(/\s+/g, " ").trim();
}
// where each word in `el` starts, as [text node, offset]; a word split across
// markup ("<b>bread</b>s") starts once
function wordStarts(el){
  const out = [], tw = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let gap = true;
  for(let n = tw.nextNode(); n; n = tw.nextNode()){
    const t = n.nodeValue, re = /\S+/g;
    for(let mm; (mm = re.exec(t)); ){ if(mm.index > 0 || gap) out.push([n, mm.index]); }
    if(t.length) gap = /\s$/.test(t);
  }
  return out;
}
// Move the tail of c's piece onto its Continued sheet until `ok()` (the first
// sheet fits): whole paragraphs from the end, then the paragraph on the edge
// word by word. Range.extractContents splits the markup too, so a link or an
// emphasis that runs over the break is closed on one sheet and reopened on the next.
function splitPiece(doc, c, ok){
  const single = c.box.tagName === "P";
  const paras = single ? [c.box] : Array.from(c.box.children).filter(p=> p !== c.jump);
  while(!ok() && paras.length > 1) c.body.insertBefore(paras.pop(), c.body.firstChild);
  let B;
  if(ok()){
    B = c.body.firstElementChild;
    if(!B) return;
    c.box.insertBefore(B, c.jump); paras.push(B);            // back, to be split word by word
  } else B = paras[paras.length - 1];
  const html = B.innerHTML, n = wordStarts(B).length;
  const cut = k=>{
    B.innerHTML = html;
    const at = wordStarts(B)[k];
    if(!at) return null;
    const r = doc.createRange(); r.setStart(at[0], at[1]); r.setEnd(B, B.childNodes.length);
    return r.extractContents();
  };
  let lo = 0, hi = n;
  while(hi - lo > 1){ const mid = (lo + hi) >> 1; cut(mid); if(ok()) lo = mid; else hi = mid; }
  if(lo === 0 && B !== c.box){ B.innerHTML = html; c.body.insertBefore(B, c.body.firstChild); return; }
  const tail = cut(lo);
  if(!tail) return;
  const p = doc.createElement("p"); p.appendChild(tail);
  c.body.insertBefore(p, c.body.firstChild);
}
// which part of the magazine a page unit is: a schema section id, "hero" or "footer"
function unitKey(u, m){
  if(u.classList.contains("hero")) return "hero";
  if(u.tagName === "FOOTER") return "footer";
  if(u.id && DB.SCHEMA.some(s=> s.id === u.id)) return u.id;
  if(u.classList.contains("tight")) return "interview";
  const t = PLAIN(u.textContent);
  if(m.waitlist && m.waitlist.title && t.indexOf(PLAIN(m.waitlist.title)) >= 0) return "waitlist";
  if(m.interview && m.interview.attrib && t.indexOf(PLAIN(m.interview.attrib)) >= 0) return "interview";
  return "section";
}

  var api = { paginate: paginate, sheetPx: sheetPx, unitKey: unitKey, pieceSheet: pieceSheet, pieceBox: pieceBox,
              pieceTitle: pieceTitle, wordStarts: wordStarts, splitPiece: splitPiece, longPieces: longPieces, PLAIN: PLAIN,
              writerSlots: writerSlots, markModel: markModel, measurePieces: measurePieces, sheetCapacity: sheetCapacity,
              countWords: countWords, WORD_RE: WORD_RE, TOK: TOK, TOK_RE: TOK_RE, getPath: getPath };
  root.DBPrint = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
