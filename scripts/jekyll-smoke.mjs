// node scripts/jekyll-smoke.mjs /path/to/duckposting.tgz
// Requires Jekyll 3.10/4.4 on PATH, or JEKYLL_COMMAND.
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

if (!process.argv[2]) throw new Error('Usage: node scripts/jekyll-smoke.mjs /path/to/duckposting.tgz');
const archive = resolve(process.argv[2]);
const command = process.env.JEKYLL_COMMAND || 'jekyll';
const version = execFileSync(command, ['--version'], { encoding: 'utf8' }).trim();
const cacheFlags = /jekyll 4\./.test(version) ? ['--disable-disk-cache'] : [];
const root = await realpath(await mkdtemp(join(tmpdir(), 'duck-jekyll-smoke-')));
const original = process.cwd();
await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'duckposting-jekyll-smoke', private: true, type: 'module' }));
execFileSync('npm', ['install', archive, '--ignore-scripts', '--no-audit', '--no-fund', '--cache', join(tmpdir(), 'duckposting-smoke-npm-cache')], { cwd: root, stdio: 'pipe' });
// Resolve the installed package export, not source files or an assets override.
await writeFile(join(root, 'integration.mjs'), 'export { prepareJekyll } from "duckposting/jekyll";\n');
const { prepareJekyll } = await import(pathToFileURL(join(root, 'integration.mjs')));
const installedAssets = join(root, 'node_modules/duckposting/dist');
process.chdir(root);
try {
for (const source of ['.', 'docs']) {
  const site = resolve(source);
  await mkdir(join(site, '_posts'), { recursive: true });
  await mkdir(join(site, '_layouts'), { recursive: true });
  await mkdir(join(site, 'assets/images'), { recursive: true });
  await writeFile(join(site, '_config.yml'), 'baseurl: /project\npermalink: /:categories/:title/\nexclude: [docs, node_modules, package.json, package-lock.json, integration.mjs]\n');
  await writeFile(join(site, '_layouts/default.html'), '<!doctype html><html><body><main>{{ content }}</main></body></html>');
  await writeFile(join(site, '_layouts/post.html'), '<!doctype html><html><body><article><h1>{{ page.title }}</h1>{{ content }}</article></body></html>');
  await writeFile(join(site, '_posts/2026-01-02-hello.md'), '---\nlayout: post\ntitle: "Olá 🌎"\ncategories: [notes]\npublished: true\n---\n\n![Example](/project/assets/images/example.png)\n');
  await writeFile(join(site, '_posts/2026-01-02-hidden.md'), '---\ntitle: "NEVER EMIT THIS DRAFT"\npublished: false\n---\nPrivate draft\n');
  await writeFile(join(site, '_posts/2099-01-02-future.md'), '---\ntitle: "FUTURE TITLE"\n---\nLater\n');
  await writeFile(join(site, '_posts/2026-01-03-unsupported.markdown'), '---\ntitle: "Other extension"\n---\nStill a public post, outside the editor scope.\n');
  await writeFile(join(site, 'assets/images/example.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64'));
  await prepareJekyll({ repository: 'owner/blog', source });
  const output = join(root, source === '.' ? 'output-root' : 'output-nested');
  execFileSync(command, ['build', '--safe', ...cacheFlags, '--source', site, '--config', join(site, '_config.yml'), '--destination', output], { stdio: 'pipe' });
  const entries = JSON.parse(await readFile(join(output, 'duckposting/content.json'), 'utf8'));
  assert.deepEqual(entries, [{ path: `${source === '.' ? '' : 'docs/'}_posts/2026-01-02-hello.md`, title: 'Olá 🌎', url: '/project/notes/hello/' }]);
  const page = await readFile(join(output, 'write/index.html'), 'utf8');
  assert.match(page, /imageBase: "\/project\/assets\/images\/"/);
  assert.match(page, /\/project\/duckposting\/editor\.js\?v=/);
  assert.match(page, /contentRoot":"(?:docs\/)?_posts/);
  assert.ok(!page.includes('{{')); // Jekyll must not consume the new-post date placeholder.
  assert.match(page, /\\u007b\\u007bdate}}/);
  for (const file of ['editor.js', 'editor.css', 'THIRD_PARTY_LICENSES.txt']) {
    assert.deepEqual(await readFile(join(output, 'duckposting', file)), await readFile(join(installedAssets, file)));
  }
  for (const file of await readdir(join(installedAssets, 'fonts'))) {
    assert.deepEqual(await readFile(join(output, 'duckposting/fonts', file)), await readFile(join(installedAssets, 'fonts', file)));
  }
  const published = await readFile(join(output, 'notes/hello/index.html'), 'utf8');
  assert.match(published, /src="\/project\/assets\/images\/example\.png"/);
  const settings = JSON.parse(page.match(/\.\.\.({.*}),/)[1]);
  assert.ok(settings.template.includes('{{date}}'));
  if (source === '.') {
    execFileSync(command, ['build', '--safe', ...cacheFlags, '--unpublished', '--source', site, '--config', join(site, '_config.yml'), '--destination', output], { stdio: 'pipe' });
    assert.ok(!(await readFile(join(output, 'duckposting/content.json'), 'utf8')).includes('NEVER EMIT'));
    assert.match(await readFile(join(output, 'write/index.html'), 'utf8'), /throw new Error\('Disable unpublished/);
    execFileSync(command, ['build', '--safe', ...cacheFlags, '--source', site, '--config', join(site, '_config.yml'), '--destination', output], { stdio: 'pipe' });
  }
  console.log(`${version}, source ${source}: dated post, draft/future omission, project prefix, image and editor assets passed.`);
}
} finally {
  process.chdir(original);
  if (process.env.KEEP_JEKYLL_SMOKE) console.log(`Fixture retained: ${root}`);
  else await rm(root, { recursive: true, force: true });
}
