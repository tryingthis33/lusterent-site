import assert from "node:assert/strict";
import { test } from "node:test";
import { restoreApiPath } from "./vercelRouting";

test("restores nested collection and parameterized routes", () => {
  assert.equal(restoreApiPath("/api?__vercel_api_path=websites"), "/api/websites");
  assert.equal(restoreApiPath("/api?__vercel_api_path=websites/42"), "/api/websites/42");
});

test("preserves user query parameters", () => {
  assert.equal(restoreApiPath("/api?__vercel_api_path=websites&search=a%20b&page=2"),
    "/api/websites?search=a+b&page=2");
});

test("preserves original paths when supplied by the runtime", () => {
  assert.equal(restoreApiPath("/api/websites?__vercel_api_path=wrong&page=2"),
    "/api/websites?page=2");
  assert.equal(restoreApiPath("/api/not-found"), "/api/not-found");
  assert.equal(restoreApiPath("/api?__vercel_api_path="), "/api");
});

test("rejects traversal and injected URL fragments", () => {
  for (const path of ["../admin", "websites?evil=1", "websites#secret", "a\\b"]) {
    assert.throws(() => restoreApiPath(`/api?__vercel_api_path=${encodeURIComponent(path)}`));
  }
});