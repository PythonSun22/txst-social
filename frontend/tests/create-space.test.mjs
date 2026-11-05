import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const settle = () => new Promise((resolve) => setImmediate(resolve));
const jsx = (type, props, key) => ({ type, props, key });
const stub = (name) => ({ __esModule: true, default: name });
async function compile(path, imports) {
  const source = await readFile(new URL(`../src/${path}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } });
  const exports = {};
  new Function("require", "exports", outputText)((name) => {
    assert.ok(name in imports, `Unexpected import ${name}`); return imports[name];
  }, exports);
  return exports;
}
async function harness(overrides = {}, path = "components/spaces/CreateSpaceForm.tsx") {
  let hooks = [], cursor = 0, key;
  const effects = [], calls = [], navigation = [];
  const account = { profile: { id: "student", email_verified: true }, loading: false, error: "", reload: () => calls.push("reload") };
  const same = (a, b) => a && b.every((value, index) => Object.is(value, a[index]));
  const react = {
    useState(initial) {
      const hook = hooks[cursor++] ??= { value: initial };
      return [hook.value, (next) => { hook.value = typeof next === "function" ? next(hook.value) : next; }];
    },
    useRef(initial) { return hooks[cursor++] ??= { current: initial }; },
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
  const router = { replace: (destination) => navigation.push(destination) };
  const api = { createSpace: async (payload) => { calls.push(payload); return { slug: payload.slug }; },
    spaceHref: (slug) => `/spaces/${slug}`, getSpacePhoto: async () => ({ url: "https://images.test/icon" }), ...overrides.spaces };
  const imports = {
    react, "react/jsx-runtime": { jsx, jsxs: jsx }, "next/link": stub("Link"),
    "next/navigation": { useRouter: () => router },
    "@/components/images/ImageUploader": stub("ImageUploader"),
    "@/components/images/ImageProcessingNotice": stub("ImageProcessingNotice"),
    "@/lib/images/image-api": { getImagePolicy: async () => ({}), getImage: async () => ({ id: "photo", processing_status: "ready" }), ...overrides.images },
    "@/lib/spaces": api, "./SpaceIcon": stub("SpaceIcon"),
    "./SpacesProvider": { useSpaces: () => account },
  };
  const component = await compile(path, imports);
  function unmount() { hooks.forEach((hook) => hook.cleanup?.()); }
  return { calls, navigation, account, unmount,
    render(props) {
      cursor = 0;
      let tree = component.default(props);
      if (path.includes("CreateSpaceForm")) {
        if (key !== tree.key) { unmount(); hooks = []; key = tree.key; }
        tree = tree.type(tree.props);
      }
      effects.splice(0).forEach((effect) => effect());
      return tree;
    },
  };
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : [];
}
const find = (tree, type) => nodes(tree).find((node) => node.type === type);
const field = (h, id) => nodes(h.render()).find((node) => node.props?.id === id);
const change = (h, id, value) => field(h, id).props.onChange({ target: { value } });
const submit = (h) => find(h.render(), "form").props.onSubmit({ preventDefault() {} });
const submitButton = (h) => nodes(h.render()).find((node) => node.props?.type === "submit");
const fill = (h) => { change(h, "space-name", "Chess Club"); change(h, "space-description", "Play chess together."); };

test("space creation suggests a handle, saves once and refreshes existing destinations", async (t) => {
  const h = await harness(); t.after(h.unmount);
  h.render(); await settle(); fill(h);
  assert.equal(field(h, "space-slug").props.value, "chess_club");
  change(h, "space-slug", "BOBCAT_CHESS"); change(h, "space-name", "Chess Players");
  assert.equal(field(h, "space-slug").props.value, "bobcat_chess");
  submit(h); submit(h); await settle();
  assert.deepEqual(h.calls, [{ name: "Chess Players", slug: "bobcat_chess", description: "Play chess together.", rules: "", icon_image_upload_id: null }, "reload"]);
  assert.deepEqual(h.navigation, ["/spaces/bobcat_chess"]);
});

test("selected photos cannot publish until approval, and rejected photos can be removed", async (t) => {
  let result = { id: "photo", processing_status: "blocked" };
  const h = await harness({ images: { getImage: async () => result } }); t.after(h.unmount);
  h.render(); await settle(); fill(h);
  const selected = { file: {} };
  find(h.render(), "ImageUploader").props.onSelected(selected);
  assert.equal(submitButton(h).props.disabled, true);
  submit(h); assert.deepEqual(h.calls, []);
  find(h.render(), "ImageUploader").props.onUploaded({ id: "photo", processing_status: "pending" });
  assert.equal(submitButton(h).props.disabled, true);
  await find(h.render(), "ImageProcessingNotice").props.onProcessed(new AbortController().signal);
  assert.equal(submitButton(h).props.disabled, true);
  result = { id: "photo", processing_status: "ready" };
  await find(h.render(), "ImageProcessingNotice").props.onProcessed(new AbortController().signal);
  assert.equal(submitButton(h).props.disabled, false);
  submit(h); await settle();
  assert.equal(h.calls[0].icon_image_upload_id, "photo");
});

test("a photo can be removed and a failed request keeps the form ready for retry", async (t) => {
  const h = await harness({ spaces: { createSpace: async () => { throw new Error("That handle is taken."); } } }); t.after(h.unmount);
  h.render(); await settle(); fill(h);
  find(h.render(), "ImageUploader").props.onSelected({ file: {} });
  nodes(h.render()).find((node) => node.type === "button" && node.props.children === "Remove photo").props.onClick();
  assert.equal(submitButton(h).props.disabled, false);
  submit(h); await settle();
  assert.equal(field(h, "space-name").props.value, "Chess Club");
  assert.ok(nodes(h.render()).some((node) => node.props?.role === "alert" && node.props.children === "That handle is taken."));
  assert.deepEqual(h.navigation, []);
});

test("reserved handles and unverified or signed-out accounts cannot submit", async (t) => {
  const h = await harness(); t.after(h.unmount);
  h.render(); await settle(); fill(h); change(h, "space-slug", "create");
  assert.equal(submitButton(h).props.disabled, true);
  h.account.profile = { ...h.account.profile, email_verified: false };
  assert.equal(find(h.render(), "form"), undefined);
  h.account.profile = null;
  assert.equal(find(h.render(), "form"), undefined);
});

test("changing accounts clears the old form and aborts pending creation", async (t) => {
  let resolve, signal;
  const h = await harness({ spaces: { createSpace: async (_, requestSignal) => {
    signal = requestSignal; return new Promise((done) => { resolve = done; });
  } } }); t.after(h.unmount);
  h.render(); await settle(); fill(h); submit(h);
  h.account.profile = { id: "another-student", email_verified: true };
  h.render(); assert.equal(signal.aborted, true);
  assert.equal(field(h, "space-name").props.value, "");
  resolve({ slug: "chess_club" }); await settle();
  assert.deepEqual(h.navigation, []);
  assert.deepEqual(h.calls, []);
});

test("space avatars discard stale image responses when switching spaces", async (t) => {
  let resolve, signal;
  const h = await harness({ spaces: { getSpacePhoto: async (id, requestSignal) => {
    if (id === "old") { signal = requestSignal; return new Promise((done) => { resolve = done; }); }
    return { url: "https://images.test/new" };
  } } }, "components/spaces/SpaceAvatar.tsx"); t.after(h.unmount);
  const space = { slug: "club", kind: "community", icon_image_upload_id: "old" };
  h.render({ space });
  h.render({ space: { ...space, icon_image_upload_id: "new" } }); await settle();
  resolve({ url: "https://images.test/old" }); await settle();
  assert.equal(signal.aborted, true);
  const tree = h.render({ space: { ...space, icon_image_upload_id: "new" } });
  assert.equal(find(tree, "img").props.src, "https://images.test/new");
});
