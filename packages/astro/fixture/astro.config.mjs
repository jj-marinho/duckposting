import { defineConfig } from 'astro/config';
import duckposting from 'duckposting/astro';
export default defineConfig({
  site: 'https://example.github.io', base: '/project', trailingSlash: 'always',
  integrations: [duckposting()],
});
