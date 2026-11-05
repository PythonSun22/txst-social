import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const settle = () => new Promise((resolve) => setImmediate(resolve));
const student = { id: "student", username: "bobcat", display_name: "Bobcat" };
const college = { id: "college", slug: "business", name: "Business", description: "Business programs" };
const space = { id: "space", slug: "gaming", name: "Gaming", description: "Play together" };
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

async function searchHarness(api) {
  const hooks = [];
  const effects = [];
  const timers = new Set();
  let cursor = 0;
  const same = (old, next) => old && next.every((value, i) => Object.is(value, old[i]));
  const runtime = {
    useState(initial) {
      const hook = hooks[cursor++] ??= { value: initial };
      return [hook.value, (next) => { hook.value = typeof next === "function" ? next(hook.value) : next; }];
    },
    useRef(initial) { return hooks[cursor++] ??= { current: initial }; },
    useCallback(callback, dependencies) {
      const index = cursor++;
      if (!same(hooks[index]?.dependencies, dependencies)) hooks[index] = { dependencies, callback };
      return hooks[index].callback;
    },
    useEffect(effect, dependencies) {
      const index = cursor++;
      if (same(hooks[index]?.dependencies, dependencies)) return;
      hooks[index]?.cleanup?.();
      const hook = hooks[index] = { dependencies };
      effects.push(() => { hook.cleanup = effect(); });
    },
  };
  const jsx = (type, props) => typeof type === "function" ? type(props) : { type, props };
  const modules = {
    react: runtime,
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "next/link": { __esModule: true, default: "Link" },
    "@/components/spaces/SpaceIcon": { __esModule: true, default: "SpaceIcon" },
    "@/lib/api": { searchProfiles: api.searchProfiles },
    "@/lib/spaces": { searchSpaces: api.searchSpaces,
      spaceHref: (slug) => `/${slug === "business" ? "colleges" : "spaces"}/${slug}` },
  };
  const source = await readFile(new URL("../src/app/search/page.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  const component = {};
  new Function("require", "exports", "setTimeout", "clearTimeout", compiled.outputText)((name) => {
    assert.ok(name in modules, `Unexpected import ${name}`);
    return modules[name];
  }, component, (callback) => { timers.add(callback); return callback; }, (callback) => timers.delete(callback));
  return {
    render() {
      cursor = 0;
      const tree = component.default();
      effects.splice(0).forEach((effect) => effect());
      return tree;
    },
    tick() { const pending = [...timers]; timers.clear(); pending.forEach((callback) => callback()); },
    unmount() { hooks.forEach((hook) => hook.cleanup?.()); },
  };
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...nodes(tree.props?.children)];
}
function content(tree) {
  if (Array.isArray(tree)) return tree.map(content).join("");
  if (tree && typeof tree === "object") return content(tree.props?.children);
  return typeof tree === "string" || typeof tree === "number" ? String(tree) : "";
}
const element = (h, type) => nodes(h.render()).find((node) => node.type === type);
const links = (h) => nodes(h.render()).filter((node) => node.type === "Link").map((node) => node.props.href);
function typeQuery(h, value) {
  element(h, "input").props.onChange({ target: { value } });
  h.render();
}
function chooseScope(h, value) {
  element(h, "select").props.onChange({ target: { value } });
  h.render();
}

test("typing searches all categories by default and preserves result destinations", async (t) => {
  const calls = [];
  const h = await searchHarness({
    searchProfiles: async (query) => { calls.push([query, "students"]); return [student]; },
    searchSpaces: async (query, kind) => { calls.push([query, kind]); return [kind === "college" ? college : space]; },
  });
  t.after(h.unmount);
  assert.equal(element(h, "select").props.value, "all");
  typeQuery(h, "bobcat");
  assert.equal(calls.length, 0, "typing is debounced");
  h.tick(); await settle();
  assert.deepEqual(calls, [["bobcat", "students"], ["bobcat", "college"], ["bobcat", "community"]]);
  assert.deepEqual(links(h), ["/profile/student", "/colleges/business", "/spaces/gaming"]);
});

for (const scope of ["students", "colleges", "spaces"]) {
  test(`choosing ${scope} only queries that category`, async (t) => {
    const calls = [];
    const h = await searchHarness({ searchProfiles: async () => { calls.push("students"); return [student]; },
      searchSpaces: async (_, kind) => { calls.push(kind); return [kind === "college" ? college : space]; } });
    t.after(h.unmount);
    chooseScope(h, scope);
    typeQuery(h, "campus"); h.tick(); await settle();
    assert.deepEqual(calls, [scope === "colleges" ? "college" : scope === "spaces" ? "community" : "students"]);
    assert.equal(links(h).length, 1);
  });
}

test("a category change rejects old all-category results", async (t) => {
  const old = deferred();
  let oldSignal;
  let calls = 0;
  const h = await searchHarness({
    searchProfiles: async (_, signal) => {
      if (++calls === 1) { oldSignal = signal; return old.promise; }
      return [student];
    },
    searchSpaces: async () => old.promise,
  });
  t.after(h.unmount);
  typeQuery(h, "campus"); h.tick();
  chooseScope(h, "students"); h.tick(); await settle();
  old.resolve([space]); await settle();
  assert.equal(oldSignal.aborted, true);
  assert.deepEqual(links(h), ["/profile/student"]);
});

test("a failed category keeps successful results visible", async (t) => {
  const h = await searchHarness({ searchProfiles: async () => [student],
    searchSpaces: async () => { throw new Error("Spaces service unavailable"); } });
  t.after(h.unmount);
  typeQuery(h, "campus"); h.tick(); await settle();
  assert.deepEqual(links(h), ["/profile/student"]);
  assert.match(content(h.render()), /Unable to search colleges.*Unable to search spaces/);
  assert.doesNotMatch(content(h.render()), /No results found/);
});

test("clearing the query cancels pending results", async (t) => {
  const pending = deferred();
  const h = await searchHarness({ searchProfiles: async () => pending.promise, searchSpaces: async () => pending.promise });
  t.after(h.unmount);
  typeQuery(h, "campus"); h.tick();
  typeQuery(h, "");
  pending.resolve([student]); await settle();
  assert.deepEqual(links(h), []);
  assert.match(content(h.render()), /Start typing/);
  assert.doesNotMatch(content(h.render()), /Searching…/);
});

test("submitting immediately skips the pending debounce without duplicate requests", async (t) => {
  let calls = 0;
  const h = await searchHarness({ searchProfiles: async () => { calls++; return []; }, searchSpaces: async () => [] });
  t.after(h.unmount);
  typeQuery(h, "campus");
  element(h, "form").props.onSubmit({ preventDefault() {} });
  h.tick(); await settle();
  assert.equal(calls, 1);
  assert.match(content(h.render()), /No results found/);
});
