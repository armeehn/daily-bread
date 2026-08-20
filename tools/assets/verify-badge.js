/* Daily Bread — reader-facing self-verification badge.
 *
 * Inlined into every FULL edition by tools/build.js and covered by that
 * edition's own newsproof signature. On load it verifies THIS edition against
 * the published proofs — the same WebCrypto checks the /verify/ page runs, but
 * scoped to the one page you are reading — and turns the footer's static
 * "verify" link into a live status dot: signed, present in the transparency
 * log, publicly anchored, and byte-identical to what was signed.
 *
 * Same honest limitation as /verify/: this script is served by the same site as
 * the magazine, so against the publisher it proves nothing. It catches
 * third-party tampering, stale caches and accidents. The real check is
 * tools/newsproof/verify_standalone.py, run offline against a fingerprint you
 * obtained somewhere other than this website. The badge links there.
 */
(function () {
  "use strict";
  var badge = document.getElementById("np-badge");
  if (!badge) return;
  var alertBar = document.getElementById("np-alert");
  var C = badge.dataset, WK = "/.well-known/newsproof";
  if (!(window.crypto && crypto.subtle && crypto.subtle.importKey)) {
    /* No WebCrypto at all. Previously this returned silently and the page kept
       its static "Verified publishing ✓" link — a page that had verified
       nothing looked exactly like a page that had. Say so instead. */
    showAlert("warn", C.tUncheckable);
    badge.className = "verify-note np-warn";
    return;
  }
  var DOMAIN_STATEMENT = "newsproof/v1/statement\0", DOMAIN_STH = "newsproof/v1/sth\0";

  var enc = new TextEncoder();
  var b64 = function (s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); };
  var hex = function (u) { return Array.prototype.map.call(u, function (b) { return (b < 16 ? "0" : "") + b.toString(16); }).join(""); };
  var unhex = function (s) { return new Uint8Array(s.match(/../g).map(function (h) { return parseInt(h, 16); })); };
  function concat() {
    var a = arguments, n = 0, i;
    for (i = 0; i < a.length; i++) n += a[i].length;
    var out = new Uint8Array(n), at = 0;
    for (i = 0; i < a.length; i++) { out.set(a[i], at); at += a[i].length; }
    return out;
  }

  /* RFC 8785 canonical JSON — mirrors tools/newsproof/canon.py and verify.js. */
  function canon(v) {
    if (v === null) return "null";
    var t = typeof v;
    if (t === "boolean") return v ? "true" : "false";
    if (t === "number") { if (!Number.isInteger(v)) throw new Error("float"); return String(v); }
    if (t === "string") return JSON.stringify(v);
    if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
    if (t === "object") {
      var k = Object.keys(v).sort();
      return "{" + k.map(function (x) { return JSON.stringify(x) + ":" + canon(v[x]); }).join(",") + "}";
    }
    throw new Error("unsupported type " + t);
  }

  /* RFC 6962 */
  var sha = function (b) { return crypto.subtle.digest("SHA-256", b).then(function (d) { return new Uint8Array(d); }); };
  var leafHash = function (d) { return sha(concat(new Uint8Array([0]), d)); };
  var nodeHash = function (a, b) { return sha(concat(new Uint8Array([1]), a, b)); };
  var same = function (a, b) { return a.length === b.length && a.every(function (v, i) { return v === b[i]; }); };

  async function verifyInclusion(leaf, index, size, path, expected) {
    if (index < 0 || index >= size) return false;
    var fn = index, sn = size - 1, acc = leaf, i;
    for (i = 0; i < path.length; i++) {
      var s = path[i];
      if (sn === 0) return false;
      if ((fn & 1) || fn === sn) {
        acc = await nodeHash(s, acc);
        while (fn !== 0 && (fn & 1) === 0) { fn >>= 1; sn >>= 1; }
      } else { acc = await nodeHash(acc, s); }
      fn >>= 1; sn >>= 1;
    }
    return sn === 0 && same(acc, expected);
  }

  async function verifyConsistency(m, n, path, oldRoot, newRoot) {
    if (m > n || m < 0) return false;
    if (m === n) return path.length === 0 && same(oldRoot, newRoot);
    if (m === 0) return path.length === 0;
    if (path.length === 0) return false;
    var fn = m - 1, sn = n - 1;
    while (fn & 1) { fn >>= 1; sn >>= 1; }
    var rest = path.slice();
    var first = fn !== 0 ? rest.shift() : oldRoot;
    var fr = first, sr = first, i;
    for (i = 0; i < rest.length; i++) {
      var s = rest[i];
      if (sn === 0) return false;
      if ((fn & 1) || fn === sn) {
        fr = await nodeHash(s, fr);
        sr = await nodeHash(s, sr);
        while (fn !== 0 && (fn & 1) === 0) { fn >>= 1; sn >>= 1; }
      } else { sr = await nodeHash(sr, s); }
      fn >>= 1; sn >>= 1;
    }
    return sn === 0 && same(fr, oldRoot) && same(sr, newRoot);
  }

  function edVerify(rawKey, domain, message, sigB64) {
    return crypto.subtle.importKey("raw", rawKey, { name: "Ed25519" }, false, ["verify"])
      .then(function (k) {
        return crypto.subtle.verify({ name: "Ed25519" }, k, b64(sigB64), concat(enc.encode(domain), message));
      });
  }

  var getJSON = function (u) { return fetch(u, { cache: "no-store" }).then(function (r) { return r.json(); }); };

  /* The prominent bar at the top of the page. `set()` drives it from the same
     state machine as the footer dot, so the two can never disagree: hidden when
     checking or verified, loud otherwise. Its height is published as
     --np-alert-h so the sticky topbar and contents rail can sit below it. */
  function measureAlert() {
    if (!alertBar || alertBar.hidden) return;
    document.documentElement.style.setProperty("--np-alert-h", alertBar.offsetHeight + "px");
  }

  function showAlert(cls, msg) {
    if (!alertBar) return;
    if (cls === "ok" || cls === "checking") {
      alertBar.hidden = true;
      document.body.classList.remove("np-alerted");
      document.documentElement.style.removeProperty("--np-alert-h");
      return;
    }
    alertBar.className = "np-" + cls;
    var m = alertBar.querySelector(".np-alert-msg");
    if (m) m.textContent = msg;
    var more = alertBar.querySelector(".np-alert-more");
    if (more) more.textContent = C.tDetails;
    alertBar.hidden = false;
    document.body.classList.add("np-alerted");
    measureAlert();
  }
  addEventListener("resize", measureAlert);

  function set(cls, msg) {
    badge.className = "verify-note np-" + cls;
    badge.textContent = "";
    var dot = document.createElement("span"); dot.className = "np-dot";
    var m = document.createElement("span"); m.className = "np-msg"; m.textContent = msg;
    var a = document.createElement("a"); a.className = "np-more"; a.href = "/verify/"; a.textContent = C.tDetails;
    badge.appendChild(dot);
    badge.appendChild(m);
    badge.appendChild(document.createTextNode(" "));
    badge.appendChild(a);
    showAlert(cls, msg);
  }

  async function run() {
    set("checking", C.tChecking);

    // Ed25519 must be present in WebCrypto (Safari <17, older Firefox lack it).
    try {
      await crypto.subtle.importKey("raw", new Uint8Array(32), { name: "Ed25519" }, false, ["verify"]);
    } catch (e) { set("warn", C.tUncheckable); return; }

    var proof = await getJSON(C.proof);
    var res = await Promise.all([
      getJSON(WK + "/publisher-key.json"),
      getJSON(WK + "/log-key.json"),
      fetch(WK + "/anchors.jsonl", { cache: "no-store" }).then(function (r) { return r.ok ? r.text() : ""; }),
      fetch(WK + "/consistency.json", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : []; })
    ]);
    var pub = res[0], log = res[1];
    var anchors = res[2].split("\n").filter(function (x) { return x.trim(); }).map(JSON.parse);
    var consistency = res[3];

    var st = proof.statement, body = b64(proof.body_b64);
    var stmtBytes = enc.encode(canon(st));
    var inc = proof.inclusion, sth = proof.sth;

    var okBytes = hex(await sha(body)) === st.content_sha256;
    var okPub = proof.publisher_key_id === pub.key_id;
    var okSig = await edVerify(b64(pub.public_key_b64), DOMAIN_STATEMENT, stmtBytes, proof.publisher_signature);
    var okInc = await verifyInclusion(await leafHash(stmtBytes), inc.leaf_index, inc.tree_size,
      inc.audit_path.map(unhex), unhex(sth.root_sha256));
    var okLog = await edVerify(b64(log.public_key_b64), DOMAIN_STH, enc.encode(canon(sth)), proof.log_signature);
    var signedOk = okBytes && okPub && okSig && okInc && okLog;

    // Public-anchor coverage: same size ⇒ roots must match; older size ⇒ a
    // consistency proof shows nothing anchored was rewritten.
    var anchored = 0, i, j;
    for (i = 0; i < anchors.length; i++) {
      var a = anchors[i];
      if (a.tree_size > sth.tree_size) continue;
      if (a.tree_size === sth.tree_size) { if (a.root_sha256 === sth.root_sha256) anchored++; continue; }
      var pc = null;
      for (j = 0; j < consistency.length; j++) {
        if (consistency[j].old_size === a.tree_size && consistency[j].new_size === sth.tree_size) { pc = consistency[j]; break; }
      }
      if (!pc) continue;
      if (await verifyConsistency(a.tree_size, sth.tree_size, pc.path.map(unhex), unhex(a.root_sha256), unhex(sth.root_sha256))) anchored++;
    }
    var hasAnchor = anchored > 0;

    // The bytes served right now must still hash to the signed value.
    var live = null;
    try {
      var buf = new Uint8Array(await fetch(C.url, { cache: "no-store" }).then(function (r) { return r.arrayBuffer(); }));
      live = hex(await sha(buf)) === st.content_sha256;
    } catch (e) { live = null; }

    if (!signedOk) set("bad", C.tBad);
    else if (!hasAnchor) set("warn", C.tUnanchored);
    else if (live === false) set("bad", C.tBad);
    else if (live === null) set("warn", C.tUncheckable);
    else set("ok", C.tOk);
  }

  /* A verifier that throws has verified nothing, and used to leave the page
     wearing its static "Verified publishing ✓" link. Fail closed and loud: a
     proof that could not be fetched, parsed or checked is a proof that did not
     pass. */
  run().catch(function () {
    try { set("bad", C.tBad); } catch (e) { /* nothing left to do */ }
  });
})();
