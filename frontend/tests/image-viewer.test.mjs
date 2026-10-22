import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

test("expanded viewer survives a queued close event from Strict Mode effect replay", async () => {
  // Exercise the component's effects and handlers without network or DOM deps.
  // Native dialog.close() queues its close event; React can reopen it first.
  const source = (await readFile(new URL("../src/components/ImageViewer.tsx", import.meta.url), "utf8"))
    .replace('import { useEffect, useRef, useState } from "react";', `
      const effects = [];
      const queued = [];
      const element = {
        open: false,
        showModal() { this.open = true; },
        close() { this.open = false; queued.push(() => tree.props.onClose({ currentTarget: element })); }
      };
      const useEffect = effect => effects.push(effect);
      const useRef = () => ({ current: element });
      const useState = initial => [initial, () => {}];
      const React = { createElement: (type, props, ...children) => ({ type, props, children }) };
      let tree;
      export const harness = { effects, queued, element, render: props => tree = ImageViewer(props) };
    `)
    .replace('import { apiRequest } from "@/lib/api";', 'const apiRequest = async () => ({ url: "https://example.test/expanded.webp" });');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React },
  });
  const { harness } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString("base64")}`);
  let dismissals = 0;
  const tree = harness.render({ resource: "/posts/test/media/0/preview?variant=expanded",
    title: "Expanded image", onClose: () => dismissals++ });
  const cleanups = harness.effects.map(effect => effect());
  cleanups.forEach(cleanup => cleanup?.());
  const finalCleanups = harness.effects.map(effect => effect());
  assert.equal(harness.element.open, true);
  harness.queued.splice(0).forEach(deliver => deliver());
  assert.equal(dismissals, 0, "replayed cleanup must not dismiss the reopened viewer");

  let prevented = false;
  tree.props.onCancel({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(dismissals, 1, "Escape still requests dismissal");

  harness.element.close();
  harness.queued.splice(0).forEach(deliver => deliver());
  assert.equal(dismissals, 2, "an actual closed dialog still requests dismissal");
  finalCleanups.forEach(cleanup => cleanup?.());
});
