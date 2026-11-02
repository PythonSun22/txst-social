import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

// Drive the real component's effects, retries and cancellation without a DOM.
async function noticeHarness(api, onProcessed) {
  const hooks = [];
  const effects = [];
  const timers = new Set();
  let cursor = 0;
  const runtime = {
    useState(initial) {
      const index = cursor++;
      hooks[index] ??= { value: initial };
      return [hooks[index].value, next => {
        hooks[index].value = typeof next === "function" ? next(hooks[index].value) : next;
      }];
    },
    useEffect(effect, dependencies) {
      const index = cursor++;
      const previous = hooks[index];
      if (previous && dependencies.every((value, i) => value === previous.dependencies[i])) return;
      previous?.cleanup?.();
      hooks[index] = { dependencies };
      effects.push(() => { hooks[index].cleanup = effect(); });
    },
    createElement(type, props, ...children) { return { type, props, children }; },
  };
  const source = (await readFile(new URL("../src/components/images/ImageProcessingNotice.tsx", import.meta.url), "utf8"))
    .replace('import { useEffect, useState } from "react";', "const { useEffect, useState } = runtime; const React = runtime;")
    .replace('import { getImage, retryImage, type SavedImage } from "@/lib/images/image-api";',
      "const { getImage, retryImage } = api;");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  });
  const component = {};
  new Function("exports", "runtime", "api", "setTimeout", "clearTimeout", compiled.outputText)(
    component, runtime, api,
    callback => { timers.add(callback); return callback; },
    callback => timers.delete(callback),
  );
  return {
    timers,
    render() {
      cursor = 0;
      const tree = component.default({ id: "avatar", label: "Profile photo", onProcessed });
      effects.splice(0).forEach(effect => effect());
      return tree;
    },
    tick() {
      const callbacks = [...timers];
      timers.clear();
      callbacks.forEach(callback => callback());
    },
    unmount() { hooks.forEach(hook => hook.cleanup?.()); },
  };
}

const settle = () => new Promise(resolve => setImmediate(resolve));
const image = (processing_status, can_retry = false) => ({
  id: "avatar", processing_status, can_retry, processing_message: processing_status,
});

test("FR-32: a failed profile image can retry and refresh the active profile on success", async () => {
  let saved = image("failed", true);
  const refreshed = [];
  const harness = await noticeHarness({
    getImage: async () => saved,
    retryImage: async () => saved = image("pending"),
  }, async () => refreshed.push(saved.processing_status));
  harness.render();
  await settle();
  assert.deepEqual(refreshed, ["failed"]);
  const retry = harness.render().children.find(child => child?.type === "button");
  await retry.props.onClick();
  harness.render();
  await settle();
  assert.equal(harness.timers.size, 1);
  saved = image("ready");
  harness.tick();
  await settle();
  assert.deepEqual(refreshed, ["failed", "ready"]);
  assert.equal(harness.timers.size, 0, "terminal results stop polling after the profile is refreshed");
  harness.unmount();
});

test("profile refresh failures keep polling until activation is visible", async () => {
  let refreshes = 0;
  const harness = await noticeHarness({ getImage: async () => image("ready") }, async () => {
    if (++refreshes === 1) throw new Error("Temporary profile read failure");
  });
  harness.render();
  await settle();
  assert.equal(harness.timers.size, 1);
  harness.tick();
  await settle();
  assert.equal(refreshes, 2);
  assert.equal(harness.timers.size, 0);
  harness.unmount();
});

test("unmount cancels an in-flight image read without refreshing the old profile", async () => {
  let resolveImage;
  let signal;
  const harness = await noticeHarness({ getImage: (_, abortSignal) => {
    signal = abortSignal;
    return new Promise(resolve => { resolveImage = resolve; });
  } }, () => assert.fail("An unmounted notice must not update the profile"));
  harness.render();
  harness.unmount();
  resolveImage(image("ready"));
  await settle();
  assert.equal(signal.aborted, true);
  assert.equal(harness.timers.size, 0);
});
