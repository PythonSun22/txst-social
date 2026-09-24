import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

// Use the existing TypeScript compiler so these tests also run on Node 20.
const source = await readFile(new URL("../src/lib/images/image-policy.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2017 } });
const { aspectRatio, formatBytes, imageTypeFromHeader, validateImageFile } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString("base64")}`);

const policy = { max_bytes: 10_000_000, allowed_types: ["image/jpeg", "image/png", "image/webp"] };
const file = { name: "lake.png", size: 1000, type: "image/png" };

test("FR-32: exact 10 MB boundary accepted, larger and empty files rejected", () => {
  assert.deepEqual(validateImageFile({ ...file, size: policy.max_bytes }, policy), []);
  assert.equal(validateImageFile({ ...file, size: policy.max_bytes + 1 }, policy).length, 1);
  assert.equal(validateImageFile({ ...file, size: 0 }, policy).length, 1);
  assert.equal(formatBytes(policy.max_bytes), "10.00 MB");
});

test("unsupported types and missing names cannot enable upload", () => {
  for (const type of ["image/svg+xml", "image/gif", "application/pdf", ""]) {
    assert.equal(validateImageFile({ ...file, type }, policy).length, 1);
  }
  assert.equal(validateImageFile({ ...file, name: " " }, policy).length, 1);
});

test("ratio reflects source dimensions without imposing a crop", () => {
  assert.equal(aspectRatio(1920, 1080), "16:9 (1.778:1)");
  assert.equal(aspectRatio(1080, 1920), "9:16 (0.563:1)");
  assert.equal(aspectRatio(900, 900), "1:1 (1.000:1)");
});

test("image signatures distinguish formats from renamed non-image files", () => {
  assert.equal(imageTypeFromHeader(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])), "image/png");
  assert.equal(imageTypeFromHeader(Uint8Array.from([255, 216, 255, 224])), "image/jpeg");
  assert.equal(imageTypeFromHeader(new TextEncoder().encode("RIFF1234WEBP")), "image/webp");
  assert.equal(imageTypeFromHeader(new TextEncoder().encode("<svg></svg>")), null);
  assert.equal(imageTypeFromHeader(new Uint8Array()), null);
});
