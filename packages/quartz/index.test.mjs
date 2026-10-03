import test from 'node:test';
import assert from 'node:assert/strict';
import { transform } from 'esbuild';
import { readFile, mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const { code } = await transform(await readFile(new URL('./index.tsx', import.meta.url), 'utf8'), { loader: 'tsx', format: 'esm', jsxFactory: '__jsx', jsxFragment: '__Fragment' });
const { duckpostingQuartz } = await import(`data:text/javascript;base64,${Buffer.from('const __Fragment = \"fragment\"; const __jsx = (tag, props, ...children) => ({ tag, props, children });\n' + code).toString('base64')}`);
test('Quartz index includes only real Markdown files, never virtual pages or full text', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'duck-adapter-'));
  try {
    const assets = join(directory, 'assets'), output = join(directory, 'public');
    await mkdir(assets);
    for (const file of ['editor.js', 'editor.css', 'THIRD_PARTY_LICENSES.txt']) await writeFile(join(assets, file), 'fixture');
    const config = { configuration: { ignorePatterns: [] }, plugins: { filters: [{ name: 'RemoveDraft' }], emitters: [], pageTypes: [] } };
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

test('Quartz derives content paths and preserves exclusions, and respects deployed subpaths versus local preview', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'duck-adapter-'));
  try {
    const assets = join(directory, 'assets'), output = join(directory, 'public');
    await mkdir(assets);
    for (const file of ['editor.js', 'editor.css', 'THIRD_PARTY_LICENSES.txt']) await writeFile(join(assets, file), 'fixture');
    const config = { configuration: { ignorePatterns: ['secret', '**/.obsidian/**', 'archive/**', '*.tmp'] }, plugins: { filters: [{ name: 'RemoveDraft' }], emitters: [], pageTypes: [] } };
    duckpostingQuartz(config, { repository: 'someone/blog' }, assets);
    const body = config.plugins.pageTypes[0].body();
    const render = (directory, serve = false) => body({ cfg: { baseUrl: 'example.org/garden' }, ctx: { argv: { directory, serve } } });
    const deployed = render('./notes/');
    const settings = JSON.parse(deployed.children[1].props['data-duckposting']);
    assert.equal(settings.contentRoot, 'notes');
    assert.equal(settings.contentDir, 'notes/posts');
    assert.deepEqual(settings.exclude, ['secret', '**/.obsidian/**', 'archive/**', '*.tmp']);
    assert.equal(settings.index, '/garden/duckposting/content.json');
    assert.match(deployed.children[0].props.href, /^\/garden\/duckposting\/editor\.css\?v=/);
    const preview = render('notes', true);
    assert.match(preview.children[1].props['data-module'], /^\/duckposting\/editor\.js\?v=/);
    assert.equal(JSON.parse(preview.children[1].props['data-duckposting']).index, '/duckposting/content.json');
    const published = [[{}, { data: { relativePath: 'posts\\hello.md', filePath: 'notes/posts/hello.md', frontmatter: { title: 'Hello' } } }]];
    await config.plugins.emitters[0].emit({ argv: { directory: './notes/', output } }, published);
    assert.equal(JSON.parse(await readFile(join(output, 'duckposting/content.json'), 'utf8'))[0].path, 'notes/posts/hello.md');
    for (const unsupported of ['/home/content', '../outside', 'C:\\notes']) assert.throws(() => render(unsupported), /repository-relative/);
    await assert.rejects(config.plugins.emitters[0].emit({ argv: { directory: '../outside', output } }, []), /repository-relative/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('Quartz fails early for incomplete assets, missing draft protection, and a reserved write route', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'duck-adapter-'));
  try {
    const config = { configuration: { ignorePatterns: [] }, plugins: { filters: [], emitters: [], pageTypes: [] } };
    assert.throws(() => duckpostingQuartz(config, { repository: 'someone/blog' }, directory), /RemoveDraft/);
    config.plugins.filters.push({ name: 'RemoveDrafts' });
    for (const file of ['editor.js', 'editor.css']) await writeFile(join(directory, file), 'fixture');
    assert.throws(() => duckpostingQuartz(config, { repository: 'someone/blog' }, directory), /THIRD_PARTY_LICENSES/);
    await writeFile(join(directory, 'THIRD_PARTY_LICENSES.txt'), 'fixture');
    duckpostingQuartz(config, { repository: 'someone/blog' }, directory);
    for (const relativePath of ['write.md', 'write/index.md', 'write\\index.md']) {
      const content = [[{}, { data: { relativePath, filePath: `content/${relativePath}` } }]];
      assert.throws(() => config.plugins.pageTypes[0].generate({ content, ctx: { argv: { directory: 'content' } } }), /reserves \/write/);
      await assert.rejects(config.plugins.emitters[0].emit({ argv: { directory: 'content', output: join(directory, 'output') } }, content), /reserves \/write/);
    }
    const generated = config.plugins.pageTypes[0].generate({ content: [], ctx: { argv: { directory: 'content' } } })[0];
    assert.equal(generated.slug, 'write/index');
    assert.equal(generated.data.unlisted, true);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('Quartz rejects conflicting content roots and new-post directories outside the rendered content', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'duck-adapter-'));
  try {
    for (const file of ['editor.js', 'editor.css', 'THIRD_PARTY_LICENSES.txt']) await writeFile(join(directory, file), 'fixture');
    const register = options => {
      const config = { configuration: { ignorePatterns: [] }, plugins: { filters: [{ name: 'RemoveDrafts' }], emitters: [], pageTypes: [] } };
      duckpostingQuartz(config, { repository: 'someone/blog', ...options }, directory);
      return config.plugins;
    };
    const ctx = { argv: { directory: 'notes', output: join(directory, 'output') } };
    const conflict = register({ contentRoot: 'content' });
    assert.throws(() => conflict.pageTypes[0].generate({ content: [], ctx }), /must match Quartz's --directory/);
    await assert.rejects(conflict.emitters[0].emit(ctx, []), /Remove contentRoot or build with --directory content/);
    for (const contentDir of ['content/posts', 'notes-other/posts']) {
      const outside = register({ contentDir });
      assert.throws(() => outside.pageTypes[0].generate({ content: [], ctx }), /must be inside/);
      await assert.rejects(outside.emitters[0].emit(ctx, []), /must be inside/);
    }
    const matching = register({ contentRoot: './notes/', contentDir: 'notes' });
    assert.equal(matching.pageTypes[0].generate({ content: [], ctx })[0].slug, 'write/index');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
