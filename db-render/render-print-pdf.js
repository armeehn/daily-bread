/**
 * render-print-pdf.js — render a standalone <doc-page> print layout (e.g.
 * "Daily Bread Issue 01-print.html") to a print-ready PDF via headless Chromium.
 *
 *   node render-print-pdf.js "<html file in this dir>" "<out.pdf>"
 *
 * Serves THIS directory over http (doc-page.js/image-slot.js are siblings; the
 * kit's fetches break under file://), waits until doc-page.js has upgraded and
 * injected its <style id="doc-page-print"> (= @page{size:297mm 210mm;margin:0},
 * i.e. A4 landscape), fonts have loaded, and images decoded, then prints with
 * page.pdf({preferCSSPageSize:true, printBackground:true, margin:0}) so the CSS
 * @page size is honoured (A4 landscape) instead of the Letter default.
 *
 * Fonts: by default the page fetches the real Google Fonts (what the reference
 * PDF used — matches its metrics/line-breaks exactly; CI runners have network).
 * Set VENDOR_FONTS=1 to instead serve ./vendor/fonts.css (deterministic + works
 * offline, e.g. a sandbox with no Google Fonts access — but slightly different
 * tracking than the reference).
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const KIT = __dirname;
const FILE = process.argv[2];
const OUT = process.argv[3];
if (!FILE || !OUT) { console.error("usage: node render-print-pdf.js <htmlFile> <out.pdf>"); process.exit(2); }

const VENDOR = path.join(KIT, "vendor");
const useVendor = process.env.VENDOR_FONTS === "1" && fs.existsSync(path.join(VENDOR, "fonts.css"));
const PORT = 8479;
const TYPES = { ".html":"text/html; charset=utf-8", ".js":"application/javascript", ".css":"text/css",
  ".svg":"image/svg+xml", ".png":"image/png", ".jpg":"image/jpeg", ".jpeg":"image/jpeg",
  ".json":"application/json", ".woff2":"font/woff2", ".woff":"font/woff" };

const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split("?")[0]);
  if (rel === "/") rel = "/index.html";
  const file = path.join(KIT, rel);
  if (!file.startsWith(KIT)) { res.writeHead(403); return res.end("no"); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("404"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(buf);
  });
});

server.listen(PORT, "127.0.0.1", async () => {
  const url = `http://127.0.0.1:${PORT}/${encodeURIComponent(FILE)}`;
  console.log("rendering", FILE, "(vendor fonts:", useVendor + ")");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

  if (useVendor) {
    await page.route("**/*", route => {
      const u = route.request().url();
      if (/fonts\.googleapis\.com\/css2/.test(u))
        return route.fulfill({ status: 200, contentType: "text/css", body: fs.readFileSync(path.join(VENDOR, "fonts.css")) });
      const ff = u.match(/fonts\.googleapis\.com\/.*?\/files\/([\w.-]+\.(woff2?))$/);
      if (ff) { const p = path.join(VENDOR, "files", ff[1]);
        return fs.existsSync(p) ? route.fulfill({ status: 200, contentType: "font/" + ff[2], body: fs.readFileSync(p) })
                                : route.fulfill({ status: 404, body: "" }); }
      if (/fonts\.gstatic\.com/.test(u)) return route.abort();
      return route.continue();
    });
  }

  await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });

  // Ready = doc-page upgraded and its @page rule injected + fonts + images.
  const statusFn = () => {
    const st = document.getElementById("doc-page-print");
    const pageRuleLive = !!st && /@page/.test(st.textContent || "") && /\bsize\s*:/.test(st.textContent || "");
    const defined = !!(window.customElements && customElements.get("doc-page"));
    const pages = document.querySelectorAll(".page").length;
    const badImgs = Array.from(document.images).filter(i => !(i.complete && i.naturalWidth > 0)).length;
    const fontsOk = document.fonts.status === "loaded"
      && document.fonts.check('16px "IBM Plex Mono"')
      && document.fonts.check("600 16px Caveat")
      && document.fonts.check("16px UnifrakturMaguntia");
    return { defined, pageRuleLive, pages, badImgs, fontsOk,
      ok: defined && pageRuleLive && pages > 0 && badImgs === 0 && fontsOk };
  };
  let last = null, stable = 0, prev = -1;
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    last = await page.evaluate(statusFn);
    if (last.ok) { stable = (last.pages === prev) ? stable + 1 : 1; prev = last.pages; if (stable >= 3) break; }
    else { stable = 0; prev = -1; }
    await page.waitForTimeout(1000);
  }
  console.log("ready:", JSON.stringify(last), stable >= 3 ? "STABLE" : "NOT-STABLE");
  if (stable < 3) { console.error("render not ready"); await browser.close(); server.close(); process.exit(1); }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await page.pdf({ path: OUT, printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  console.log("wrote", OUT);
  await browser.close();
  server.close();
  process.exit(0);
});
server.on("error", e => { console.error("BIND ERR", e.code); process.exit(1); });
