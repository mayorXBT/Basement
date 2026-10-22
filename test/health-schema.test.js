import assert from "node:assert/strict";
import test from "node:test";
import app from "../server.js";

function listen() {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

test("health returns only the provider configuration booleans", async () => {
  const server = await listen();
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(Object.keys(body).sort(), ["deepgramConfigured", "geminiConfigured", "groqConfigured", "ok"]);
    assert.equal(body.ok, true);
    assert.equal(typeof body.geminiConfigured, "boolean");
    assert.equal(typeof body.groqConfigured, "boolean");
    assert.equal(typeof body.deepgramConfigured, "boolean");
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
