import assert from "node:assert/strict";
import test from "node:test";
import app from "./server.js";

function listen(serverApp) {
  return new Promise((resolve) => {
    const server = serverApp.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function postAudio(server, contentType, body = Buffer.from("fake-audio")) {
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/transcribe`, {
    method: "POST",
    headers: { "content-type": contentType },
    body
  });
  return { status: response.status, json: await response.json().catch(() => ({})) };
}

test("Safari audio/mp4 recordings are accepted by /api/transcribe", async () => {
  const server = await listen(app);
  try {
    const mp4 = await postAudio(server, "audio/mp4");
    assert.notEqual(mp4.status, 415, `audio/mp4 was rejected: ${JSON.stringify(mp4.json)}`);
    const coded = await postAudio(server, "audio/mp4;codecs=mp4a.40.2");
    assert.notEqual(coded.status, 415, `audio/mp4 with codecs was rejected: ${JSON.stringify(coded.json)}`);
    const m4a = await postAudio(server, "audio/m4a");
    assert.notEqual(m4a.status, 415, `audio/m4a was rejected: ${JSON.stringify(m4a.json)}`);
    const webm = await postAudio(server, "audio/webm");
    assert.notEqual(webm.status, 415, `audio/webm was rejected: ${JSON.stringify(webm.json)}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test("unknown audio types are still rejected", async () => {
  const server = await listen(app);
  try {
    const result = await postAudio(server, "audio/flac");
    assert.equal(result.status, 415);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
