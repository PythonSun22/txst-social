import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const settle = () => new Promise((resolve) => setImmediate(resolve));
const gaming = { id: "gaming", slug: "gaming", name: "Gaming", kind: "community", is_seeded: true, follower_count: 0, is_following: false };
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
const jsx = (type, props) => ({ type, props });

async function compile(path, modules) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  const exports = {};
  new Function("require", "exports", compiled.outputText)((name) => {
    assert.ok(name in modules, `Unexpected module ${name}`);
    return modules[name];
  }, exports);
  return exports;
}

async function providerHarness(api) {
  const hooks = [];
  const effects = [];
  const listeners = new Set();
  let cursor = 0;
  let profile = { id: "student-a", email_verified: true };
  const runtime = {
    createContext: () => ({ Provider: "provider" }),
    useState(initial) {
      const index = cursor++;
      const hook = hooks[index] ??= { value: initial };
      return [hook.value, (next) => { hook.value = typeof next === "function" ? next(hook.value) : next; }];
    },
    useRef(initial) { return hooks[cursor++] ??= { current: initial }; },
    useEffect(effect, dependencies) {
      const index = cursor++;
      const previous = hooks[index];
      if (previous && dependencies.every((value, i) => value === previous.dependencies[i])) return;
      previous?.cleanup?.();
      const hook = hooks[index] = { dependencies };
      effects.push(() => { hook.cleanup = effect(); });
    },
  };
  const component = await compile("../src/components/spaces/SpacesProvider.tsx", {
    react: runtime,
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "@/lib/profiles": { getCurrentProfile: async () => profile },
    "@/lib/spaces": api,
    "@/lib/supabase": { getSupabase: () => ({ auth: { onAuthStateChange(callback) {
      listeners.add(callback);
      return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
    } } }) },
  });
  return {
    render() {
      cursor = 0;
      const tree = component.default({ children: null });
      effects.splice(0).forEach((effect) => effect());
      return tree.props.value;
    },
    changeAccount(nextProfile) { profile = nextProfile; listeners.forEach((callback) => callback()); },
    unmount() { hooks.forEach((hook) => hook.cleanup?.()); },
  };
}

test("space follows update shared state and survive a fresh directory read", async (t) => {
  let saved = { ...gaming };
  const harness = await providerHarness({
    listSpaces: async () => [saved],
    setSpaceFollow: async (_, following) => {
      saved = { ...saved, is_following: following, follower_count: following ? 1 : 0 };
      return { following, follower_count: saved.follower_count };
    },
  });
  t.after(() => harness.unmount());
  harness.render();
  await settle();
  await harness.render().follow("gaming", true);
  assert.equal(harness.render().spaces[0].is_following, true);
  harness.render().reload();
  harness.render();
  await settle();
  assert.equal(harness.render().spaces[0].follower_count, 1);
  await harness.render().follow("gaming", false);
  assert.equal(harness.render().spaces[0].is_following, false);
});

test("switching accounts cancels an old follow and cannot change the new profile", async (t) => {
  const pending = deferred();
  let signal;
  let calls = 0;
  const harness = await providerHarness({
    listSpaces: async () => [{ ...gaming }],
    setSpaceFollow: (_, __, abortSignal) => { calls++; signal = abortSignal; return pending.promise; },
  });
  t.after(() => harness.unmount());
  harness.render();
  await settle();
  const oldState = harness.render();
  const saving = oldState.follow("gaming", true);
  await oldState.follow("gaming", true);
  assert.equal(calls, 1, "duplicate clicks must not start another mutation");
  harness.changeAccount({ id: "student-b", email_verified: true });
  await settle();
  pending.resolve({ following: true, follower_count: 1 });
  await saving;
  const current = harness.render();
  assert.equal(signal.aborted, true);
  assert.equal(current.profile.id, "student-b");
  assert.equal(current.spaces[0].is_following, false);
});

test("a failed follow shows feedback and preserves the saved membership", async (t) => {
  const harness = await providerHarness({ listSpaces: async () => [{ ...gaming }],
    setSpaceFollow: async () => { throw new Error("Unable to save follow"); } });
  t.after(() => harness.unmount());
  harness.render();
  await settle();
  await harness.render().follow("gaming", true);
  assert.equal(harness.render().error, "Unable to save follow");
  assert.equal(harness.render().spaces[0].is_following, false);
  assert.equal(harness.render().busy, null);
});

test("the sidebar shows suggestions first, then puts joined spaces above them", async () => {
  let spaces = [{ ...gaming }];
  const render = (type, props) => typeof type === "function" ? type(props) : { type, props };
  const component = await compile("../src/components/spaces/SpacesSidebar.tsx", {
    "react/jsx-runtime": { jsx: render, jsxs: render },
    "next/link": { __esModule: true, default: "Link" },
    "./SpaceList": { __esModule: true, default: "SpaceList" },
    "./SpacesProvider": { useSpaces: () => ({ spaces, loading: false, error: "", reload() {} }) },
  });
  function headings(tree) {
    if (Array.isArray(tree)) return tree.flatMap(headings);
    if (!tree || typeof tree !== "object") return [];
    return tree.type === "h2" ? [tree.props.children] : headings(tree.props.children);
  }
  const desktop = () => component.default().props.children[0];
  assert.deepEqual(headings(desktop()), ["Suggested Spaces"]);
  spaces = [{ ...gaming, is_following: true }];
  assert.deepEqual(headings(desktop()), ["Your Spaces", "Suggested Spaces"]);
});

test("Your Spaces keeps every joined community available while limiting the visible rows to five", async () => {
  const spaces = Array.from({ length: 7 }, (_, index) => ({ ...gaming, id: `joined-${index}`, is_following: true }));
  spaces.push({ ...gaming, id: "college", kind: "college", is_following: true });
  spaces.push(...Array.from({ length: 3 }, (_, index) => ({ ...gaming, id: `suggested-${index}` })));
  const render = (type, props) => typeof type === "function" ? type(props) : { type, props };
  const sidebar = await compile("../src/components/spaces/SpacesSidebar.tsx", {
    "react/jsx-runtime": { jsx: render, jsxs: render }, "next/link": { __esModule: true, default: "Link" },
    "./SpaceList": { __esModule: true, default: "SpaceList" },
    "./SpacesProvider": { useSpaces: () => ({ spaces, loading: false, error: "", reload() {} }) },
  });
  const lists = descendants(sidebar.default().props.children[0]).filter((node) => node.type === "SpaceList");
  assert.equal(lists[0].props.visibleRows, 5);
  assert.equal(lists[0].props.spaces.length, 7);
  assert.ok(lists[0].props.spaces.every((space) => space.kind === "community"));
  assert.equal(lists[1].props.spaces.length, 2);

  const list = await compile("../src/components/spaces/SpaceList.tsx", {
    "react/jsx-runtime": { jsx, jsxs: jsx }, "next/link": { __esModule: true, default: "Link" },
    "./SpaceAvatar": { __esModule: true, default: "SpaceAvatar" },
    "@/lib/spaces": { spaceHref: (slug) => `/spaces/${slug}` },
    "./SpacesProvider": { useSpaces: () => ({ profile: null, busy: null, follow() {} }) },
  });
  const tree = list.default(lists[0].props);
  assert.equal(tree.props.style.maxHeight, "15rem");
  assert.equal(tree.props.tabIndex, 0);
  assert.equal(tree.props.children.length, 7);
});

test("college sidebar promotes the profile's home college and keeps other follows separate", async () => {
  const business = { ...gaming, id: "business", slug: "business", name: "McCoy College of Business", kind: "college", is_following: true };
  const education = { ...business, id: "education", slug: "education", name: "College of Education" };
  const state = { spaces: [business, education, gaming, { ...business, id: "not-joined", is_following: false }],
    profile: { home_college: business }, loading: false, error: "", reload() {} };
  const render = (type, props) => typeof type === "function" ? type(props) : { type, props };
  const component = await compile("../src/components/spaces/CollegesSidebar.tsx", {
    "react/jsx-runtime": { jsx: render, jsxs: render, Fragment: "fragment" },
    "next/link": { __esModule: true, default: "Link" }, "./SpaceIcon": { __esModule: true, default: "SpaceIcon" },
    "./SpaceList": { __esModule: true, default: "SpaceList" }, "./SpacesProvider": { useSpaces: () => state },
  });
  const desktop = () => component.default().props.children[0];
  const otherList = () => descendants(desktop()).find((node) => node.type === "SpaceList");
  assert.ok(descendants(desktop()).some((node) => node.type === "h3" && node.props.children === business.name));
  assert.ok(descendants(desktop()).some((node) => node.type === "Link" && node.props.href === "/colleges/business"));
  assert.deepEqual(otherList().props.spaces.map((space) => space.id), ["education"]);
  assert.equal(otherList().props.visibleRows, 3);
  state.profile = { home_college: education };
  assert.deepEqual(otherList().props.spaces.map((space) => space.id), ["business"]);
  state.profile = { home_college: null };
  assert.ok(descendants(desktop()).some((node) => node.type === "Link" && node.props.href === "/profile"));
  state.profile = null;
  assert.equal(otherList(), undefined);
  assert.ok(descendants(desktop()).some((node) => node.type === "Link" && node.props.href === "/login"));
});

async function directoryHarness(t, initialSpaces = [gaming], reducedMotion = false) {
  let spaces = initialSpaces, cursor = 0, resize, disconnected = false;
  const hooks = [], effects = [], scrolls = [];
  const element = { scrollLeft: 0, clientWidth: 600, scrollWidth: 1000,
    firstElementChild: {}, scrollBy: (options) => scrolls.push(options) };
  const previousObserver = globalThis.ResizeObserver, previousWindow = globalThis.window;
  globalThis.ResizeObserver = class {
    constructor(callback) { resize = callback; }
    observe() {}
    disconnect() { disconnected = true; }
  };
  globalThis.window = { matchMedia: () => ({ matches: reducedMotion }) };
  const same = (a, b) => a && b.every((value, index) => Object.is(value, a[index]));
  const runtime = {
    useRef() { return hooks[cursor++] ??= { current: element }; },
    useState(initial) {
      const hook = hooks[cursor++] ??= { value: initial };
      return [hook.value, (next) => { hook.value = typeof next === "function" ? next(hook.value) : next; }];
    },
    useCallback(callback, dependencies) {
      const index = cursor++;
      if (!same(hooks[index]?.dependencies, dependencies)) hooks[index] = { callback, dependencies };
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
  const component = await compile("../src/components/spaces/SpaceSection.tsx", {
    react: runtime, "react/jsx-runtime": { jsx, jsxs: jsx },
    "./SpaceList": { __esModule: true, default: "SpaceList" },
  });
  function unmount() { hooks.forEach((hook) => hook.cleanup?.()); }
  t.after(() => { unmount(); globalThis.ResizeObserver = previousObserver; globalThis.window = previousWindow; });
  return { element, scrolls, resize: () => resize(), unmount, disconnected: () => disconnected,
    setSpaces(next) { spaces = next; },
    render() {
      cursor = 0;
      const tree = component.default({ id: "general-spaces", title: "General spaces", description: "Explore communities", spaces });
      effects.splice(0).forEach((effect) => effect());
      return tree;
    },
  };
}
function descendants(tree) {
  if (Array.isArray(tree)) return tree.flatMap(descendants);
  return tree && typeof tree === "object" ? [tree, ...descendants(tree.props?.children)] : [];
}
const scrollButton = (tree, direction) => descendants(tree).find((node) => node.props?.["aria-label"] === `Scroll general spaces ${direction}`);

test("directory arrows scroll the viewport and disable at the ends and after resizing", async (t) => {
  const h = await directoryHarness(t);
  h.render(); h.resize();
  assert.equal(scrollButton(h.render(), "left").props.disabled, true);
  assert.equal(scrollButton(h.render(), "right").props.disabled, false);
  scrollButton(h.render(), "right").props.onClick();
  assert.deepEqual(h.scrolls, [{ left: 480, behavior: "smooth" }]);
  h.element.scrollLeft = 400;
  descendants(h.render()).find((node) => node.props?.id === "general-spaces").props.onScroll();
  assert.equal(scrollButton(h.render(), "left").props.disabled, false);
  assert.equal(scrollButton(h.render(), "right").props.disabled, true);
  h.element.scrollLeft = 0; h.element.clientWidth = 1200; h.resize();
  assert.equal(scrollButton(h.render(), "left").props.disabled, true);
  assert.equal(scrollButton(h.render(), "right").props.disabled, true);
  h.unmount(); assert.equal(h.disconnected(), true);
});

test("directory scrolling respects reduced-motion preferences", async (t) => {
  const h = await directoryHarness(t, [gaming], true);
  h.render(); h.element.scrollLeft = 200; h.resize();
  scrollButton(h.render(), "left").props.onClick();
  assert.deepEqual(h.scrolls, [{ left: -480, behavior: "auto" }]);
});

test("reusable sections keep spaces sorted by followers without mutating shared data", async (t) => {
  const spaces = [{ ...gaming, follower_count: 2 }, { ...gaming, id: "music", name: "Music", follower_count: 4 },
    { ...gaming, id: "art", name: "Art", follower_count: 4 }];
  const h = await directoryHarness(t, spaces);
  const listed = () => descendants(h.render()).find((node) => node.type === "SpaceList").props.spaces;
  assert.deepEqual(listed().map((space) => space.id), ["art", "music", "gaming"]);
  assert.deepEqual(spaces.map((space) => space.id), ["gaming", "music", "art"]);
  h.setSpaces(spaces.map((space) => space.id === "gaming" ? { ...space, follower_count: 5 } : space));
  assert.deepEqual(listed().map((space) => space.id), ["gaming", "art", "music"]);
});

test("directory separates seeded General spaces from User Spaces and accepts future data", async () => {
  let spaces = [gaming, { ...gaming, id: "pets", slug: "pets", name: "Pets" }, { ...gaming, id: "college", kind: "college" }];
  const component = await compile("../src/app/spaces/page.tsx", {
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    "next/link": { __esModule: true, default: "Link" },
    "@/components/spaces/SpaceSection": { __esModule: true, default: "SpaceSection" },
    "@/components/spaces/SpacesProvider": { useSpaces: () => ({ spaces, loading: false, error: "", reload() {} }) },
  });
  const sections = () => descendants(component.default()).filter((node) => node.type === "SpaceSection");
  const [general, user] = sections();
  assert.deepEqual([general.props.title, user.props.title], ["General spaces", "User Spaces"]);
  assert.deepEqual(general.props.spaces.map((space) => space.id), ["gaming", "pets"]);
  assert.deepEqual(user.props.spaces, []);
  assert.equal(user.props.emptyMessage, "User-created spaces will appear here.");
  assert.notEqual(general.props.id, user.props.id);
  spaces = [...spaces, { ...gaming, id: "club", name: "Student Club", is_seeded: false }];
  assert.deepEqual(sections()[1].props.spaces.map((space) => space.id), ["club"]);
});
