import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HAREM_ITEMS, CHAMBER_DECOR } from "../src/content/harem";
import { emptyCosmetics, cosmeticAppearance } from "../src/lib/cosmeticRules";
import { displayAppearance, visualVariant } from "../src/ui/appearance";
import { ItemIllustration } from "../src/ui/Illustrations";
import { sheetLevelAfterDrag } from "../src/ui/ScrollSheet";
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}
test("all source is NFC, including Vietnamese literals and CSS", () => {
  for (const file of files("src").filter((p) => /\.(ts|tsx|css)$/.test(p))) {
    const text = readFileSync(file, "utf8");
    assert.equal(text, text.normalize("NFC"), `${file} must be NFC`);
  }
});
test("every item/decor has real inline SVG artwork, including default styles and owned slots", () => {
  for (const item of [...HAREM_ITEMS, ...CHAMBER_DECOR]) {
    const html = renderToStaticMarkup(
      createElement(ItemIllustration, { item }),
    );
    assert.ok(html.includes(`data-artwork="${item.code}"`));
    assert.match(html, /<svg/);
    assert.match(html, /role="img"/);
    assert.match(html, /<path|<ellipse|<circle/);
    assert.match(html, new RegExp(`tier-${item.minTier}`));
  }
});
test("try-on copies only display data: unknown/unowned/high-tier items never change equipment or stats", () => {
  const data = emptyCosmetics("own-character"),
    base = cosmeticAppearance("harem_0", data),
    before = JSON.stringify({ base, data });
  const outfit = HAREM_ITEMS.find(
    (i) => i.slot === "OUTFIT" && i.minTier === 5,
  )!;
  const shown = displayAppearance(base, data.equipment, {
    kind: "ITEM",
    code: outfit.code,
  });
  assert.equal(shown.outfitCode, outfit.code);
  assert.deepEqual(shown.outfit, outfit.visual);
  assert.equal(JSON.stringify({ base, data }), before);
  assert.deepEqual(
    displayAppearance(base, data.equipment, { kind: "ITEM", code: "UNKNOWN" }),
    displayAppearance(base, data.equipment),
  );
  const decor = CHAMBER_DECOR.find(
    (d) => d.slot === "SCREEN" && d.style === 2,
  )!;
  assert.equal(
    displayAppearance(base, data.equipment, { kind: "DECOR", code: decor.code })
      .decor.SCREEN.style,
    2,
  );
  assert.equal(base.decor.SCREEN.style, 0);
  assert.equal(displayAppearance(base, data.equipment).outfitCode, undefined);
  for (const item of HAREM_ITEMS) {
    assert.equal(visualVariant(item.code), visualVariant(item.code));
    assert.ok([0, 1, 2].includes(visualVariant(item.code)));
  }
});
test("scroll sheet has three reachable drag stops; short movements preserve the chosen stop", () => {
  assert.equal(sheetLevelAfterDrag("collapsed", -60), "half");
  assert.equal(sheetLevelAfterDrag("half", -60), "full");
  assert.equal(sheetLevelAfterDrag("full", -70), "full");
  assert.equal(sheetLevelAfterDrag("full", 60), "half");
  assert.equal(sheetLevelAfterDrag("half", 60), "collapsed");
  assert.equal(sheetLevelAfterDrag("collapsed", 10), "collapsed");
});
test("fonts are self-hosted WOFF2 with Vietnamese subsets and bundled OFL licenses", () => {
  const css = readFileSync("src/ui/fonts.css", "utf8");
  assert.doesNotMatch(
    readFileSync("src/app/globals.css", "utf8"),
    /font(?:-family)?:[^;}]*\b(?:Arial|Georgia)\b/,
  );
  assert.doesNotMatch(css, /https?:\/\//);
  assert.equal((css.match(/\/\* vietnamese \*\//g) ?? []).length, 4);
  assert.match(css, /U\+1EA0-1EF9/);
  for (const match of css.matchAll(/url\((\/fonts\/[^)]+)\)/g)) {
    assert.equal(
      readFileSync(`public${match[1]}`).subarray(0, 4).toString(),
      "wOF2",
    );
  }
  for (const name of ["Be-Vietnam-Pro", "Noto-Serif"])
    assert.match(
      readFileSync(`public/fonts/${name}-OFL.txt`, "utf8"),
      /SIL OPEN FONT LICENSE/,
    );
});
