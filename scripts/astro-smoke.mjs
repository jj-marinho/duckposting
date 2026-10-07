import { cp, mkdtemp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';

const source = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!process.argv[2]) throw new Error('Usage: node scripts/astro-smoke.mjs /absolute/path/to/duckposting.tgz');
const archive = resolve(process.argv[2]), fixture = await mkdtemp(join(tmpdir(), 'duckposting-astro-smoke-'));
const run = (args) => {
  const result = spawnSync('npm', args, { cwd: fixture, stdio: 'inherit', env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' } });
  if (result.status !== 0) throw new Error(`npm ${args.join(' ')} failed`);
};
try {
  await cp(join(source, 'packages/astro/fixture'), fixture, { recursive: true });
  await writeFile(join(fixture, 'package.json'), JSON.stringify({ name: 'duckposting-astro-smoke', private: true, type: 'module', scripts: { build: 'astro build' } }));
  await mkdir(join(fixture, 'public/duckposting-images'), { recursive: true });
  await writeFile(join(fixture, 'public/duckposting-images/pixel.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1EAAAAASUVORK5CYII=', 'base64'));
  run(['install', '--ignore-scripts', '--no-audit', '--no-fund', '--cache', join(tmpdir(), 'duckposting-smoke-npm-cache'), `astro@${process.env.ASTRO_VERSION || '7.3.7'}`, archive]);
  run(['run', 'build']);
  const output = join(fixture, 'dist');
  const html = await readFile(join(output, 'write/index.html'), 'utf8');
  const { document } = parseHTML(html);
  const root = document.querySelector('[data-duckposting]');
  const settings = JSON.parse(root.dataset.duckposting);
  assert.equal(settings.repository, 'pato/astro-blog');
  assert.equal(settings.siteBase, '/project/');
  assert.equal(settings.imageBase, '/project/duckposting-images/');
  assert.equal(settings.imageDir, 'public/duckposting-images');
  assert.deepEqual(settings.published.map(page => [page.path, page.url]), [
    ['src/content/blog/hello.md', '/project/posts/hello/'],
    ['src/content/blog/nested/page.md', '/project/posts/nested/page/'],
  ]);
  assert.equal(root.dataset.module, '/project/duckposting/editor.js');
  assert.equal(html.includes('SECRET DRAFT'), false);
  await assert.rejects(readFile(join(output, 'posts/private/index.html')));
  const post = await readFile(join(output, 'posts/hello/index.html'), 'utf8');
  assert.match(post, /\/project\/duckposting-images\/pixel\.png/);
  assert.match(post, /\/project\/posts\/nested\/page\//);
  for (const file of ['editor.js', 'editor.css', 'THIRD_PARTY_LICENSES.txt']) {
    assert.deepEqual(await readFile(join(output, 'duckposting', file)), await readFile(join(fixture, 'node_modules/duckposting/dist', file)));
  }
  assert.ok((await readdir(join(output, 'duckposting/fonts'))).some(name => name.endsWith('.woff2')));
  assert.ok((await readFile(join(output, 'duckposting-images/pixel.png'))).length > 0);
  console.log(`Astro ${process.env.ASTRO_VERSION || '7.3.7'} smoke passed: static editor, real collections, subpath links/images, fonts, draft omission.`);
} finally {
  if (process.env.KEEP_ASTRO_SMOKE) console.log(`Fixture retained: ${fixture}`);
  else await rm(fixture, { recursive: true, force: true });
}
