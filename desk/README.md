# The submissions desk

Writers email a draft to one address. The desk reads it against the house style
guide ([`STYLE.md`](../STYLE.md)) and the piece's word limit
([`press/issue-01/limits.json`](../press/issue-01/limits.json)) and replies
with numbered notes. The writer replies with a revision and the desk reads it
again, in the same thread. The editors get a copy of every original and every
note. A person reads everything; the desk never accepts or rejects a piece.

```
writer ──email──▶ submit@…  ──▶ desk Worker ──▶ Claude (claude-opus-5), notes as JSON
                                   │  ▲                    │
                                   │  └── thread, per writer and subject (KV)
                                   ├──▶ reply to the writer (notes, word count, limit)
                                   └──▶ editors@…: the original, and a copy of the notes
```

It is its own Cloudflare Worker (`daily-bread-desk`), separate from the site's
assets-only Worker, so the magazine deploys without it.

## What a writer gets

A short summary, the piece it was read as, the length against the limit, and at
most eight notes. Each note may cite a style rule by number (`[V2]`), quotes the
writer's own words, and in `suggest` mode offers one rewrite of them. The end of
every reply says the notes were written by an AI (Claude) and that a person on
the editorial team reads every submission.

The desk only has the rules `STYLE.md` has. While its voice sections are still
to be written, the notes are about length, mechanics and clarity, and the desk
is told not to invent a voice or correct the writer's.

## Safety

- **It only ever writes to two places:** a reply to the sender, and the
  editors' verified address. A draft that asks it to email someone else, or to
  approve itself, is read as a draft (see the test that tries).
- **The draft is data.** It goes to the model inside `<submission>` tags. The
  call has no tools, and the answer must fit a JSON schema. The reply is built
  from those fields, and a quote the draft does not contain is dropped, so the
  desk cannot put words in a writer's mouth.
- **No robot conversations:** bounces, auto-replies, mailing lists and its own
  address are never answered.
- **Limits:** 4 MB per email (pictures go to the editors), about 10,000 words
  read, and `DAILY_LIMIT` drafts per sender per day. Past that, and whenever
  the model refuses or errors, the writer gets an acknowledgement and the editors
  get the draft.
- Threads are kept 180 days in KV: the writer's address, the subject, and each
  round's word count and summary. The draft itself is not stored; it is in the
  editors' inbox.

## Set it up

You need the domain on Cloudflare with **Email Routing** enabled, and an
Anthropic API key.

1. Edit `desk/wrangler.jsonc`:
   - `DESK_ADDRESS`: the address writers send to, e.g. `submit@yourdomain`.
   - `EDITORS_ADDRESS`, and `send_email[0].destination_address`: the editors'
     inbox. It must be a **verified destination address** in Email Routing
     (Email → Email Routing → Destination addresses).
   - `DESK_MODE`: `point` (name the rule and quote it), `suggest` (the default:
     also offer a rewrite) or `rewrite`. Match what `STYLE.md` says under
     "The submissions desk".
2. Create the KV namespace and paste its id into `kv_namespaces`:
   `cd desk && npm install && npx wrangler kv namespace create DESK`
3. Store the API key: `npx wrangler secret put ANTHROPIC_API_KEY`
4. Deploy: `npx wrangler deploy`
5. In Email Routing → Routing rules, send `DESK_ADDRESS` to the Worker
   `daily-bread-desk`.
6. Send it a draft from your own address.

`STYLE.md` and the word limits are bundled when the Worker is deployed: after
editing the guide, or re-publishing the limits (`node tools/press/render.js --publish`), deploy the
desk again.

## Develop

Node 22 or newer (Wrangler 4 needs it; `package.json` says so under `engines`).

```sh
cd desk && npm install
npm test            # offline: a fake email, a fake KV, a fake Claude
npm run check       # bundle it exactly as a deploy would, without deploying
```

| File | What it does |
|---|---|
| `src/index.js` | Worker entry; bundles `STYLE.md` and the limits |
| `src/desk.js` | One email in: filter, thread, review, reply, copy the editors, remember |
| `src/mail.js` | Parsing (postal-mime), the draft without its quoted history, word count (the studio's), automated-mail checks |
| `src/review.js` | The Claude call: system prompt (cached), schema, refusal and error handling |
| `src/compose.js` | The reply and the editors' copy, from the review's fields |
