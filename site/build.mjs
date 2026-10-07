import { mkdir, cp, rm, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const checkout = join(root, 'site/.quartz');
// Pin the builder; the published site is built with the exact package under review.
const revision = '97a2d05f80c4c50534959b1d0d41cc4b3895625e';
const cache = process.env.npm_config_cache || join(root, 'site/.npm-cache');
async function command(program, args, cwd = root) {
  const { stdout, stderr } = await run(program, args, { cwd, maxBuffer: 16 * 1024 * 1024 });
  process.stdout.write(stdout); process.stderr.write(stderr);
}
await command('npm', ['run', 'package', '--', '--cache', cache]);
await mkdir(checkout, { recursive: true });
try { await readFile(join(checkout, '.git/HEAD')); }
catch {
  await command('git', ['init', '-q'], checkout);
  await command('git', ['remote', 'add', 'origin', 'https://github.com/jackyzha0/quartz.git'], checkout);
}
await command('git', ['fetch', '--depth=1', 'origin', revision], checkout);
await command('git', ['checkout', '--force', revision], checkout);
// Restore the upstream lockfile before npm ci; local adapter installation changes it.
await command('git', ['restore', 'package.json', 'package-lock.json'], checkout);
await command('npm', ['ci', '--cache', cache], checkout);
const pkg = JSON.parse(await readFile(join(root, 'package.json')));
await command('npm', ['install', join(root, `dist/duckposting-${pkg.version}.tgz`), '--ignore-scripts', '--cache', cache], checkout);
await cp(join(root, 'site/quartz.ts'), join(checkout, 'quartz.ts'));
await cp(join(root, 'site/quartz.config.yaml'), join(checkout, 'quartz.config.yaml'));
await cp(join(root, 'site/components/DocsFrame.tsx'), join(checkout, 'quartz/components/frames/DocsFrame.tsx'));
await cp(join(root, 'site/style.scss'), join(checkout, 'quartz/styles/custom.scss'));
await rm(join(checkout, 'site/content'), { recursive: true, force: true });
await cp(join(root, 'site/content'), join(checkout, 'site/content'), { recursive: true });
await command(process.execPath, ['quartz/bootstrap-cli.mjs', 'build', '--directory', 'site/content', '--output', 'public'], checkout);
await rm(join(root, 'site/public'), { recursive: true, force: true });
await cp(join(checkout, 'public'), join(root, 'site/public'), { recursive: true });
// Keep the safe, fake-repository demo beside the real editor, not in its place.
await cp(join(root, 'demo'), join(root, 'site/public/demo'), { recursive: true });
await writeFile(join(root, 'site/public/.nojekyll'), '');
console.log(`Built duckposting ${pkg.version}: site/public`);
