import assert from "node:assert/strict";
import test from "node:test";

process.env.TRUST_PROXY = "1";
delete process.env.GEMINI_API_KEY;
const { default: app } = await import("../server.js");

function listen() {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function analyze(port, forwardedFor) {
  return fetch(`http://127.0.0.1:${port}/api/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": forwardedFor },
    body: JSON.stringify({ topic: "Proxy test", transcript: "A short answer.", metrics: {} })
  });
}

test("trusted proxy mode keeps provider limits separate by forwarded client IP", async () => {
  const server = await listen();
  try {
    const { port } = server.address();
    for (let request = 0; request < 10; request += 1) {
      assert.equal((await analyze(port, "198.51.100.10")).status, 200);
    }
    assert.equal((await analyze(port, "198.51.100.10")).status, 429);
    assert.equal((await analyze(port, "198.51.100.11")).status, 200);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
