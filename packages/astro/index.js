import { readFile, mkdir, copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The published adapter lives in dist/astro, beside the shared browser assets.
export default function duckposting(_options = {}, assetsDir = fileURLToPath(new URL('../', import.meta.url))) {
  let base = '/', assets;
  async function loadAssets() {
    if (assets) return assets;
    const names = ['editor.js', 'editor.css', 'THIRD_PARTY_LICENSES.txt'];
    try {
      const css = await readFile(join(assetsDir, 'editor.css'), 'utf8');
      for (const match of css.matchAll(/url\(["']?(?:\.\/)?(fonts\/[^)"']+)/g)) if (!names.includes(match[1])) names.push(match[1]);
      assets = new Map(await Promise.all(names.map(async name => [name, await readFile(join(assetsDir, name))])));
      return assets;
    } catch (cause) { throw new Error('duckposting: browser assets are missing. Reinstall duckposting or build its source package.', { cause }); }
  }
  return {
    name: 'duckposting',
    hooks: {
      'astro:config:done': async ({ config }) => {
        if (config.output !== 'static') throw new Error('duckposting supports Astro static output. Set output: "static".');
        base = config.base.replace(/\/?$/, '/');
        await loadAssets();
      },
      'astro:server:setup': ({ server }) => {
        server.middlewares.use((request, response, next) => {
          const path = new URL(request.url, 'http://localhost').pathname;
          if (!['GET', 'HEAD'].includes(request.method) || !path.startsWith(`${base}duckposting/`)) return next();
          const name = path.slice(`${base}duckposting/`.length), bytes = assets?.get(name);
          if (!bytes) return next();
          response.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : name.endsWith('.woff2') ? 'font/woff2' : name.endsWith('.woff') ? 'font/woff' : name.endsWith('.ttf') ? 'font/ttf' : 'text/plain');
          response.end(request.method === 'HEAD' ? undefined : bytes);
        });
      },
      'astro:build:done': async ({ dir }) => {
        for (const name of (await loadAssets()).keys()) {
          const target = join(fileURLToPath(dir), 'duckposting', name);
          await mkdir(dirname(target), { recursive: true });
          await copyFile(join(assetsDir, name), target);
        }
      },
    },
  };
}

/** The site passes its actual published routes; the editor never guesses them. */
export function browserSettings(options, base = '/') {
  const { pages, ...config } = options;
  if (!Array.isArray(pages)) throw new Error('duckposting: pass pages from your filtered, published Astro collection.');
  if (!config.repository || !config.contentDir) throw new Error('duckposting: configure repository and contentDir.');
  const siteBase = base.replace(/\/?$/, '/');
  const contentRoot = config.contentRoot ?? config.contentDir;
  return {
    branch: 'main', template: '---\ntitle: ""\ndate: {{date}}\ndraft: false\n---\n\n',
    ...config, contentRoot, siteBase,
    imageDir: config.imageDir ?? 'public/duckposting-images',
    imageBase: config.imageBase ?? `${siteBase}duckposting-images/`,
    published: pages, publishedLinksOnly: true,
  };
}
