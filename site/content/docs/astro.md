---
title: Astro
---


Duckposting adds a browser editor to a **static Astro site**. Astro still owns your layout, Markdown rendering, routes, content schema, and draft filtering. This adapter does not copy a theme or create a second blog renderer.

Verified packed-package builds: **Astro 5.18.2, 6.4.8, and 7.3.7**.

## Add the package

While duckposting is unpublished, install the archive produced by `npm run package` in this repository:

```sh
npm install /path/to/duckposting-0.1.0-alpha.13.tgz
```

Register the integration in `astro.config.mjs`. It serves the editor assets during development and includes them in the static build:

```js
import { defineConfig } from 'astro/config';
import duckposting from 'duckposting/astro';

export default defineConfig({
  // Keep your existing site, base, Markdown plugins, and other integrations.
  integrations: [duckposting()],
});
```

The same imports will work after an npm release. No registry release is required to use the local package.

## Add `/write/`

Create `src/pages/write.astro`, inside your existing layout. Supply published collection entries and the actual URL your site generates for each entry:

```astro
---
import { getCollection } from 'astro:content';
import Duckposting from 'duckposting/astro/component';
import BlogLayout from '../layouts/BlogLayout.astro';

const posts = await getCollection('blog', ({ data }) => !data.draft);
const pages = posts.map(post => ({
  path: post.filePath!,
  title: post.data.title,
  url: `${import.meta.env.BASE_URL}posts/${post.id}/`,
}));
---
<BlogLayout title="Write">
  <Duckposting
    repository="YOUR-USERNAME/YOUR-BLOG"
    contentDir="src/content/blog"
    pages={pages}
  />
</BlogLayout>
```

The `/posts/{id}/` rule is an example: use your site's route function. `path` must be the repository-relative source `.md` path (the `filePath` from Astro's built-in `glob()` loader). Duckposting uses that path for GitHub edits and the supplied URL for `/link page`. Only published entries appear in this public manifest; authenticated GitHub access discovers repository drafts without making their titles public.

The component inherits **global** typography and styles from its layout. Astro scopes `<style>` selectors to the component that defines them, so scoped post styles will not automatically reach the editor. Move the applicable reading styles into your existing global stylesheet or `style is:global`. This does not reproduce arbitrary Astro components, MDX, or plugin-generated widgets inside Milkdown.

## Content collection and drafts

A standard Astro 5+ collection can use the built-in file loader:

```ts
// src/content.config.ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

export const collections = {
  blog: defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
    schema: z.object({
      title: z.string(),
      date: z.coerce.date(),
      draft: z.boolean().default(false),
    }),
  }),
};
```

Your existing schema may require more metadata. Set `template` on `<Duckposting>` to include those fields. Unknown frontmatter is retained when editing. New posts default to `title`, `date`, and `draft: false` and receive a title-based `.md` filename.

**Filter drafts in your site's public routes and feeds**, using the same predicate as `/write/`. Astro content collections do not automatically hide `draft: true`. For example, a dynamic post route's `getStaticPaths()` should use:

```js
const published = await getCollection('blog', ({ data }) => !data.draft);
return published.map(post => ({ params: { id: post.id }, props: { post } }));
```

This adapter edits ordinary Markdown collections, not remote collections or `.mdx` files. Existing slug overrides and route conventions are supported by supplying correct page URLs; new posts must follow whatever route behavior your project already defines.

## Images and base paths

Uploads default to `public/duckposting-images/`. Astro copies that directory unchanged into the built site. Markdown stores root-relative URLs such as `/duckposting-images/photo-id.png`, or `/project/duckposting-images/photo-id.png` when Astro's `base` is `/project`.

To use another public directory, configure **both** sides of the mapping:

```astro
<Duckposting
  repository="YOUR-USERNAME/YOUR-BLOG"
  contentDir="src/content/blog"
  pages={pages}
  imageDir="public/images"
  imageBase={`${import.meta.env.BASE_URL}images/`}
/>
```

Existing images with custom public URLs can be supplied through `images={[{ path: 'public/images/photo.png', url: '/project/images/photo.png' }]}`. Keep uploaded images in `public/` so Astro serves them as ordinary static files; these uploads do not use Astro's image optimizer. Uploads are committed immediately and can become public before the associated post is published.

Inline and block math render in the editor. To render math on public pages, configure your own Astro Markdown pipeline, for example `remark-math` with `rehype-katex` and KaTeX CSS. The editor does not change your public renderer's Markdown capabilities.

## GitHub and deployment

Build with `astro build`, deploy `dist/` on GitHub Pages, Cloudflare Pages, or another static host, and configure deployment to rebuild from the GitHub branch used by Duckposting. On GitHub Pages project sites, set Astro's `site` and `base` normally; the editor derives asset and image URLs from `BASE_URL`.

Create a fine-grained GitHub PAT restricted to this repository with **Contents: read and write**. Enter it through the editor's GitHub button. Credentials stay in the browser; remembering them is optional. Publish confirms the GitHub commit, and your hosting build follows asynchronously.

## Verification and boundaries

`node scripts/astro-smoke.mjs /path/to/duckposting.tgz` creates a disposable Astro project, installs the real archive, and builds a collection-driven blog. It checks `/write/`, real source paths, project-base links and images, fonts, and draft omission. Set `ASTRO_VERSION` to test another supported Astro version. The fixture is under `packages/astro/fixture` and can also serve as a complete starting example.

The integration supports static output and reserves the `/duckposting/` asset directory. You create the `/write/` route yourself, which makes reusing your layout straightforward. There is no server, content database, or theme detection.

Sources: [Astro integrations](https://docs.astro.build/en/reference/integrations-reference/), [content collections](https://docs.astro.build/en/guides/content-collections/), [routing](https://docs.astro.build/en/guides/routing/), and [public images](https://docs.astro.build/en/guides/images/#where-to-store-images).
