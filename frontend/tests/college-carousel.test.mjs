import assert from "node:assert/strict";
import test from "node:test";
import { readFile, access } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import postcss from "postcss";

const frontend = new URL("../", import.meta.url);

async function loadData(path, imports = {}) {
  const source = await readFile(new URL(path, frontend), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    require: (name) => {
      assert.ok(name in imports, `Unexpected data dependency: ${name}`);
      return imports[name];
    },
  });
  return exports;
}

test("FR-13: reference artwork categories resolve to all ten existing college feeds", async () => {
  const feeds = await loadData("src/lib/colleges.ts");
  const { carouselColleges } = await loadData("src/lib/college-carousel.ts", { "./colleges": feeds });
  const mapped = new Set(carouselColleges.map((item) => item.slug));
  assert.equal(carouselColleges.length, 10);
  assert.equal(mapped.size, 10);
  for (const feed of feeds.colleges) {
    const slide = carouselColleges.find((item) => item.slug === feed.slug);
    assert.ok(slide, `Missing feed: ${feed.slug}`);
    assert.equal(slide.feedName, feed.name);
    await access(new URL(`public${slide.asset}`, frontend));
  }
  assert.equal(carouselColleges.find((item) => item.id === "engineering").slug, "science_engineering");
  assert.equal(carouselColleges.find((item) => item.id === "health").slug, "health_professions");
  assert.equal(carouselColleges.find((item) => item.id === "university").slug, "university_college");
});

test("college reference styles cannot change other application pages", async () => {
  const source = await readFile(new URL("src/components/colleges/colleges.css", frontend), "utf8");
  const css = postcss.parse(source);
  css.walkRules((rule) => {
    for (const selector of rule.selectors) {
      assert.ok(selector.startsWith(".lynx-page"), `Unscoped reference rule: ${selector}`);
    }
  });
  css.walkAtRules("import", () => assert.fail("Global sandbox font imports must use route-scoped next/font"));
});
