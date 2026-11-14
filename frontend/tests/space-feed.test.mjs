import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/components/posts/SpaceFeed.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
});
const settle = () => new Promise((resolve) => setImmediate(resolve));
const page = (ids, next_cursor = null) => ({ items: ids.map((id) => ({ id, status: "approved" })), next_cursor });
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

// Exercise the component's requests and actions with the same lightweight
// hook harness used by the image tests; no browser, Auth server or database.
function feedHarness(fetchPosts, initialSpace = "general") {
  let hooks = [];
  const effects = [];
  const listeners = new Set();
  let cursor = 0;
  let key;
  let currentSpace = initialSpace;
  let profile = { id: "student", email_verified: true };
  const unchanged = (before, after) => before && after.every((value, index) => Object.is(value, before[index]));
  const runtime = {
    useState(initial) {
      const index = cursor++;
      const hook = hooks[index] ??= { value: initial };
      return [hook.value, (next) => { hook.value = typeof next === "function" ? next(hook.value) : next; }];
    },
    useRef(initial) {
      const index = cursor++;
      return hooks[index] ??= { current: initial };
    },
    useCallback(callback, dependencies) {
      const index = cursor++;
      if (!unchanged(hooks[index]?.dependencies, dependencies)) hooks[index] = { dependencies, callback };
      return hooks[index].callback;
    },
    useEffect(effect, dependencies) {
      const index = cursor++;
      if (unchanged(hooks[index]?.dependencies, dependencies)) return;
      hooks[index]?.cleanup?.();
      const hook = hooks[index] = { dependencies };
      effects.push(() => { hook.cleanup = effect(); });
    },
  };
  const jsx = (type, props, key) => ({ type, props, key });
  const modules = {
    react: runtime,
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    "@/components/posts/PostCard": { __esModule: true, default: "PostCard" },
    "@/lib/posts": { fetchPosts },
    "@/lib/profiles": { getCurrentProfile: async () => profile },
    "@/lib/supabase": { getSupabase: () => ({ auth: { onAuthStateChange(callback) {
      listeners.add(callback);
      return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
    } } }) },
  };
  const exports = {};
  new Function("require", "exports", compiled.outputText)((name) => {
    assert.ok(name in modules, `Unexpected import: ${name}`);
    return modules[name];
  }, exports);

  function unmount() { hooks.forEach((hook) => hook.cleanup?.()); }
  return {
    render(space = currentSpace) {
      currentSpace = space;
      const shell = exports.default({ space, emptyMessage: "This space has no posts." });
      if (shell.key !== key) {
        unmount();
        hooks = [];
        key = shell.key;
      }
      cursor = 0;
      const tree = shell.type(shell.props);
      effects.splice(0).forEach((effect) => effect());
      return tree;
    },
    authChanged(nextProfile) { profile = nextProfile; listeners.forEach((callback) => callback()); },
    unmount,
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
  return typeof tree === "string" ? tree : "";
}
const cards = (tree) => nodes(tree).filter((node) => node.type === "PostCard").map((node) => node.props);
const button = (tree, label) => nodes(tree).find((node) => node.type === "button" && content(node) === label);

for (const space of ["general", "business"]) {
  test(`FR-13/60/66: ${space} loads and paginates only its own posts`, async (t) => {
    const calls = [];
    const harness = feedHarness(async (cursor, signal, slug) => {
      calls.push({ cursor, slug });
      return cursor ? page(["first", "second"]) : page(["first"], "next-page");
    }, space);
    t.after(() => harness.unmount());
    assert.match(content(harness.render()), /Loading posts/);
    await settle();
    await button(harness.render(), "Load more").props.onClick();
    await settle();
    assert.deepEqual(calls, [{ cursor: undefined, slug: space }, { cursor: "next-page", slug: space }]);
    assert.deepEqual(cards(harness.render()).map(({ post }) => post.id), ["first", "second"]);
    assert.equal(button(harness.render(), "Load more"), undefined);
  });
}

test("a failed first page can reload and recover to the empty state", async (t) => {
  let attempts = 0;
  const harness = feedHarness(async () => {
    if (++attempts === 1) throw new Error("API unavailable");
    return page([]);
  });
  t.after(() => harness.unmount());
  harness.render();
  await settle();
  const failed = harness.render();
  assert.match(content(failed), /API unavailable/);
  assert.doesNotMatch(content(failed), /This space has no posts/);
  button(failed, "Reload feed").props.onClick();
  harness.render();
  await settle();
  assert.match(content(harness.render()), /This space has no posts/);
});

test("pagination failures keep loaded posts and retry the same cursor", async (t) => {
  let attempts = 0;
  const cursors = [];
  const harness = feedHarness(async (cursor) => {
    if (!cursor) return page(["first"], "next-page");
    cursors.push(cursor);
    if (++attempts === 1) throw new Error("Temporary pagination failure");
    return page(["second"]);
  });
  t.after(() => harness.unmount());
  harness.render();
  await settle();
  button(harness.render(), "Load more").props.onClick();
  await settle();
  const failed = harness.render();
  assert.deepEqual(cards(failed).map(({ post }) => post.id), ["first"]);
  assert.match(content(failed), /Temporary pagination failure/);
  button(failed, "Retry loading more").props.onClick();
  await settle();
  assert.deepEqual(cursors, ["next-page", "next-page"]);
  assert.deepEqual(cards(harness.render()).map(({ post }) => post.id), ["first", "second"]);
});

test("switching spaces aborts pagination and prevents old posts from appearing", async (t) => {
  const pending = deferred();
  let oldSignal;
  const harness = feedHarness(async (cursor, signal, space) => {
    if (cursor) { oldSignal = signal; return pending.promise; }
    return page([space], space === "general" ? "next-page" : null);
  });
  t.after(() => harness.unmount());
  harness.render();
  await settle();
  const loadMore = button(harness.render(), "Load more");
  loadMore.props.onClick();
  loadMore.props.onClick();
  assert.equal(cards(harness.render("business")).length, 0);
  assert.equal(oldSignal.aborted, true);
  await settle();
  pending.resolve(page(["old-general-post"]));
  await settle();
  assert.deepEqual(cards(harness.render()).map(({ post }) => post.id), ["business"]);
});

test("signing out cancels old pagination and refreshes viewer-specific posts", async (t) => {
  const pending = deferred();
  let signedOut = false;
  let oldSignal;
  const harness = feedHarness(async (cursor, signal) => {
    if (cursor) { oldSignal = signal; return pending.promise; }
    return signedOut ? page(["public"]) : page(["own-pending"], "next-page");
  });
  t.after(() => harness.unmount());
  harness.render();
  await settle();
  button(harness.render(), "Load more").props.onClick();
  signedOut = true;
  harness.authChanged(null);
  await settle();
  pending.resolve(page(["private-old-page"]));
  await settle();
  assert.equal(oldSignal.aborted, true);
  const result = cards(harness.render());
  assert.deepEqual(result.map(({ post }) => post.id), ["public"]);
  assert.equal(result[0].profile, null);
});

test("likes, screening updates and deletion update the shared feed", async (t) => {
  const harness = feedHarness(async () => page(["first"]));
  t.after(() => harness.unmount());
  harness.render();
  await settle();
  cards(harness.render())[0].onLike("first", { liked: true, like_count: 1 });
  cards(harness.render())[0].onStatus("first", "blocked", false);
  assert.equal(cards(harness.render())[0].post.like_count, 1);
  assert.equal(cards(harness.render())[0].post.status, "blocked");
  cards(harness.render())[0].onDelete("first");
  assert.equal(cards(harness.render()).length, 0);
});
