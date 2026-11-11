#!/usr/bin/env node
/**
 * check-a11y.js — sweep the built pages with axe-core, laid out as a reader's
 * browser lays them out. check-site.js reads the markup; this reads what is
 * painted: text against its real ground, names, landmarks, headings.
 *
 *   node tools/check-a11y.js [page ...]      e.g. node tools/check-a11y.js /fr/
 *
 * Each tab of a page is opened in turn, at a desktop and a phone width: a pane
 * that is not the :target is display:none, and axe cannot see it.
 *
 * The sixteen languages share one stylesheet, so English in its three
 * renderings, one right-to-left edition and the hand-written verify page reach
 * every rule. Needs the browser driver tools/press pins:
 *
 *   cd tools/press && npm ci
 *
 * Exit code: 0 clean, 1 on any violation.
 */
"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");

const ROOT = path.join(__dirname, "..");
const pressRequire = createRequire(path.join(__dirname, "press", "package.json"));
const { chromium } = pressRequire("playwright");
const AXE_SOURCE = fs.readFileSync(pressRequire.resolve("axe-core/axe.min.js"), "utf8");

const DEFAULT_PAGES = ["/", "/lite/", "/eink/", "/ar/", "/verify/"];
const WIDTHS = [1280, 390];                 // the desktop grid, and a phone
const VIEWPORT_HEIGHT = 844;
const TAB_LINKS = '.rail a[href^="#"]';     // the contents rail: one link a pane
const PANES = ".pane";
// The page at rest. The site eases link colours over 150ms and scrolls smoothly
// to a new :target; axe run mid-ease reads a colour or a position no reader ends
// up with, and the same pages passed one run and failed the next.
const STILL_CSS = "*,*::before,*::after{transition:none!important;animation:none!important;scroll-behavior:auto!important}";
// two frames: a :target change is styled in the first and painted by the second
const NEXT_PAINT = "new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))";
const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;
const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2",
};

// The repo root over HTTP: file:// would 404 every root-relative asset.
function serve() {
  const server = http.createServer((req, res) => {
    let file = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));

    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      file = path.join(file, "index.html");
    }

    if (!file.startsWith(ROOT) || !fs.existsSync(file)) {
      res.writeHead(HTTP_NOT_FOUND);
      res.end();
      return;
    }

    res.writeHead(HTTP_OK, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });

  return new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve(server)));
}

// One page at one width: every tab in turn. A node that fails on several tabs
// (the top bar, the rail) is reported once.
async function sweep(browser, base, pagePath, width) {
  const page = await browser.newPage({ viewport: { width, height: VIEWPORT_HEIGHT } });
  const response = await page.goto(base + pagePath, { waitUntil: "load" });

  if (!response || response.status() !== HTTP_OK) {
    await page.close();
    throw new Error(pagePath + " did not load: HTTP " + (response && response.status()));
  }

  await page.addStyleTag({ content: STILL_CSS });
  await page.evaluate(() => document.fonts.ready);

  const tabs = await page.$$eval(TAB_LINKS, links => [...new Set(links.map(a => a.getAttribute("href")))]);
  const panes = await page.$$eval(PANES, all => all.length);
  const found = new Map();

  // a rail that has lost a link would leave a pane unswept, and still say clean
  if (panes !== tabs.length) {
    await page.close();
    throw new Error(pagePath + " has " + panes + " pane(s) and " + tabs.length + " tab link(s): the sweep would miss a pane");
  }

  for (const tab of ["", ...tabs]) {
    if (tab) {
      await page.evaluate(hash => { location.hash = hash; }, tab);
      await page.evaluate(NEXT_PAINT);
    }

    // a closed <details> hides its menu from axe; a reader opens it
    await page.$$eval("details", all => all.forEach(details => { details.open = true; }));
    await page.evaluate(AXE_SOURCE);
    const result = await page.evaluate(() => axe.run(document, { resultTypes: ["violations"] }));

    for (const violation of result.violations) {
      for (const node of violation.nodes) {
        const selector = node.target.join(" ");
        const why = (node.failureSummary || "").split("\n")[1] || violation.help;
        found.set(violation.id + " " + selector, { rule: violation.id, impact: violation.impact, selector, why: why.trim() });
      }
    }
  }

  await page.close();
  return { pagePath, width, tabs: tabs.length + 1, problems: [...found.values()] };
}

// "color-contrast ×146" with a few examples reads better than 146 lines.
function report(result) {
  const where = result.pagePath + " @" + result.width + "px";

  if (!result.problems.length) {
    console.log("  ✓ " + where + " — " + result.tabs + " tab(s) clean");
    return;
  }

  const EXAMPLES = 3;
  const byRule = new Map();

  for (const problem of result.problems) {
    byRule.set(problem.rule, (byRule.get(problem.rule) || []).concat(problem));
  }

  console.log("  ✗ " + where);

  for (const [rule, problems] of byRule) {
    console.log("      " + rule + " ×" + problems.length + " (" + problems[0].impact + ")");

    for (const problem of problems.slice(0, EXAMPLES)) {
      console.log("        " + problem.selector + " — " + problem.why);
    }
  }
}

async function main() {
  const pages = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_PAGES;
  const server = await serve();
  const browser = await chromium.launch();
  const base = "http://127.0.0.1:" + server.address().port;
  let total = 0;

  for (const pagePath of pages) {
    for (const width of WIDTHS) {
      const result = await sweep(browser, base, pagePath, width);
      report(result);
      total += result.problems.length;
    }
  }

  await browser.close();
  server.close();

  if (total) {
    console.log("a11y sweep: " + total + " problem(s)");
    process.exit(1);
  }

  console.log("a11y sweep: clean");
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
