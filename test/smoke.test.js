import assert from "node:assert/strict";
import test from "node:test";
import app from "../server.js";
import { smoke } from "../scripts/monitor/smoke.mjs";

function listen() {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

test("deployment smoke verifies health, privacy headers, and cookies", async () => {
  const server = await listen();
  const originalExpectation = process.env.SMOKE_EXPECT_PROVIDERS;
  process.env.SMOKE_EXPECT_PROVIDERS = "0";
  try {
    const { port } = server.address();
    const result = await smoke(`http://127.0.0.1:${port}`);
    assert.deepEqual(result, { ok: true, healthSchema: true, providersConfigured: false, securityHeaders: 5, cookies: 0 });
  } finally {
    if (originalExpectation === undefined) delete process.env.SMOKE_EXPECT_PROVIDERS;
    else process.env.SMOKE_EXPECT_PROVIDERS = originalExpectation;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
