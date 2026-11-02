import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = (await readFile(new URL("../src/lib/images/image-api.ts", import.meta.url), "utf8"))
  .replace('import { apiRequest } from "../api";', 'const apiRequest = (...args) => globalThis.imageApiTest.api(...args);')
  .replace('import { getSupabase } from "../supabase";', 'const getSupabase = () => globalThis.imageApiTest.supabase;')
  .replace('import { prepareImage } from "./image-prepare";', 'const prepareImage = (...args) => globalThis.imageApiTest.prepare(...args);');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2017 } });
const { reserveImages, uploadReservedImage } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString("base64")}`);
const selected = { file: new File(['original'], 'source.png', { type: 'image/png' }), width: 100, height: 100, errors: [] };
const prepared = { ...selected, file: new File(['compressed'], 'source.webp', { type: 'image/webp' }) };
const ticket = { upload: { id: 'reserved', bucket_id: 'post-images', object_key: 'owner/reserved.webp' },
  upload_expires_at: new Date(Date.now()+900_000).toISOString(), image: prepared };

test("reserve uses compressed metadata and keeps the exact prepared file for transfer", async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ max_upload_bytes: 2_000_000 }));
  globalThis.imageApiTest = {
    prepare: async (image, purpose, limit) => { assert.equal(image, selected); assert.equal(purpose, 'post'); assert.equal(limit, 2_000_000); return prepared; },
    api: async (path, init) => {
      assert.equal(path, '/images/batch');
      assert.deepEqual(JSON.parse(init.body).images[0], { original_name: 'source.webp', content_type: 'image/webp',
        size_bytes: prepared.file.size, width: 100, height: 100, purpose: 'post' });
      return [ticket];
    },
  };
  const [result] = await reserveImages([selected]);
  assert.equal(result.image.file, prepared.file);
});

test("compression failure creates no reservation", async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ max_upload_bytes: 2_000_000 }));
  globalThis.imageApiTest = { prepare: async () => { throw new Error('Cannot compress'); },
    api: () => assert.fail('Reservation must not be created') };
  await assert.rejects(reserveImages([selected]), /Cannot compress/);
});

test("authenticated transfer uses prepared bytes without overwrite and confirms the same reservation", async () => {
  globalThis.imageApiTest = {
    supabase: { storage: { from: (bucket) => {
      assert.equal(bucket, 'post-images');
      return { upload: async (key, file, options) => {
        assert.equal(key, ticket.upload.object_key);
        assert.equal(file, prepared.file);
        assert.deepEqual(options, { contentType: 'image/webp', upsert: false });
        return { error: null };
      } };
    } } },
    api: async (path) => { assert.equal(path, '/images/reserved/complete'); return ticket.upload; },
  };
  assert.equal(await uploadReservedImage(ticket, () => {}), ticket.upload);
});

test("uncertain or duplicate transfer retries completion without reserving again", async () => {
  globalThis.imageApiTest = {
    supabase: { storage: { from: () => ({ upload: async () => ({ error: new Error('Lost response') }) }) } },
    api: async (path) => { assert.equal(path, '/images/reserved/complete'); return ticket.upload; },
  };
  assert.equal(await uploadReservedImage(ticket, () => {}), ticket.upload);
});
