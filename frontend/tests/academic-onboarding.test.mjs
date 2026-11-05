import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const settle = () => new Promise((resolve) => setImmediate(resolve));
const jsx = (type, props) => ({ type, props });
const card = { __esModule: true, default: "AccountSetupCard" };
async function load(path, imports) {
  const source = await readFile(new URL(`../src/${path}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } });
  const exports = {};
  new Function("require", "exports", outputText)((name) => {
    assert.ok(name in imports, `Unexpected import ${name}`);
    return imports[name];
  }, exports);
  return exports;
}
const profileApi = await load("lib/profiles.ts", { "./api": {}, "./supabase": {} });
const account = { username_chosen: true, academic_setup_completed: false };
const options = {
  colleges: [{ id: "science", name: "Science" }, { id: "business", name: "Business" }, { id: "no-majors", name: "No majors" }],
  majors: [{ id: "cs", name: "Computer Science", degree: "B.S.", college_id: "science" },
    { id: "accounting", name: "Accounting", degree: "B.B.A.", college_id: "business" }],
  student_levels: ["freshman", "sophomore", "junior", "senior", "graduate"],
};
async function harness(path = "components/auth/CollegeMajorSetup.tsx", overrides = {}, extraModules = {}) {
  const hooks = [], effects = [], navigation = [], submissions = [];
  let cursor = 0, reloads = 0;
  const react = {
    useState(initial) {
      const hook = hooks[cursor++] ??= { value: initial };
      return [hook.value, (next) => { hook.value = typeof next === "function" ? next(hook.value) : next; }];
    },
    useRef(initial) { return hooks[cursor++] ??= { current: initial }; },
    useEffect(effect, dependencies) {
      const index = cursor++, old = hooks[index];
      if (old && dependencies.every((value, i) => Object.is(value, old.dependencies[i]))) return;
      old?.cleanup?.();
      const hook = hooks[index] = { dependencies };
      effects.push(() => { hook.cleanup = effect(); });
    },
  };
  const router = { replace: (path) => navigation.push(path) };
  const modules = {
    react, "react/jsx-runtime": { jsx, jsxs: jsx },
    "next/navigation": { useRouter: () => router },
    "./AccountSetupCard": card, "@/components/auth/AccountSetupCard": card,
    "@/lib/profiles": { getCurrentProfile: async () => account, getProfileOptions: async () => options,
      getProfileSetupPath: profileApi.getProfileSetupPath,
      completeAcademicSetup: async (...args) => submissions.push(args), ...overrides },
    "@/components/spaces/SpacesProvider": { useSpaces: () => ({ reload: () => reloads++ }) },
    ...extraModules,
  };
  const component = await load(path, modules);
  return { navigation, submissions, get reloads() { return reloads; },
    render() { cursor = 0; const tree = component.default(); effects.splice(0).forEach((effect) => effect()); return tree; },
    unmount() { hooks.forEach((hook) => hook.cleanup?.()); },
  };
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : [];
}
const find = (tree, type) => nodes(tree).find((node) => node.type === type);
const select = (tree, id) => nodes(tree).find((node) => node.props?.id === id);
const change = (h, id, value) => select(h.render(), id).props.onChange({ target: { value } });
const submit = (h) => find(h.render(), "form").props.onSubmit({ preventDefault() {} });
function choose(h) {
  change(h, "college-choice", "science"); change(h, "major-choice", "cs");
  change(h, "level-choice", "sophomore");
}

test("setup routing resumes the first unfinished step", () => {
  assert.equal(profileApi.getProfileSetupPath({ username_chosen: false, academic_setup_completed: false }), "/choose-username");
  assert.equal(profileApi.getProfileSetupPath(account), "/choose-college");
  assert.equal(profileApi.getProfileSetupPath({ ...account, academic_setup_completed: true }), null);
});

test("saving a username opens the academic step in the shared setup card", async (t) => {
  const saved = [];
  const h = await harness("app/choose-username/page.tsx", {
    getCurrentProfile: async () => ({ ...account, username_chosen: false }),
    chooseUsername: async (name) => saved.push(name),
  });
  t.after(h.unmount);
  h.render(); await settle();
  assert.equal(h.render().type, "AccountSetupCard");
  find(h.render(), "input").props.onChange({ target: { value: " Bobcat_1 " } });
  submit(h); await settle();
  assert.deepEqual(saved, ["bobcat_1"]);
  assert.deepEqual(h.navigation, ["/choose-college"]);
});

test("academic form filters majors by college and clears a previous major", async (t) => {
  const h = await harness(); t.after(h.unmount);
  h.render(); await settle();
  assert.equal(h.render().type, "AccountSetupCard");
  assert.equal(select(h.render(), "major-choice").props.disabled, true);
  const colleges = nodes(select(h.render(), "college-choice")).filter((node) => node.type === "option");
  assert.deepEqual(colleges.map((node) => node.props.value), ["", "science", "business"]);
  choose(h);
  assert.equal(find(h.render(), "button").props.disabled, false);
  assert.deepEqual(nodes(select(h.render(), "major-choice")).filter((node) => node.type === "option").map((node) => node.props.value), ["", "cs"]);
  change(h, "college-choice", "business");
  assert.equal(select(h.render(), "major-choice").props.value, "");
  assert.equal(find(h.render(), "button").props.disabled, true);
});

test("saving academics refreshes memberships and opens the profile", async (t) => {
  const h = await harness(); t.after(h.unmount);
  h.render(); await settle(); choose(h);
  submit(h); submit(h); await settle();
  assert.equal(h.submissions.length, 1);
  assert.deepEqual(h.submissions[0].slice(0, 3), ["science", "cs", "sophomore"]);
  assert.equal(h.reloads, 1);
  assert.deepEqual(h.navigation, ["/profile"]);
});

test("failed saves preserve choices, show feedback and allow retry", async (t) => {
  let attempts = 0;
  const h = await harness(undefined, { completeAcademicSetup: async () => {
    if (++attempts === 1) throw new Error("Please try again.");
  } }); t.after(h.unmount);
  h.render(); await settle(); choose(h);
  submit(h); await settle();
  assert.equal(h.render().props.error, "Please try again.");
  assert.equal(select(h.render(), "major-choice").props.value, "cs");
  assert.equal(select(h.render(), "level-choice").props.value, "sophomore");
  assert.deepEqual(h.navigation, []);
  submit(h); await settle();
  assert.equal(attempts, 2);
  assert.deepEqual(h.navigation, ["/profile"]);
});

for (const [profile, destination] of [[null, "/login"], [{ ...account, username_chosen: false }, "/choose-username"],
  [{ ...account, academic_setup_completed: true }, "/profile"]]) {
  test(`academic page redirects to ${destination} when this step is unavailable`, async (t) => {
    const h = await harness(undefined, { getCurrentProfile: async () => profile }); t.after(h.unmount);
    h.render(); await settle();
    assert.deepEqual(h.navigation, [destination]);
    assert.equal(find(h.render(), "form"), undefined);
  });
}

test("sign-in resumes academic setup after the username was chosen", async (t) => {
  const h = await harness("components/auth/AuthForm.tsx", {}, {
    "@supabase/supabase-js": { AuthError: Error },
    "@/lib/supabase": { getSupabase: () => ({ auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } }) },
  }); t.after(h.unmount);
  h.render(); await settle(); h.render();
  assert.deepEqual(h.navigation, ["/choose-college"]);
});

test("leaving during save cancels the request and prevents later navigation", async () => {
  let resolve, signal;
  const h = await harness(undefined, { completeAcademicSetup: async (_, __, ___, requestSignal) => {
    signal = requestSignal;
    await new Promise((done) => { resolve = done; });
  } });
  h.render(); await settle(); choose(h); submit(h); h.unmount(); resolve(); await settle();
  assert.equal(signal.aborted, true);
  assert.equal(h.reloads, 0);
  assert.deepEqual(h.navigation, []);
});

test("student level is required and uses the existing profile options", async (t) => {
  const h = await harness(); t.after(h.unmount);
  h.render(); await settle();
  change(h, "college-choice", "science"); change(h, "major-choice", "cs");
  assert.equal(find(h.render(), "button").props.disabled, true);
  submit(h); await settle();
  assert.equal(h.submissions.length, 0);
  const choices = nodes(select(h.render(), "level-choice")).filter((node) => node.type === "option");
  assert.deepEqual(choices.map((node) => node.props.value), ["", ...options.student_levels]);
  assert.equal(choices[2].props.children, "Sophomore");
  change(h, "level-choice", "sophomore");
  assert.equal(find(h.render(), "button").props.disabled, false);
  change(h, "college-choice", "business");
  assert.equal(select(h.render(), "level-choice").props.value, "sophomore");
});
