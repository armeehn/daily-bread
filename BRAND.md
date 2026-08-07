# Brand conformance

**DOC NO. DB-100-A · REV. A**

> **Read this before "fixing" the styling.** Daily Bread is **not** a Riposte-branded
> product. It is an independent publication that Riposte Laboratories Inc. funds. It has
> its own masthead, its own font stack and its own identity, and it is supposed to.

Riposte's design system lives at [ripostelabs.xyz/brand](https://ripostelabs.xyz/brand/)
([source](https://github.com/armeehn/riposte-brand)). This page records where Daily Bread
shares that language, where it diverges on purpose, and where the two should stay
distinguishable.

---

## The relationship

Daily Bread is a queer magazine for the Okanagan, baked quarterly in Kelowna. Riposte is
the funder and the printer, named as such — not the publisher of record and not the voice.
A reader should be able to tell the two apart at a glance. If Daily Bread ever becomes
visually indistinguishable from ripostelabs.xyz, that is a failure, not an achievement.

## Shares with the Riposte system

These are genuinely common ancestry, and should stay in sync:

| Element | Detail |
|---|---|
| Ink-on-bone base | The warm near-black on warm off-white premise |
| Accent cascade | Pink / teal / marigold, used as a rotation rather than a hierarchy |
| Checker & harlequin bands | The mi-parti separator strips |
| Spec-sheet chrome | Mono labels, tracked uppercase, document furniture |
| Radius 0, no blur | Sharp corners, flat fills, hard offsets |

## Deliberately diverges — do not "correct" these

| Divergence | Why |
|---|---|
| **UnifrakturMaguntia blackletter masthead** | The magazine's own identity. Riposte has no blackletter except inside its wordmark artwork. |
| **IBM Plex Mono** rather than JetBrains Mono | Plex is the publication's text face. It is the Riposte stack's own first fallback, so the two are siblings, not strangers — but they are not the same face and should not be unified. |
| Editorial voice — first person, warmth, humour | Riposte's voice is an engineer reporting results. A magazine is allowed feelings and exclamation marks. |
| Print spec driven by `PRINT-SPEC.md` | The magazine's press constraints outrank the brand guide's print section. |

## Where the guide still applies

Even as a separate brand, these carry over because they are correctness, not taste:

- **Contrast.** Bone on bright pink is 3.16:1 and bone on bright teal is 2.27:1 — both fail
  WCAG AA for body text in a magazine exactly as they do on ripostelabs.xyz. Use the deep
  variants (`#d81150`, `#a15e01`, `#0c7a63`) under anything sentence-shaped.
- **Uppercase via `text-transform`**, never typed — the multilingual builds depend on the
  source text staying searchable and translatable.
- **Rule weights in print.** Nothing below 1.5pt, or the structure disappears at press. See
  [`docs/08-print.md`](https://github.com/armeehn/riposte-brand/blob/main/docs/08-print.md).

## Queued

- [ ] Add the funder colophon — "Funded by Riposte Laboratories Inc." with the Riposte
      wordmark at minimum size — to the web edition footer, matching the print edition.
      This is the *correct* place for Riposte branding in this project: a credit, not a skin.
- [ ] Audit the web edition's accent-on-accent text against the contrast table.

---

<table>
<tr>
<td><b>DOC NO. DB-100-A</b><br>REV. A · EST. 2026</td>
<td align="right"><b>DAILY BREAD</b><br>Funded by Riposte Laboratories Inc.</td>
</tr>
</table>
