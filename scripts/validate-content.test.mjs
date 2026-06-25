import { test } from "node:test";
import assert from "node:assert/strict";
import { validateTextField } from "./validate-content.mjs";

const FILE = "content/pages/example/index.mdx";

test("validateTextField accepts a clean, trimmed value", () => {
  assert.doesNotThrow(() => validateTextField({ title: "A Clean Title" }, "title", FILE, 120));
});

test("validateTextField rejects missing field", () => {
  assert.throws(() => validateTextField({}, "title", FILE, 120), /is required/);
});

test("validateTextField rejects an empty string", () => {
  assert.throws(() => validateTextField({ title: "" }, "title", FILE, 120), /is required/);
});

test("validateTextField rejects a whitespace-only string", () => {
  assert.throws(() => validateTextField({ title: "   " }, "title", FILE, 120), /is required/);
});

test("validateTextField rejects leading whitespace", () => {
  assert.throws(
    () => validateTextField({ title: " Leading Space" }, "title", FILE, 120),
    /must not have leading or trailing whitespace/
  );
});

test("validateTextField rejects trailing whitespace", () => {
  assert.throws(
    () => validateTextField({ title: "Trailing Space " }, "title", FILE, 120),
    /must not have leading or trailing whitespace/
  );
});

test("validateTextField rejects leading and trailing whitespace together", () => {
  assert.throws(
    () => validateTextField({ title: "  Both Sides  " }, "title", FILE, 120),
    /must not have leading or trailing whitespace/
  );
});

test("validateTextField does not flag internal whitespace", () => {
  assert.doesNotThrow(() =>
    validateTextField({ title: "A Title  With  Internal  Spaces" }, "title", FILE, 120)
  );
});

test("validateTextField rejects a value longer than maxLength", () => {
  assert.throws(
    () => validateTextField({ title: "a".repeat(10) }, "title", FILE, 5),
    /must be 5 characters or fewer/
  );
});

test("validateTextField accepts a value exactly at maxLength", () => {
  assert.doesNotThrow(() => validateTextField({ title: "abcde" }, "title", FILE, 5));
});
