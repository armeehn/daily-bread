#!/usr/bin/env node
/* Regenerate index.html (the published edition) from the default model in db.js.
   Run: node build.js   — the studio's "Publish" button produces the same output. */
const fs = require("fs");
const path = require("path");
const DB = require("./db.js");
const html = DB.render(DB.DEFAULT_MODEL);
fs.writeFileSync(path.join(__dirname, "index.html"), html);
console.log("Wrote index.html (" + html.length + " bytes) from db.js DEFAULT_MODEL.");
