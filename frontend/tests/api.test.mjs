import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = (await readFile(new URL("../src/lib/api.ts", import.meta.url), "utf8"))
  .replace('import { getSupabase } from "./supabase";', `const getSupabase = () => ({ auth: {
    getSession: async () => ({ data: { session: { access_token: "test-token" } }, error: null })
  } });`);
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { apiRequest } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString("base64")}`);

test("FR-34: authenticated deletion accepts an empty 204 response", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.ok(url.endsWith("/posts/test-id"));
    assert.equal(init.method, "DELETE");
    assert.equal(init.headers.get("Authorization"), "Bearer test-token");
    return new Response(null, { status: 204 });
  });
  assert.equal(await apiRequest("/posts/test-id", { method: "DELETE" }), undefined);
});

test("FR-34: failed deletion preserves the API error", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ detail: "Post not found." }, { status: 404 }));
  await assert.rejects(apiRequest("/posts/test-id", { method: "DELETE" }), /Post not found/);
});
