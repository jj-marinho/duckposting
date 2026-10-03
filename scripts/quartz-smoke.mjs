// Integration gate: modifies an installed, disposable Quartz 5 checkout only.
// node scripts/quartz-smoke.mjs /private/tmp/quartz-clean /path/package.tgz
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import { resolve, join, basename, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
const run = promisify(execFile);
const [checkoutArg, archiveArg] = process.argv.slice(2);
if (!checkoutArg || !archiveArg) throw new Error('Usage: node smoke.mjs DISPOSABLE_QUARTZ_CHECKOUT PACKAGE_TGZ');
const checkout = await realpath(resolve(checkoutArg));
const temporaryRoot = await realpath(tmpdir());
const temporaryRoots = [temporaryRoot, await realpath('/tmp').catch(() => null)].filter(Boolean);
if (!temporaryRoots.some(root => checkout.startsWith(root + sep))) throw new Error('This smoke test only modifies disposable checkouts under the system temporary directory.');
const cache = join(temporaryRoot, 'duckposting-smoke-npm-cache');
const archive = resolve(archiveArg);
const pkg = JSON.parse(await readFile(join(checkout, 'package.json'), 'utf8'));
assert.equal(pkg.version, '5.0.0', 'Expected a clean Quartz v5 checkout with npm ci completed');
const { parse, stringify } = await import(pathToFileURL(join(checkout, 'node_modules/yaml/dist/index.js')));
const config = parse(await readFile(join(checkout, 'quartz.config.default.yaml'), 'utf8'));
config.configuration.baseUrl = 'example.org/garden';
config.configuration.analytics = null;
config.configuration.theme.cdnCaching = false;
config.layout.byPageType.duckposting = { template: 'full-width', positions: { beforeBody: [], afterBody: [], left: [], right: [] } };
await writeFile(join(checkout, 'quartz.config.yaml'), stringify(config));
await writeFile(join(checkout, 'quartz.ts'), `import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"\nimport { duckposting } from "duckposting"\nconst config = await loadQuartzConfig()\nduckposting(config, { repository: "example/fixture" })\nexport default config\nexport const layout = await loadQuartzLayout()\n`);
await mkdir(join(checkout, 'notes/posts'), { recursive: true });
await writeFile(join(checkout, 'notes/index.md'), '---\ntitle: Release fixture\n---\n\nA fixture page.\n');
await writeFile(join(checkout, 'notes/posts/published.md'), '---\ntitle: Published fixture\ndraft: false\n---\n\nPublished content.\n');
await writeFile(join(checkout, 'notes/posts/draft.md'), '---\ntitle: Secret fixture title\ndraft: true\n---\n\nSecret fixture content.\n');
const savedConfig = await readFile(join(checkout, 'quartz.config.yaml'));
const savedTS = await readFile(join(checkout, 'quartz.ts'));
const archiveName = basename(archive);
assert.match(archiveName, /^duckposting-[\w.-]+\.tgz$/);
for (const round of ['install', 'replacement']) {
    // npm uninstalls/reinstalls to test the artifact without a workspace link.
    await run('npm', ['uninstall', 'duckposting', '--ignore-scripts', '--cache', cache], { cwd: checkout });
    await run('npm', ['install', archive, '--ignore-scripts', '--cache', cache], { cwd: checkout });
    const stage = join(checkout, 'node_modules/duckposting');
    const packed = JSON.parse(await readFile(join(stage, 'package.json'), 'utf8'));
    assert.equal(packed.name, 'duckposting');
    assert.equal(basename(archive), `duckposting-${packed.version}.tgz`);
    assert.deepEqual(await readFile(join(checkout, 'quartz.config.yaml')), savedConfig);
    assert.deepEqual(await readFile(join(checkout, 'quartz.ts')), savedTS);
    const { stdout, stderr } = await run(process.execPath, ['quartz/bootstrap-cli.mjs', 'build', '--directory', 'notes', '--output', 'package-smoke-output', '--concurrency', '2'], { cwd: checkout, maxBuffer: 8 * 1024 * 1024 });
    assert(!/Failed to emit|Exiting Quartz|Error:/.test(stdout + stderr), stdout + stderr);
    const output = join(checkout, 'package-smoke-output');
    const html = await readFile(join(output, 'write/index.html'), 'utf8');
    assert(html.includes('/garden/duckposting/editor.js?v='));
    assert(html.includes('&quot;contentRoot&quot;:&quot;notes&quot;'));
    const index = JSON.parse(await readFile(join(output, 'duckposting/content.json'), 'utf8'));
    assert.deepEqual(index.map(file => file.path).sort(), ['notes/index.md', 'notes/posts/published.md']);
    assert(!JSON.stringify(index).includes('Secret'));
    for (const file of ['index.xml', 'sitemap.xml', 'static/contentIndex.json']) {
      const text = await readFile(join(output, file), 'utf8');
      assert(!text.includes('/write/') && !text.includes('write/index') && !text.includes('Secret'), file);
    }
    for (const file of ['editor.js', 'editor.css', 'THIRD_PARTY_LICENSES.txt']) {
      assert.deepEqual(await readFile(join(output, 'duckposting', file)), await readFile(join(stage, 'dist', file)));
    }
    console.log(`${round}: ${archiveName} built successfully, config unchanged, public index and draft filtering verified.`);
}

