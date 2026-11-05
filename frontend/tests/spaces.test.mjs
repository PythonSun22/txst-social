import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const settle = () => new Promise((resolve) => setImmediate(resolve));
const gaming = { id: "gaming", slug: "gaming", name: "Gaming", kind: "community", follower_count: 0, is_following: false };
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
