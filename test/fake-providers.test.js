import assert from "node:assert/strict";
import test from "node:test";
import { startFakeProviders } from "../scripts/privacy/fake-providers.mjs";

test("fake providers record hashes and routing without retaining values", async () => {
  const canary = "BASEMENT-CANARY-test-redacted";
  const key = "CANARY_KEY_test_redacted";
  const { server, url } = await startFakeProviders({ canary, expectedKey: key });
  try {
    const response = await fetch(`${url}/v1beta/models/gemini-canary:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ prompt: canary })
    });
    assert.equal(response.status, 200);
    const report = await (await fetch(`${url}/__report`)).json();
    assert.equal(report.requests.length, 1);
    assert.equal(report.requests[0].provider, "gemini");
    assert.equal(report.requests[0].canaryInBody, true);
    assert.equal(report.requests[0].expectedCredential, true);
    assert.equal(JSON.stringify(report).includes(canary), false);
    assert.equal(JSON.stringify(report).includes(key), false);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
