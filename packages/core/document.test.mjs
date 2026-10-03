import assert from "node:assert/strict";
import test from "node:test";
import { filename, readTitle, setTitle, splitDocument } from "./document.js";

test("editing the title retains other frontmatter and the exact body", () => {
  const original = '---\ntitle: "Before"\ndate: 2026-10-03\ndraft: true\ntags: [systems, writing]\ncustom:\n  nested: untouched\n---\n\n## Body\n\nOlá 🦆\n';
  const updated = setTitle(original, 'João’s "ideas": #1 🦆');
  assert.equal(updated, original.replace('title: "Before"', 'title: "João’s \\"ideas\\": #1 🦆"'));
  assert.equal(readTitle(updated), 'João’s "ideas": #1 🦆');
  assert.equal(filename(updated), 'joaos-ideas-1.md');
  assert.equal(splitDocument(updated).body, '\n## Body\n\nOlá 🦆\n');
});

test("frontmatter splitting respects CRLF and does not consume body separators", () => {
  const text = "---\r\ntitle: 'Pato''s post'\r\n---\r\n\r\nBody\r\n---\r\n";
  assert.equal(readTitle(text), "Pato's post");
  assert.equal(splitDocument(text).body, '\r\nBody\r\n---\r\n');
  assert.equal(filename(text), 'patos-post.md');
});

test("title insertion handles absent titles without replacing body text", () => {
  assert.equal(setTitle('Body\n', 'Title'), '---\ntitle: "Title"\n---\n\nBody\n');
  assert.equal(setTitle('---\ndraft: false\n---\n\nBody\n', 'Title'), '---\ntitle: "Title"\ndraft: false\n---\n\nBody\n');
  assert.equal(readTitle('---\ntitle: Plain title # comment\n---\n'), 'Plain title');
});
