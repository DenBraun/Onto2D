import assert from "node:assert/strict";
import test from "node:test";
import { localLinkTargets, markdownAnchors } from "./check-docs.mjs";

test("documentation links retain fragments and skip external references", () => {
  assert.deepEqual(localLinkTargets(
    "[Here](#local) [Moved](guide.md#section) [Web](https://example.org) [Space](my%20guide.md)"
  ), ["#local", "guide.md#section", "my guide.md"]);
});

test("document anchors include moved sections and disambiguated headings", () => {
  const anchors = markdownAnchors([
    '# Guide', '## A `typed` [value](other.md)', '## Repeat', '## Repeat',
    '## Кривизна', '<a id="moved--contract"></a>',
    '```md', '# Not a heading', '<a id="not-an-anchor"></a>', '```'
  ].join('\n'));
  assert.deepEqual([...anchors].sort(), [
    'guide', 'a-typed-value', 'repeat', 'repeat-1', 'кривизна', 'moved--contract'
  ].sort());
});
