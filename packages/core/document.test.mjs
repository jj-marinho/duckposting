import assert from "node:assert/strict";
import test from "node:test";
import { filename, readTitle, setTitle, splitDocument, isDraft, setDraft, joinDocument, needsSourceMode } from "./document.js";

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
  assert.equal(setTitle('---\n---\nBody', '$& and $1'), '---\ntitle: "$& and $1"\n---\nBody');
  assert.equal(setTitle('---\ndraft: false\n---\nBody', '$& and $1'), '---\ntitle: "$& and $1"\ndraft: false\n---\nBody');
  assert.equal(setTitle('---\ntitle:\n---\nBody', 'After'), '---\ntitle: "After"\n---\nBody');
  assert.equal(setTitle('---\n"title": Before\n---\nBody', 'After'), '---\n"title": "After"\n---\nBody');
});

test("YAML title and draft parsing agree for quoting, comments, and CRLF", () => {
  const text = '---\r\ntitle: "João: ideas #1" # keep comment\r\ndraft: True # hidden\r\ncustom: [one, two]\r\n---\r\n\r\nBody';
  assert.equal(readTitle(text), 'João: ideas #1');
  assert.equal(filename(text), 'joao-ideas-1.md');
  assert.equal(isDraft(text), true);
  assert.equal(setTitle(text, 'After'), text.replace('"João: ideas #1"', '"After"'));
  assert.equal(setDraft(text, false), text.replace('True', 'false'));
});

test("editing folded or aliased titles leaves adjacent metadata and body intact", () => {
  const text = '---\ntitle: >\n  Before\n  title\ncustom:\n  nested: unchanged\n---\nBody';
  assert.equal(setTitle(text, 'After'), '---\ntitle: "After"\ncustom:\n  nested: unchanged\n---\nBody');
  const aliased = '---\noriginal: &name Before\ntitle: *name\n---\nBody';
  assert.equal(readTitle(aliased), 'Before');
  assert.equal(setTitle(aliased, 'After'), aliased.replace('*name', '"After"'));
});

test("malformed, duplicate, or unclosed frontmatter cannot be published or mutated", () => {
  for (const text of ['---\ntitle: [unfinished\n---\nBody', '---\ntitle: One\ntitle: Two\n---\nBody', '---\ntitle: One\nBody']) {
    assert.throws(() => filename(text), /frontmatter/i);
    assert.throws(() => setTitle(text, 'After'), /frontmatter/i);
    assert.throws(() => setDraft(text, true), /frontmatter/i);
  }
  assert.throws(() => filename('---\ntitle: false\n---\nBody'), /text title/);
  assert.throws(() => filename('---\ntitle: !unknown Title\n---\nBody'), /frontmatter/);
  assert.throws(() => setTitle('---\nnull\n---\nBody', 'After'), /named settings/);
  assert.equal(readTitle('Body without settings'), '');
  assert.throws(() => filename('Body without settings'), /frontmatter title/);
});

test("new filenames preserve non-Latin letters and numbers", () => {
  assert.equal(filename('---\ntitle: 中文博客 🦆\n---\nBody'), '中文博客.md');
  assert.equal(filename('---\ntitle: مرحبا بالعالم ١٢\n---\nBody'), 'مرحبا-بالعالم-١٢.md');
});

test("ordinary aliases work but excessive alias expansion is rejected", () => {
  const one = Array(10).fill('A').join(', ');
  const two = Array(10).fill('*one').join(', ');
  const three = Array(10).fill('*two').join(', ');
  assert.throws(() => readTitle(`---\none: &one [${one}]\ntwo: &two [${two}]\nthree: &three [${three}]\ntitle: Title\n---\nBody`), /alias count/);
});

test("adding settings to flow mappings preserves valid YAML, comments and body", () => {
  const empty = '---\n{}\n---\n\nBody';
  const titled = setTitle(empty, 'After');
  assert.equal(titled, '---\n{title: "After"}\n---\n\nBody');
  const draft = setDraft(titled, true);
  assert.equal(draft, '---\n{draft: true, title: "After"}\n---\n\nBody');
  assert.equal(readTitle(draft), 'After');
  assert.equal(isDraft(draft), true);
  const trailingComma = '---\n{draft: false, } # comment\n---\nBody';
  const updated = setTitle(trailingComma, 'After');
  assert.equal(updated, '---\n{title: "After", draft: false, } # comment\n---\nBody');
  assert.equal(readTitle(updated), 'After');
  const commented = '---\n{ # comment\n}\n---\nBody';
  assert.equal(readTitle(setTitle(commented, 'After')), 'After');
  assert.equal(setTitle(commented, 'After'), '---\n{title: "After" # comment\n}\n---\nBody');
});

test("body edits always keep frontmatter separated, even without a final newline", () => {
  const metadata = '---\ntitle: Title\ndraft: true\n---';
  const joined = joinDocument(metadata, 'Body');
  assert.equal(joined, metadata + '\nBody');
  assert.equal(readTitle(joined), 'Title');
  assert.equal(isDraft(joined), true);
  assert.equal(joinDocument('', 'Body'), 'Body');
});

test("source mode protects Markdown that rich serialization would rewrite", () => {
  assert.equal(needsSourceMode('Simple post\r\n', 'Simple post\n\n'), false);
  const document = '---\ntitle: "About"\n---\n\nNothing here is sent to GitHub. Write, edit and publish locally.\n';
  const originalBody = splitDocument(document).body;
  assert.equal(needsSourceMode(originalBody, originalBody.slice(1)), false);
  assert.equal(splitDocument(document).body, originalBody);
  assert.equal(needsSourceMode('\r\n\r\nOrdinary post\r\n\r\n', 'Ordinary post\n'), false);
  assert.equal(needsSourceMode('[[Internal link]]', '\\[\\[Internal link\\]\\]\n'), true);
  assert.equal(needsSourceMode('| A | B |\n| - | - |', '\\| A \\| B \\|\n\\| - \\| - \\|\n'), true);
  assert.equal(needsSourceMode('Line\n\nNext', 'Line\nNext'), true);
  assert.equal(needsSourceMode('    indented code\n', 'indented code\n'), true);
  assert.equal(needsSourceMode('Line  \nNext', 'Line\nNext'), true);
});
