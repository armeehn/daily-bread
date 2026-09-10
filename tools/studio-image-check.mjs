#!/usr/bin/env node
// Studio cover upload must survive a phone-sized photo.
//
// Every edition lives in ONE localStorage key (~5 MB per origin). A raw
// camera JPEG embedded as a data: URL blows that cap on its own, so the
// studio must shrink what it embeds. Runs inside LXC 111 only (playwright).
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFileSync } from "node:fs";

const MCP_MODULES = "/usr/lib/node_modules/@playwright/mcp/node_modules/";
const CHROME = "/home/user/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome";
const PHOTO_EDGE_PX = 4000;               // a 12 MP phone photo, several MB
const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "studio.html");
const MAX_EMBED_CHARS = 1_500_000;        // what one embedded image may cost the shelf

const { chromium } = createRequire(MCP_MODULES)("playwright-core");
const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage();
await page.goto("file://" + STUDIO);

// a phone-sized photo: the repo cover (1500x1000) upscaled and re-encoded
// at q=1 in-page (node has no JPEG encoder), plus grain so it stays heavy
const cover = "data:image/jpeg;base64," + readFileSync(path.join(path.dirname(STUDIO), "assets/cover.jpg")).toString("base64");
const dataUrl = await page.evaluate(async ([edge, cover]) => {
  const img = new Image(); img.src = cover; await img.decode();
  const c = document.createElement("canvas");
  c.width = edge; c.height = Math.round(edge * img.height / img.width);
  const ctx = c.getContext("2d"); ctx.drawImage(img, 0, 0, c.width, c.height);
  const px = ctx.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < px.data.length; i += 4) { const g = (Math.random() * 24 - 12) | 0; px.data[i] += g; px.data[i+1] += g; px.data[i+2] += g; }
  ctx.putImageData(px, 0, 0);
  return c.toDataURL("image/jpeg", 1);
}, [PHOTO_EDGE_PX, cover]);
const buffer = Buffer.from(dataUrl.split(",")[1], "base64");
console.log("photo bytes:", buffer.length);

// the first image field is the cover; its button arms #fileImage
// (the accordion is collapsed, so click in-page rather than by pointer)
await page.evaluate(() => document.querySelector(".imgrow .btn2").click());
await page.locator("#fileImage").setInputFiles({ name: "cover.jpg", mimeType: "image/jpeg", buffer });

await page.waitForFunction(() => /Saved|Storage/.test(document.querySelector("#status").textContent));
const status = await page.evaluate(() => document.querySelector("#status").textContent);
const embedded = await page.evaluate(() => (model.hero.coverSrc || "").length);
await browser.close();

console.log("status:", status, "| embedded chars:", embedded);
const ok = status.startsWith("Saved") && embedded > 0 && embedded <= MAX_EMBED_CHARS;
console.log(ok ? "PASS" : "FAIL");
process.exit(ok ? 0 : 1);
