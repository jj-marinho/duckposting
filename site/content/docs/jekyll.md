---
title: Jekyll
---


Duckposting adds `/write/` to a Jekyll blog without a Ruby plugin. The editor uses
your existing layout and commits Markdown posts through GitHub. Jekyll builds
the blog and supplies the published post URLs.

Clean `--safe` builds are tested against **Jekyll 3.10.0 and 4.4.1**, including
a GitHub Pages project prefix and a nested `docs/` source.

This first adapter handles `.md` posts in the source's `_posts/` directory.
Pages, HTML posts, `.markdown` files, custom collections, nested category folders
above `_posts/`, and moving files between `_drafts/` and `_posts/` are outside its
scope. Keep those files in your existing workflow.

## Install

The package is not on npm yet. Install a tested `duckposting-*.tgz` archive as
described in the main README. The public package name will remain `duckposting`.

Create `duckposting.config.mjs` in the **repository root**:

```js
import { prepareJekyll } from 'duckposting/jekyll';

await prepareJekyll({ repository: 'your-name/your-blog' });
```

Run it once:

```sh
node duckposting.config.mjs
```

It generates `write.html` and `duckposting/` with prebuilt browser assets and a
Liquid content index. Commit these generated files, the config, dependency
lockfile and alpha archive. Run the same command after an upgrade. It refuses to
overwrite an unrelated `write.html`, `write.md`, `write/` or `duckposting/`.

Merge these paths into your existing `_config.yml` exclusions, keeping existing
entries:

```yaml
exclude:
  - node_modules
  - package.json
  - package-lock.json
  - duckposting.config.mjs
  - vendor
```

Build normally (`bundle exec jekyll build`). GitHub Pages' standard Jekyll build
can use the committed files: Node is needed when preparing/upgrading the editor,
not to run it or rebuild posts. Do not enable `unpublished` or `show_drafts` in a
public build; `/write/` refuses to initialize under those options because its
hidden-draft promise would be incorrect. Preview builds should stay private.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `repository` | Required | GitHub `owner/repository`. |
| `branch` | `main` | Existing writable branch also used by hosting. |
| `source` | `.` | Jekyll source directory relative to the repository root, e.g. `docs`. |
| `layout` | `default` | Your theme's existing writing-page layout. |
| `postLayout` | `post` | Your theme's existing layout for newly created posts. |
| `template` | See below | Markdown template with `{{date}}` substitution. |

The default new-post template is:

```yaml
---
layout: "post"
title: ""
date: {{date}}
published: true
---
```

For GitHub Pages serving a `docs/` source, set `source: 'docs'`. Repository paths
become `docs/_posts/…` and `docs/assets/images/…`; public URLs omit `docs/`.
Keep Jekyll's normal `baseurl` configuration for project sites such as
`https://your-name.github.io/your-blog/`. Assets, uploaded-image URLs and page
links use Jekyll's `relative_url` filter, including that prefix.

## Writing and visibility

Open `/write/`, connect a fine-grained PAT for this repository with **Contents:
read and write**, then create or edit a post. Remembering credentials is optional
and trusts other scripts on the blog's origin. Publish changes one Markdown file
and hosting rebuilds afterwards; direct commits must be allowed on the branch.

New files use Jekyll's required `YYYY-MM-DD-title.md` naming scheme. The date
comes from frontmatter; an empty or invalid date prevents publishing a new post.
Existing files keep their paths when their title or frontmatter date changes.
Jekyll may change their public URL when their date, categories, slug or permalink
changes. Existing links keep the URL chosen when they were inserted.

The Draft checkbox writes Jekyll's native `published: false` in `_posts/`; it does
not move files to `_drafts/`. Unchecking it writes `published: true`. `draft: true`
alone does not hide a Jekyll post. Future-dated posts stay unpublished under
Jekyll's normal settings until their date arrives and the site rebuilds.

The public index comes from Jekyll's published `site.posts`: it contains only
post paths, titles and final URLs, never hidden titles or bodies. Connecting
GitHub lists the `_posts/` file tree to discover unpublished documents without
downloading every body. “Draft / unpublished” also includes future posts and
other documents absent from the built index. `/link page` lists **published
posts only** so links never guess a draft's future permalink.

## Images, Markdown and styling

Image URLs and raster uploads work. Uploads go to `assets/images/` (under
`source`, if configured) and insert root-relative URLs including `baseurl`.
Upload commits happen immediately; their files can be public before a draft is
published. Deleting a post does not delete its images.

The rich editor inherits the surrounding layout's styles. The adapter does not
copy a theme or reproduce Jekyll/Liquid rendering in the browser. Themes can
include templates and scripts as well as CSS; selectors targeting direct article
children may need an editor-wrapper equivalent. Native Markdown tables, code
fences and images remain ordinary Markdown. Published task-list/math rendering
depends on your Jekyll Markdown engine and theme; editor KaTeX support does not
install math rendering on the public blog. Use source mode for Liquid, includes
or other renderer-specific syntax.

The writing page sets `sitemap: false`, which `jekyll-sitemap` understands.
Navigation, search and other theme indexes remain your theme's responsibility.
To remove Duckposting, delete `write.html`, the generated `duckposting/` folder
and config, then uninstall the package. Posts and uploaded images remain.

The integration follows Jekyll's official documentation for
[posts and asset paths](https://jekyllrb.com/docs/posts/),
[permalinks](https://jekyllrb.com/docs/permalinks/),
[publication/frontmatter](https://jekyllrb.com/docs/frontmatter/) and
[project-site URLs](https://jekyllrb.com/docs/github-pages/).
