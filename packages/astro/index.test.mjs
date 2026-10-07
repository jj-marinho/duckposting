import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import duckposting, { browserSettings } from './index.js';
import { configuration } from '../core/config.js';
import { publishedIndex } from '../core/catalog.js';
import { imageMatcher, imageTarget } from '../core/images.js';

test('Astro uses explicit route URLs and a public image directory under project bases', () => {
  const pages = [{ path: 'src/content/blog/hello.md', title: 'Hello', url: '/project/journal/hello/' }];
  const settings = browserSettings({ repository: 'pato/blog', contentDir: 'src/content/blog', pages }, '/project/');
  assert.equal(settings.contentRoot, 'src/content/blog');
  assert.equal(settings.imageDir, 'public/duckposting-images');
  assert.equal(settings.imageBase, '/project/duckposting-images/');
  assert.equal(settings.siteBase, '/project/');
  assert.deepEqual(settings.published, pages);
  assert.equal(settings.publishedLinksOnly, true);
  assert.equal(settings.pages, undefined);
  const config = configuration(settings);
  assert.equal(publishedIndex(settings.published, config)[0].url, '/project/journal/hello/');
  assert.equal(imageMatcher(config)('public/duckposting-images/photo.png'), true);
  assert.deepEqual(imageTarget(config, '/project/duckposting-images/photo.png', 'src/content/blog/hello.md'), { path: 'public/duckposting-images/photo.png', url: '/project/duckposting-images/photo.png' });
  assert.throws(() => browserSettings({ repository: 'pato/blog', contentDir: 'src/content/blog' }), /filtered/);
  assert.throws(() => browserSettings({ pages: [] }), /repository/);
});

test('Astro serves and copies only declared assets without writing into the host public directory', async t => {
  const root = await mkdtemp(join(tmpdir(), 'duckposting-astro-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, 'assets'), output = join(root, 'output');
  await mkdir(join(source, 'fonts'), { recursive: true });
  const files = { 'editor.js': 'export const mountDuckposting = () => {};', 'editor.css': 'body {src:url("./fonts/test.woff2")}', 'THIRD_PARTY_LICENSES.txt': 'MIT', 'fonts/test.woff2': 'font' };
  for (const [name, content] of Object.entries(files)) await writeFile(join(source, name), content);
  await writeFile(join(source, 'private-token.txt'), 'never serve');
  const hooks = duckposting({}, source).hooks;
  await assert.rejects(hooks['astro:config:done']({ config: { output: 'server', base: '/' } }), /static/);
  await hooks['astro:config:done']({ config: { output: 'static', base: '/project' } });
  let serve;
  hooks['astro:server:setup']({ server: { middlewares: { use: handler => { serve = handler; } } } });
  const get = (url, method = 'GET') => {
    const result = {};
    serve({ url, method }, { setHeader: (_, type) => { result.type = type; }, end: bytes => { result.bytes = bytes; } }, () => { result.next = true; });
    return result;
  };
  assert.equal(get('/project/duckposting/editor.js?cache=1').bytes.toString(), files['editor.js']);
  assert.equal(get('/project/duckposting/fonts/test.woff2').type, 'font/woff2');
  assert.equal(get('/project/duckposting/editor.css', 'HEAD').bytes, undefined);
  for (const path of ['/duckposting/editor.js', '/project/duckposting/private-token.txt', '/project/duckposting/../private-token.txt']) assert.equal(get(path).next, true);
  assert.equal(get('/project/duckposting/editor.js', 'POST').next, true);
  await hooks['astro:build:done']({ dir: pathToFileURL(output + '/') });
  for (const [name, content] of Object.entries(files)) assert.equal(await readFile(join(output, 'duckposting', name), 'utf8'), content);
  await assert.rejects(readFile(join(output, 'duckposting', 'private-token.txt')));
});
