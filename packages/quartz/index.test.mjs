import test from 'node:test';
import assert from 'node:assert/strict';
import { transform } from 'esbuild';
import { readFile, mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const { code } = await transform(await readFile(new URL('./index.tsx', import.meta.url), 'utf8'), { loader: 'tsx', format: 'esm' });
const { duckpostingQuartz } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
test('Quartz index includes only real Markdown files, never virtual pages or full text', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'duck-adapter-'));
  try {
    const assets = join(directory, 'assets'), output = join(directory, 'public');
    await mkdir(assets);
    for (const file of ['editor.js', 'editor.css', 'THIRD_PARTY_LICENSES.txt']) await writeFile(join(assets, file), 'fixture');
    const config = { plugins: { emitters: [], pageTypes: [] } };
    duckpostingQuartz(config, { repository: 'pato/blog' }, assets);
    assert.equal(config.plugins.pageTypes[0].match({ slug: 'write/index' }), true);
    const published = [
      [{}, { data: { relativePath: 'about.md', filePath: 'content/about.md', frontmatter: { title: 'About' } }, value: 'private source text' }],
      [{}, { data: { relativePath: 'write/index.md', frontmatter: { title: 'Write' } } }],
    ];
    await config.plugins.emitters[0].emit({ argv: { directory: 'content', output } }, published);
    const index = JSON.parse(await readFile(join(output, 'duckposting/content.json'), 'utf8'));
    assert.deepEqual(index, [{ path: 'content/about.md', title: 'About', draft: false }]);
    assert.equal(index[0].text, undefined);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
