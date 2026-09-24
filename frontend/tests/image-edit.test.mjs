import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/images/image-edit.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2017 } });
const { clampCrop, centeredCrop, outputSize, exportImage } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString("base64")}`);

test("crop coordinates stay within source even at edges", () => {
  assert.deepEqual(clampCrop({ x: -20, y: 900, width: 9000, height: 0 }, 1200, 800), { x: 0, y: 799, width: 1200, height: 1 });
});

test("ratio presets center landscape and portrait crops", () => {
  assert.deepEqual(centeredCrop(1200, 800, 1), { x: 200, y: 0, width: 800, height: 800 });
  assert.deepEqual(centeredCrop(800, 1200, 1), { x: 0, y: 200, width: 800, height: 800 });
  assert.deepEqual(centeredCrop(1200, 800, 1.5), { x: 0, y: 0, width: 1200, height: 800 });
});

test("resizing preserves ratio, limits both axes, and never enlarges", () => {
  const crop = { x: 0, y: 0, width: 1200, height: 800 };
  assert.deepEqual(outputSize(crop, 600), { width: 600, height: 400 });
  assert.deepEqual(outputSize(crop, 9999), { width: 1200, height: 800 });
  assert.deepEqual(outputSize({ ...crop, width: 3000, height: 6000 }, 3000), { width: 2048, height: 4096 });
  assert.deepEqual(outputSize({ ...crop, width: 6000, height: 3000 }, 6000), { width: 4096, height: 2048 });
});

test("export draws the selected source region and matches actual output MIME", async () => {
  const originalDocument = globalThis.document;
  const calls = [];
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: (...args) => calls.push(args) }),
    toBlob: (callback) => callback(new Blob(['pixels'], { type: 'image/png' })) };
  globalThis.document = { createElement: () => canvas };
  try {
    const image = { naturalWidth: 1200, naturalHeight: 800 };
    const result = await exportImage(image, new File(['original'], 'photo.webp', { type: 'image/webp' }),
      { x: 200, y: 100, width: 600, height: 400 }, 300);
    assert.deepEqual(calls[0], [image, 200, 100, 600, 400, 0, 0, 300, 200]);
    assert.equal(result.name, 'photo-edited.png');
    assert.equal(result.type, 'image/png');
    assert.equal(canvas.width, 0);
  } finally { globalThis.document = originalDocument; }
});
