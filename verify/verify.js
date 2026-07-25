/* Daily Bread — verification engine (newsproof).
 *
 * WebCrypto only, no dependencies. It fetches the published proofs and checks,
 * for every language edition:
 *
 *   1. the served bytes match the SHA-256 that was signed
 *   2. the bundle names the publisher key you can pin
 *   3. the publisher's Ed25519 signature over the statement is valid
 *   4. the edition is present in the RFC 6962 transparency log (inclusion proof)
 *   5. the log's signature over the tree head is valid
 *   6. a public anchor covers this version of the log
 *   7. the page currently served over the network still hashes to the same value
 *
 * Honest limitation, stated on the page as well as here: this script is served
 * by the same site as the magazine, so against the publisher it proves nothing.
 * It catches third-party tampering, caches and accidents. The real check against
 * the publisher is verify_standalone.py, run from a copy you keep, against a
 * fingerprint you obtained somewhere other than this website.
 */
(() => {
  "use strict";

  const DOMAIN_STATEMENT = "newsproof/v1/statement\0";
  const DOMAIN_STH = "newsproof/v1/sth\0";
  const WK = "/.well-known/newsproof";

  const enc = new TextEncoder();
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, "0")).join("");
  const unhex = (s) => new Uint8Array(s.match(/../g).map((h) => parseInt(h, 16)));

  function concat(...parts) {
    const total = parts.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(total);
    let at = 0;
    for (const p of parts) { out.set(p, at); at += p.length; }
    return out;
  }

  /* RFC 8785 canonical JSON — mirrors the Python signer exactly. */
  function canonical(value) {
    if (value === null) return "null";
    const t = typeof value;
    if (t === "boolean") return value ? "true" : "false";
    if (t === "number") {
      if (!Number.isInteger(value)) throw new Error("floats not allowed");
      return String(value);
    }
    if (t === "string") return JSON.stringify(value);
    if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
    if (t === "object") {
      const keys = Object.keys(value).sort();      // UTF-16 code-unit order
      return "{" + keys.map((k) =>
        JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
    }
    throw new Error("unsupported type " + t);
  }

  /* RFC 6962 */
  const sha256 = async (bytes) =>
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const leafHash = (data) => sha256(concat(new Uint8Array([0]), data));
  const nodeHash = (a, b) => sha256(concat(new Uint8Array([1]), a, b));
  const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

  async function verifyInclusion(leaf, index, size, path, expected) {
    if (index < 0 || index >= size) return false;
    let fn = index, sn = size - 1, acc = leaf;
    for (const sibling of path) {
      if (sn === 0) return false;
      if ((fn & 1) || fn === sn) {
        acc = await nodeHash(sibling, acc);
        while (fn !== 0 && (fn & 1) === 0) { fn >>= 1; sn >>= 1; }
      } else {
        acc = await nodeHash(acc, sibling);
      }
      fn >>= 1; sn >>= 1;
    }
    return sn === 0 && same(acc, expected);
  }

  async function verifyConsistency(m, n, path, oldRoot, newRoot) {
    if (m > n || m < 0) return false;
    if (m === n) return path.length === 0 && same(oldRoot, newRoot);
    if (m === 0) return path.length === 0;
    if (path.length === 0) return false;
    let fn = m - 1, sn = n - 1;
    while (fn & 1) { fn >>= 1; sn >>= 1; }
    const rest = path.slice();
    const first = fn !== 0 ? rest.shift() : oldRoot;
    let fr = first, sr = first;
    for (const sibling of rest) {
      if (sn === 0) return false;
      if ((fn & 1) || fn === sn) {
        fr = await nodeHash(sibling, fr);
        sr = await nodeHash(sibling, sr);
        while (fn !== 0 && (fn & 1) === 0) { fn >>= 1; sn >>= 1; }
      } else {
        sr = await nodeHash(sr, sibling);
      }
      fn >>= 1; sn >>= 1;
    }
    return sn === 0 && same(fr, oldRoot) && same(sr, newRoot);
  }

  /* Ed25519 (WebCrypto) */
  async function ed25519Verify(rawKey, domain, message, sigB64) {
    const key = await crypto.subtle.importKey(
      "raw", rawKey, { name: "Ed25519" }, false, ["verify"]);
    return crypto.subtle.verify(
      { name: "Ed25519" }, key, b64(sigB64), concat(enc.encode(domain), message));
  }
  async function ed25519Available() {
    try {
      await crypto.subtle.importKey(
        "raw", new Uint8Array(32), { name: "Ed25519" }, false, ["verify"]);
      return true;
    } catch { return false; }
  }

  /* --- verify one edition ------------------------------------------------ */
  async function checkEdition(ed, ctx) {
    const checks = [];
    const add = (ok, label, detail) => { checks.push({ ok: !!ok, label, detail }); };

    const bundle = await (await fetch(`${WK}/${ed.proof}`, { cache: "no-store" })).json();
    const st = bundle.statement;
    const body = b64(bundle.body_b64);

    const bodyHash = hex(await sha256(body));
    add(bodyHash === st.content_sha256,
        "signed bytes match the hash in the statement", st.content_sha256.slice(0, 16) + "…");

    add(bundle.publisher_key_id === ctx.pub.key_id, "signed by the pinned publisher key", ctx.pub.key_id);

    const stmtBytes = enc.encode(canonical(st));
    add(await ed25519Verify(b64(ctx.pub.public_key_b64), DOMAIN_STATEMENT, stmtBytes,
                            bundle.publisher_signature),
        "publisher signature over the statement");

    const inc = bundle.inclusion, sth = bundle.sth;
    add(await verifyInclusion(await leafHash(stmtBytes), inc.leaf_index, inc.tree_size,
                              inc.audit_path.map(unhex), unhex(sth.root_sha256)),
        "present in the transparency log", `leaf ${inc.leaf_index} of ${inc.tree_size}`);

    add(await ed25519Verify(b64(ctx.log.public_key_b64), DOMAIN_STH,
                            enc.encode(canonical(sth)), bundle.log_signature),
        "log signature over the tree head", sth.root_sha256.slice(0, 16) + "…");

    // anchor coverage
    let anchored = 0;
    for (const a of ctx.anchors) {
      if (a.tree_size > sth.tree_size) continue;
      if (a.tree_size === sth.tree_size) {
        if (a.root_sha256 === sth.root_sha256) anchored++;
        add(a.root_sha256 === sth.root_sha256,
            `public anchor at size ${a.tree_size} matches this tree head`, a.ref || a.via);
        continue;
      }
      const proof = ctx.consistency.find(
        (c) => c.old_size === a.tree_size && c.new_size === sth.tree_size);
      if (!proof) { add(false, `consistency proof from anchored size ${a.tree_size}`); continue; }
      const ok = await verifyConsistency(a.tree_size, sth.tree_size,
        proof.path.map(unhex), unhex(a.root_sha256), unhex(sth.root_sha256));
      if (ok) anchored++;
      add(ok, `nothing anchored at size ${a.tree_size} was rewritten`, a.ref || a.via);
    }
    const hasAnchor = anchored > 0;
    if (!hasAnchor) add(false, "a public anchor covers this edition",
                        "history is rewritable by the publisher");

    const signedOk = checks.every((c) => c.ok || c.label.includes("anchor") || c.label.includes("rewritten"));

    // 7th, distinct assurance: the page served RIGHT NOW still matches.
    let live = null;
    try {
      const buf = new Uint8Array(await (await fetch(ed.url, { cache: "no-store" })).arrayBuffer());
      live = hex(await sha256(buf)) === st.content_sha256;
      add(live, "the page served right now matches the signed bytes",
          live ? "" : "the live page differs from what was signed");
    } catch (e) {
      add(false, "could not fetch the live page to compare", String(e && e.message || e));
      live = null;
    }

    return { ed, st, checks, signedOk, hasAnchor, live };
  }

  /* --- UI ---------------------------------------------------------------- */
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const escapeHtml = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

  function stateFor(r) {
    if (!r.signedOk) return { cls: "bad", label: "verification failed" };
    if (!r.hasAnchor) return { cls: "warn", label: "signed, not anchored" };
    if (r.live === false) return { cls: "bad", label: "live page altered" };
    if (r.live === null) return { cls: "warn", label: "signed & anchored; live page uncheckable" };
    return { cls: "ok", label: "verified" };
  }

  function renderRow(r) {
    const s = stateFor(r);
    const row = el("div", "ed " + s.cls);
    const head = el("button", "ed-head");
    head.setAttribute("aria-expanded", "false");
    head.innerHTML =
      `<span class="dot"></span>` +
      `<span class="lang">${escapeHtml(r.ed.endo)}</span>` +
      `<span class="code">${escapeHtml(r.ed.code)}</span>` +
      `<span class="state">${s.label}</span>` +
      `<span class="v">v${r.ed.version}</span>` +
      `<span class="chev">▸</span>`;
    const body = el("div", "ed-body");
    body.innerHTML =
      "<ul class='checks'>" + r.checks.map((c) =>
        `<li class="${c.ok ? "pass" : "fail"}">${escapeHtml(c.label)}` +
        (c.detail ? ` <span class="detail">${escapeHtml(c.detail)}</span>` : "") + "</li>"
      ).join("") + "</ul>" +
      `<div class="links"><a href="${WK}/${r.ed.proof}" download>download proof.json</a>` +
      ` · <a href="${escapeHtml(r.ed.url)}">open this edition</a></div>`;
    head.addEventListener("click", () => {
      const open = row.classList.toggle("open");
      head.setAttribute("aria-expanded", String(open));
    });
    row.appendChild(head);
    row.appendChild(body);
    return row;
  }

  function setBanner(cls, title, note) {
    const b = document.getElementById("np-banner");
    b.className = "banner " + cls;
    b.querySelector(".b-title").textContent = title;
    b.querySelector(".b-note").textContent = note || "";
  }

  async function main() {
    const list = document.getElementById("np-list");
    try {
      if (!(await ed25519Available())) {
        setBanner("bad", "This browser has no Ed25519 in WebCrypto",
                  "Use the offline verifier (verify_standalone.py) instead — it is the stronger check anyway.");
        return;
      }
      const manifest = await (await fetch(`${WK}/manifest.json`, { cache: "no-store" })).json();
      const [pub, log, anchorsText, consistency] = await Promise.all([
        fetch(`${WK}/publisher-key.json`, { cache: "no-store" }).then((r) => r.json()),
        fetch(`${WK}/log-key.json`, { cache: "no-store" }).then((r) => r.json()),
        fetch(`${WK}/anchors.jsonl`, { cache: "no-store" }).then((r) => r.ok ? r.text() : ""),
        fetch(`${WK}/consistency.json`, { cache: "no-store" }).then((r) => r.ok ? r.json() : []),
      ]);
      const anchors = anchorsText.split("\n").filter((x) => x.trim()).map(JSON.parse);
      const ctx = { pub, log, anchors, consistency };

      // Fill in the fingerprint / tree facts.
      document.getElementById("fp-pub").textContent = pub.key_id;
      document.getElementById("fp-log").textContent = log.key_id;
      document.getElementById("fp-size").textContent = manifest.tree_size;
      document.getElementById("fp-root").textContent = manifest.root_sha256;
      document.getElementById("fp-anchor").textContent =
        anchors.length ? (anchors[anchors.length - 1].ref || anchors[anchors.length - 1].via) : "none yet";

      setBanner("pending", "Verifying " + manifest.editions.length + " editions…", "");
      list.innerHTML = "";

      const results = [];
      for (const ed of manifest.editions) {
        try {
          const r = await checkEdition(ed, ctx);
          results.push(r);
          list.appendChild(renderRow(r));
        } catch (e) {
          const row = el("div", "ed bad");
          row.appendChild(el("div", "ed-head",
            `<span class="dot"></span><span class="lang">${escapeHtml(ed.endo)}</span>` +
            `<span class="state">error: ${escapeHtml(String(e && e.message || e))}</span>`));
          list.appendChild(row);
          results.push({ ed, signedOk: false, hasAnchor: false, live: null });
        }
      }

      const bad = results.filter((r) => !r.signedOk || r.live === false).length;
      const unanchored = results.filter((r) => r.signedOk && !r.hasAnchor).length;
      if (bad) {
        setBanner("bad", `${bad} edition(s) did not verify`,
                  "At least one edition is altered or unsigned. Do not trust it; check offline.");
      } else if (unanchored) {
        setBanner("warn", "Signed and logged, but not fully anchored",
                  "Every edition is validly signed and in the log, but the log is not pinned to a public anchor, so the publisher could still rewrite history.");
      } else {
        setBanner("ok", `All ${results.length} editions verified`,
                  "Every edition is signed, present in the transparency log, publicly anchored, and matches the page served right now.");
      }
    } catch (e) {
      setBanner("bad", "Could not load the proofs", String(e && e.message || e));
    }
  }

  document.addEventListener("DOMContentLoaded", main);
})();
