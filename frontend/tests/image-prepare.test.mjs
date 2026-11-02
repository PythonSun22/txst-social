import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/images/image-prepare.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2017 } });
const { prepareImage } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString("base64")}`);

function browser(width, height, encode) {
  const original = { Image: globalThis.Image, document: globalThis.document };
  const draws = [];
  const context = { drawImage: (...args) => draws.push(args), fillRect() {} };
  const canvas = { width: 0, height: 0, getContext: () => context,
    toBlob: (callback, type, quality) => callback(encode(canvas, type, quality)) };
  globalThis.Image = class { naturalWidth = width; naturalHeight = height; async decode() {} };
  globalThis.document = { createElement: () => canvas };
  return { canvas, draws, restore() { Object.assign(globalThis, original); } };
}
const selection = (width, height) => ({ width, height, errors: [], previewUrl: null,
  file: new File([new Uint8Array(5_000_000)], "photo.png", { type: "image/png" }) });

test("large post selection becomes bounded WebP, preserving ratio and releasing canvas", async () => {
  const env = browser(4000, 3000, () => new Blob([new Uint8Array(600_000)], { type: "image/webp" }));
  try {
    const input = selection(4000, 3000);
    const prepared = await prepareImage(input, "post", 2_000_000);
    assert.equal(prepared.file.size, 600_000);
    assert.equal(prepared.file.type, "image/webp");
    assert.equal(prepared.file.name, "photo.webp");
    assert.deepEqual([prepared.width, prepared.height], [2000, 1500]);
    assert.equal(input.file.size, 5_000_000);
    assert.equal(env.canvas.width, 0);
  } finally { env.restore(); }
});

test("avatar is centered square and banner keeps its aspect ratio", async () => {
  const env = browser(3000, 2000, () => new Blob(["pixels"], { type: "image/webp" }));
  try {
    const avatar = await prepareImage(selection(3000, 2000), "avatar", 2_000_000);
    assert.deepEqual([avatar.width, avatar.height], [512, 512]);
    assert.deepEqual(env.draws[0].slice(1), [500, 0, 2000, 2000, 0, 0, 512, 512]);
    const banner = await prepareImage(selection(3000, 2000), "banner", 2_000_000);
    assert.deepEqual([banner.width, banner.height], [1600, 1067]);
  } finally { env.restore(); }
});

test("difficult images shrink further rather than transferring the original", async () => {
  const env = browser(4000, 3000, (canvas) => new Blob([new Uint8Array(canvas.width > 1600 ? 2_100_000 : 900_000)], { type: "image/webp" }));
  try {
    const prepared = await prepareImage(selection(4000, 3000), "post", 2_000_000);
    assert.equal(prepared.width, 1600);
    assert.equal(prepared.file.size, 900_000);
  } finally { env.restore(); }
});

test("unsupported WebP encoder falls back to JPEG with correct MIME and extension", async () => {
  const env = browser(100, 100, (_, type) => new Blob(["pixels"], { type: type === "image/webp" ? "image/png" : type }));
  try {
    const prepared = await prepareImage(selection(100, 100), "post", 2_000_000);
    assert.equal(prepared.file.type, "image/jpeg");
    assert.equal(prepared.file.name, "photo.jpg");
    assert.equal(prepared.width, 100);
  } finally { env.restore(); }
});

test("encoding failure and pixel-limit failure cannot return untouched input", async () => {
  const env = browser(100, 100, () => null);
  try {
    await assert.rejects(prepareImage(selection(100, 100), "post", 2_000_000), /compress/);
    assert.equal(env.canvas.width, 0);
    await assert.rejects(prepareImage(selection(6000, 6000), "post", 2_000_000), /25 million/);
  } finally { env.restore(); }
});
