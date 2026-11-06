import assert from "node:assert/strict";
import { createServer } from "node:http";
import { register } from "node:module";

// Use the development database only. VERCEL disables startup data writes.
if (process.env.VERCEL_ENV === "production") {
  throw new Error("Run this smoke test locally, not against production");
}
process.env.VERCEL = "1";
delete process.env.REPL_ID;
register("./block-build-tools.mjs", import.meta.url);
const { default: handler } = await import("../api/index.js");
const server = createServer(handler);
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

try {
  for (const [path, status] of [
    ["websites", 200],
    ["login", 503],
    ["callback", 503],
    ["logout", 503],
    ["not-found", 404],
  ]) {
    const response = await fetch(`${origin}/api?__vercel_api_path=${path}`);
    assert.equal(response.status, status, path);
    const body = await response.json();
    if (status === 200) assert.ok(Array.isArray(body));
    console.log(`${path}: ${status}`);
  }
  for (const [method, path] of [
    ["POST", "/api/websites"],
    ["PATCH", "/api/websites/1"],
    ["DELETE", "/api/websites/1"],
    ["GET", "/api/admin/portfolio-restoration"],
    ["POST", "/api/admin/portfolio-restoration"],
  ]) {
    const response = await fetch(`${origin}${path}`, { method });
    assert.equal(response.status, 401, `${method} ${path} must require login`);
    console.log(`${method} ${path}: blocked without login`);
  }
  console.log("Built API works with Vite/Rollup blocked");
  process.exit(0);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}