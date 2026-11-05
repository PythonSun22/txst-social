import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const settle = () => new Promise((resolve) => setImmediate(resolve));
const jsx = (type, props, key) => ({ type, props, key });
const stub = (name) => ({ __esModule: true, default: name });
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

// Exercise the real components with controlled requests, using the existing
// lightweight hook-testing approach. No Auth service or browser is needed.
async function harness(path, modules, initialProps, unwrap = false) {
  let hooks = [];
  const effects = [];
  let cursor = 0;
  let props = initialProps;
  let key;
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
  const source = await readFile(new URL(`../src/${path}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  const imports = { react: runtime, "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" }, "next/link": stub("Link"), ...modules };
  const component = {};
  new Function("require", "exports", compiled.outputText)((name) => {
    assert.ok(name in imports, `Unexpected import ${name}`);
    return imports[name];
  }, component);
  function unmount() { hooks.forEach((hook) => hook.cleanup?.()); }
  return {
    render(nextProps = props) {
      props = nextProps;
      cursor = 0;
      let tree;
      if (unwrap) {
        const shell = component.default(props);
        if (key !== shell.key) { unmount(); hooks = []; key = shell.key; }
        tree = shell.type(shell.props);
      } else tree = component.default(props);
      effects.splice(0).forEach((effect) => effect());
      return tree;
    },
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
  return typeof tree === "string" || typeof tree === "number" ? String(tree) : "";
}
const byType = (tree, type) => nodes(tree).filter((node) => node.type === type);
const profile = (id) => ({ id, username: id, display_name: `Student ${id}`, bio: "Bio", student_level: "junior",
  major: "Computer Science", profile_image_upload_id: `${id}-avatar`, banner_image_upload_id: `${id}-banner`,
  home_college: { short_name: "Science", accent_hex: "#501214" }, followed_space_count: 2, joined_community_count: 1,
  follower_count: 3, following_count: 4, post_karma: 5, comment_karma: 6 });
const account = { ...profile("owner"), username_chosen: true, academic_setup_completed: true, email_verified: true };
const getProfileSetupPath = (profile) => !profile.username_chosen ? "/choose-username"
  : !profile.academic_setup_completed ? "/choose-college" : null;

async function containerHarness(props, overrides = {}) {
  const listeners = new Set();
  const navigation = [];
  const router = { replace: (path) => navigation.push(path) };
  const calls = { ownPosts: 0, publicPosts: [], publicProfiles: [], follows: [], spaceReloads: 0 };
  const modules = {
    "next/navigation": { useRouter: () => router },
    "@/lib/api": {
      getPublicProfile: async (id) => { calls.publicProfiles.push(id); return { ...profile(id), is_following: false }; },
      setUserFollow: async (...args) => { calls.follows.push(args); return { following: true, follower_count: 4 }; },
    },
    "@/lib/profiles": { getCurrentProfile: async () => account, getProfileSetupPath },
    "@/lib/posts": {
      getMyPosts: async () => { calls.ownPosts++; return [{ id: "own-pending", status: "pending" }]; },
      getUserPosts: async (id) => { calls.publicPosts.push(id); return [{ id: `${id}-public`, status: "approved" }]; },
    },
    "@/lib/supabase": { getSupabase: () => ({ auth: { onAuthStateChange(callback) {
      listeners.add(callback);
      return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
    } } }) },
    "./EditProfileModal": stub("EditProfileModal"),
    "@/components/spaces/SpacesProvider": { useSpaces: () => ({ reload: () => calls.spaceReloads++ }) },
    "./ProfileView": stub("ProfileView"),
    "@/components/images/ImageProcessingNotice": stub("ImageProcessingNotice"),
    ...overrides,
  };
  if (overrides["@/lib/profiles"]) modules["@/lib/profiles"].getProfileSetupPath = getProfileSetupPath;
  return { ...await harness("components/profiles/ProfileContainer.tsx", modules, props, true), calls, navigation,
    authChanged: () => listeners.forEach((callback) => callback()) };
}

test("own profile keeps owner actions and pending posts in the shared view", async (t) => {
  const h = await containerHarness({});
  t.after(h.unmount);
  h.render(); await settle();
  const view = byType(h.render(), "ProfileView")[0].props;
  assert.equal(view.isOwn, true);
  assert.equal(view.profile.id, "owner");
  assert.equal(view.posts[0].status, "pending");
  assert.match(content(view.actions), /Edit Profile.*Sign Out/);
  assert.equal(h.calls.ownPosts, 1);
  assert.deepEqual(h.calls.publicProfiles, []);
});

test("editing a home college refreshes the shared sidebar profile", async (t) => {
  const h = await containerHarness({}); t.after(h.unmount);
  h.render(); await settle();
  const view = byType(h.render(), "ProfileView")[0].props;
  byType(view.actions, "button").find((button) => content(button) === "Edit Profile").props.onClick();
  const updated = { ...account, home_college: { id: "business", name: "College of Business", slug: "business" } };
  byType(h.render(), "EditProfileModal")[0].props.onSaved(updated);
  assert.equal(h.calls.spaceReloads, 1);
  assert.equal(byType(h.render(), "ProfileView")[0].props.profile.home_college.id, "business");
});

test("another student's profile uses their data with viewer-owned actions", async (t) => {
  const h = await containerHarness({ profileId: "other" });
  t.after(h.unmount);
  h.render(); await settle();
  const view = byType(h.render(), "ProfileView")[0].props;
  assert.equal(view.isOwn, false);
  assert.equal(view.profile.id, "other");
  assert.equal(view.viewer.id, "owner");
  assert.equal(view.notices, null);
  assert.doesNotMatch(content(view.actions), /Edit Profile|Sign Out/);
  assert.deepEqual(h.calls.publicPosts, ["other"]);
  byType(view.actions, "button")[0].props.onClick();
  await settle();
  const followed = byType(h.render(), "ProfileView")[0].props;
  assert.equal(h.calls.follows[0][0], "other");
  assert.equal(followed.profile.follower_count, 4);
  assert.match(content(followed.actions), /Unfollow/);
});

test("an own-profile link keeps the existing redirect and username setup gate", async (t) => {
  const h = await containerHarness({ profileId: "owner" });
  t.after(h.unmount);
  h.render(); await settle();
  assert.deepEqual(h.navigation, ["/profile"]);
  assert.deepEqual(h.calls.publicProfiles, []);
  const incomplete = await containerHarness({}, {
    "@/lib/profiles": { getCurrentProfile: async () => ({ ...account, username_chosen: false }) },
  });
  t.after(incomplete.unmount);
  incomplete.render(); await settle();
  assert.deepEqual(incomplete.navigation, ["/choose-username"]);
});

test("rapid profile navigation discards the previous student's response", async (t) => {
  const old = deferred();
  let oldSignal;
  const h = await containerHarness({ profileId: "old" }, {
    "@/lib/api": { getPublicProfile: async (id, signal) => {
      if (id === "old") { oldSignal = signal; return old.promise; }
      return { ...profile(id), is_following: false };
    } },
  });
  t.after(h.unmount);
  h.render(); await settle();
  h.render({ profileId: "new" }); await settle();
  old.resolve({ ...profile("old"), is_following: false }); await settle();
  assert.equal(oldSignal.aborted, true);
  assert.equal(byType(h.render(), "ProfileView")[0].props.profile.id, "new");
  assert.deepEqual(h.calls.publicPosts, ["new"]);
});

test("signing out clears private profile data and owner actions", async (t) => {
  let signedIn = true;
  const h = await containerHarness({}, { "@/lib/profiles": { getCurrentProfile: async () => signedIn ? account : null } });
  t.after(h.unmount);
  h.render(); await settle();
  signedIn = false; h.authChanged(); await settle();
  assert.equal(byType(h.render(), "ProfileView").length, 0);
  assert.match(content(h.render()), /sign in/);
});

for (const isOwn of [true, false]) {
  test(`${isOwn ? "own" : "public"} profile loads photos and banner in the same styled container`, async (t) => {
    const requests = [];
    const imagePath = (id, variant, own) => `/images/${id}/${own ? "preview" : "published-preview"}?variant=${variant}`;
    const props = { profile: profile("target"), viewer: account, isOwn, posts: [], postsLoading: false,
      postsError: "", actions: null, actionError: "", onRetry() {}, onDelete() {}, onLike() {}, onStatus() {} };
    const h = await harness("components/profiles/ProfileView.tsx", {
      "@/lib/profiles": { profileImagePath: imagePath, getProfileImage: async (id, variant, own) => {
        requests.push({ id, variant, own }); return { url: `https://images.example/${id}` };
      } },
      "@/components/posts/PostCard": stub("PostCard"), "@/components/ui/PawIcon": stub("PawIcon"),
      "@/components/communities/JoinedCommunitiesCard": stub("JoinedCommunitiesCard"),
      "@/components/UserConnections": stub("UserConnections"), "@/components/images/ImageViewer": stub("ImageViewer"),
      "@/components/posts/SortBar": stub("SortBar"),
    }, props);
    t.after(h.unmount);
    h.render(); await settle();
    const tree = h.render();
    assert.deepEqual(requests, [{ id: "target-avatar", variant: "avatar_large", own: isOwn }, { id: "target-banner", variant: "banner", own: isOwn }]);
    assert.deepEqual(byType(tree, "img").map((node) => node.props.src).sort(), ["https://images.example/target-avatar", "https://images.example/target-banner"]);
    assert.ok(nodes(tree).some((node) => node.props?.className === "absolute inset-x-0 bottom-0 h-1 bg-accent"));
    assert.ok(nodes(tree).some((node) => node.props?.className?.includes("border-[3px] border-card bg-accent")));
    assert.match(content(tree), isOwn ? /My Posts.*Posts you share/ : /Student target's Posts.*Posts they share/);
    assert.equal(byType(tree, "JoinedCommunitiesCard")[0].props.profileId, isOwn ? undefined : "target");
    nodes(tree).find((node) => node.props?.["aria-label"] === "View profile photo").props.onClick();
    assert.equal(byType(h.render(), "ImageViewer")[0].props.resource, imagePath("target-avatar", "avatar_large", isOwn));
  });

  test(`${isOwn ? "own" : "public"} joined-space empty state uses the correct pronouns`, async (t) => {
    const h = await harness("components/communities/JoinedCommunitiesCard.tsx", {
      "@/components/spaces/SpaceList": stub("SpaceList"),
      "@/components/spaces/SpacesProvider": { useSpaces: () => ({ spaces: [], loading: false, error: "" }) },
      "@/lib/spaces": { getProfileSpaces: async () => [] },
    }, { profileId: isOwn ? undefined : "target" });
    t.after(h.unmount);
    h.render(); await settle();
    assert.match(content(h.render()), isOwn ? /Communities you join will appear here/ : /Communities they join will appear here/);
  });
}

test("switching connection lists ignores stale responses and keeps profile links", async (t) => {
  const old = deferred();
  let signal;
  const h = await harness("components/UserConnections.tsx", {
    "@/lib/api": { getProfileConnections: async (_, kind, abortSignal) => {
      if (kind === "followers") { signal = abortSignal; return old.promise; }
      return [{ id: "new-person", username: "newperson" }];
    } },
  }, { profileId: "target", followerCount: 1, followingCount: 1, ownProfile: false });
  t.after(h.unmount);
  byType(h.render(), "button")[0].props.onClick();
  byType(h.render(), "button")[1].props.onClick(); await settle();
  old.resolve([{ id: "old-person", username: "oldperson" }]); await settle();
  assert.equal(signal.aborted, true);
  assert.match(content(h.render()), /People they follow/);
  assert.deepEqual(byType(h.render(), "Link").map((node) => node.props.href), ["/profile/new-person"]);
});
