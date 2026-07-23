import assert from "node:assert/strict";
import test from "node:test";
import { applyTextChanges } from "../src/collaboration_text.js";

test("applyTextChanges applies Monaco changes from the end of the document", () => {
  const result = applyTextChanges("hello world", [
    { rangeOffset: 6, rangeLength: 5, text: "CAIDE" },
    { rangeOffset: 0, rangeLength: 0, text: "Say: " },
  ]);
  assert.equal(result, "Say: hello CAIDE");
});

test("applyTextChanges rejects an out-of-range edit", () => {
  assert.throws(() =>
    applyTextChanges("abc", [
      { rangeOffset: 5, rangeLength: 0, text: "x" },
    ]),
  );
});
