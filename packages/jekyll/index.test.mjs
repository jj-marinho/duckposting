import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { prepareJekyll } from './index.js';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'duck-jekyll-')), assets = join(root, 'assets');
  await mkdir(join(assets, 'fonts'), { recursive: true });
  for (const file of ['editor.js', 'editor.css', 'THIRD_PARTY_LICENSES.txt', 'fonts/math.woff2']) await writeFile(join(assets, file), file);
  const original = process.cwd(); process.chdir(root); t.after(() => process.chdir(original));
  return { root, assets };
}

test('Jekyll preparation uses host-rendered URLs, native publication status and dated posts', async t => {
  const { root, assets } = await fixture(t);
  await prepareJekyll({ repository: 'owner/blog' }, assets);
  const page = await readFile(join(root, 'write.html'), 'utf8');
  assert.match(page, /draftField":"published","draftValue":false/);
  assert.match(page, /filenameFormat":"date-title/);
  assert.match(page, /publishedLinksOnly":true/);
  assert.match(page, /imageDir":"assets\/images/);
  assert.match(page, /imageBase: \{\{ '\/assets\/images\/' \| relative_url/);
  assert.match(page, /site\.unpublished or site\.show_drafts/);
  assert.match(page, /\\u007b\\u007bdate}}/);
  const index = await readFile(join(root, 'duckposting/content.json'), 'utf8');
  assert.match(index, /post\.published != false/);
  assert.match(index, /folder == '_posts\//);
  assert.match(index, /post\.url \| relative_url \| jsonify/);
  assert.equal(await readFile(join(root, 'duckposting/fonts/math.woff2'), 'utf8'), 'fonts/math.woff2');
  await prepareJekyll({ repository: 'owner/blog', postLayout: 'article' }, assets);
  assert.match(await readFile(join(root, 'write.html'), 'utf8'), /article/);
});

test('nested Jekyll sources keep GitHub repository paths separate from public URLs', async t => {
  const { root, assets } = await fixture(t);
  await mkdir(join(root, 'docs'));
  await prepareJekyll({ repository: 'owner/blog', source: 'docs', layout: 'page', template: '---\ntitle: "</script>"\n---\n' }, assets);
  const page = await readFile(join(root, 'docs/write.html'), 'utf8');
  assert.match(page, /contentRoot":"docs\/_posts/);
  assert.match(page, /imageDir":"docs\/assets\/images/);
  assert.match(page, /layout: "page"/);
  assert.match(page, /\\u003c\/script>/);
  assert.match(await readFile(join(root, 'docs/duckposting/content.json'), 'utf8'), /prepend: "docs\/"/);
});

test('preparation refuses to overwrite unrelated writing pages or reserved assets', async t => {
  const { root, assets } = await fixture(t);
  await writeFile(join(root, 'write.html'), 'My page');
  await assert.rejects(prepareJekyll({ repository: 'owner/blog' }, assets), /already exists/);
  assert.equal(await readFile(join(root, 'write.html'), 'utf8'), 'My page');
});

test('preparation rejects unsafe paths and invalid configuration before writing', async t => {
  const { assets } = await fixture(t);
  for (const source of ['..', '../docs', '/docs', 'C:/docs', 'docs\\posts', 'docs//posts']) await assert.rejects(prepareJekyll({ repository: 'owner/blog', source }, assets), /repository-relative/);
  await assert.rejects(prepareJekyll({ repository: '../blog' }, assets), /owner\/repository/);
  await assert.rejects(prepareJekyll({ repository: 'owner/blog', template: 2 }, assets), /must be text/);
});
