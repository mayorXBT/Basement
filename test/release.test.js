import assert from "node:assert/strict";
import test from "node:test";
import { nextVersion } from "../scripts/release/next-version.mjs";
import { fallbackNotes, validNotes } from "../scripts/release/release-notes.mjs";

test("release labels choose deterministic semantic version increments", () => {
  assert.equal(nextVersion("v1.2.3", ["type::feature"]), "v1.3.0");
  assert.equal(nextVersion("v1.2.3", ["type::fix"]), "v1.2.4");
  assert.equal(nextVersion("v1.2.3", ["type::breaking"]), "v2.0.0");
  assert.equal(nextVersion("v1.2.3", []), "v1.2.4");
});

test("release notes stay short and reject hype", () => {
  const fallback = fallbackNotes("v1.3.0", "Add a speaking category");
  assert.equal(validNotes(fallback), true);
  assert.equal(validNotes("A revolutionary game-changing release."), false);
  assert.equal(validNotes("word ".repeat(121)), false);
});
