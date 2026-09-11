#!/usr/bin/env python3
"""Export a Shopify collection as a static catalogue the brand sites render.

    python3 tools/merch/catalogue.py <collection-handle>... > catalogue.json

Why static: the online store sits behind Shopify's password until a plan is
chosen, and a Storefront API token would have to live in three public pages
with three CSPs. A JSON file of what is already public (titles, prices, CDN
image URLs, product links) needs neither. Re-run after the merch pipeline.

Reads with the same credentials as merch.py (see merch.token).
"""
import json
import os
import sys
import time
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import merch  # noqa: E402

SHOP = os.environ.get("SHOPIFY_SHOP", "h23y0x-fd.myshopify.com")

QUERY = """query($q: String!) {
  collections(first: 1, query: $q) {
    nodes {
      handle title descriptionHtml
      products(first: 50, sortKey: TITLE) {
        nodes {
          handle title productType tags status onlineStoreUrl
          priceRangeV2 { minVariantPrice { amount currencyCode } maxVariantPrice { amount } }
          options { name values }
          featuredMedia { preview { image { url altText } } }
          media(first: 10) { nodes { preview { image { url altText } } } }
        }
      }
    }
  }
}"""


def product(p):
    imgs = [m["preview"]["image"] for m in p["media"]["nodes"] if m.get("preview", {}).get("image")]
    price = p["priceRangeV2"]
    return {
        "handle": p["handle"],
        "title": p["title"],
        "type": p["productType"],
        "price": {"min": price["minVariantPrice"]["amount"], "max": price["maxVariantPrice"]["amount"],
                  "currency": price["minVariantPrice"]["currencyCode"]},
        "url": p["onlineStoreUrl"] or f"https://{SHOP}/products/{p['handle']}",
        "image": {"src": imgs[0]["url"], "alt": imgs[0]["altText"] or p["title"]} if imgs else None,
        "images": [{"src": i["url"], "alt": i["altText"] or p["title"]} for i in imgs],
        "options": [{"name": o["name"], "values": o["values"]} for o in p["options"]
                    if o["name"] != "Title"],
    }


def main():
    handles = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not handles:
        sys.exit(__doc__)
    tok = merch.token(SHOP)
    out = {"shop": f"https://{SHOP}", "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
           "collections": []}
    seen = set()
    for h in handles:
        d = merch.gql(SHOP, tok, QUERY, {"q": f"handle:{h}"})
        nodes = d["collections"]["nodes"]
        if not nodes:
            sys.exit(f"no collection {h}")
        c = nodes[0]
        prods = [product(p) for p in c["products"]["nodes"]
                 if p["status"] == "ACTIVE" and p["handle"] not in seen]
        seen.update(p["handle"] for p in prods)
        out["collections"].append({"handle": c["handle"], "title": c["title"],
                                   "url": f"https://{SHOP}/collections/{c['handle']}",
                                   "products": prods})
        time.sleep(0.2)
    json.dump(out, sys.stdout, indent=1, ensure_ascii=False)
    print()


if __name__ == "__main__":
    main()
