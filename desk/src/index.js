/* Worker entry. The style guide and the measured word limits are bundled at
 * deploy time (wrangler's Text and JSON modules), so a change to either is a
 * redeploy: `cd desk && npx wrangler deploy`. */
import STYLE from "../../STYLE.md";
import LIMITS from "../../press/issue-01/limits.json";
import { handle } from "./desk.js";

export default {
  async email(message, env) {
    const res = await handle(message, env, { style: STYLE, limits: LIMITS, log: (...a) => console.log("desk:", ...a) });
    console.log("desk:", JSON.stringify(res));
  },
  async fetch() {
    return new Response("The submissions desk reads email only.\n", { status: 404 });
  },
};
