---
title: Quartz 5
---


Duckposting adds a static `/write` page to an existing Quartz 5 blog. It lists
Markdown content, edits posts, recovers local writing and commits one document
at a time through GitHub. No editor server or extra browser installation.
Quartz 4 is not supported. See the [project support policy](https://github.com/jj-marinho/duckposting/blob/main/SUPPORT.md).

## 1. Install the package

The package is named `duckposting`. It is **not published to npm yet**. During
alpha testing, generate an npm package in the duckposting checkout:

```sh
npm ci
npm run package
```

Copy `dist/duckposting-0.1.0-alpha.13.tgz` into your blog's `vendor/` directory,
then run from the blog:

```sh
npm install ./vendor/duckposting-0.1.0-alpha.13.tgz
```

Commit the archive, package.json and package-lock.json so your host's `npm ci`
installs the same tested package. This is a normal npm dependency, containing
prebuilt browser assets; the blog does not install Milkdown or build the editor.
Once published, only the install command changes to `npm install duckposting`.

## 2. Register the writing page

In the blog's `quartz.ts`, after loading its config and before exporting it:

```ts
import { duckposting } from 'duckposting'

const config = await loadQuartzConfig()
duckposting(config, { repository: 'your-name/your-blog' })
export default config
```

Keep your existing config loading and customizations; add the import and function
call instead of replacing the whole file. Keep site-specific options here,
outside the installed package.

In `quartz.config.yaml`, add this under your existing `layout.byPageType`:

```yaml
layout:
  byPageType:
    duckposting:
      template: full-width
      positions:
        beforeBody: []
        afterBody: []
        left: []
        right: []
```

Keep Quartz's RemoveDraft plugin enabled. The adapter checks its presence;
without it, “Draft — hidden from the blog” would be a false promise. Reserve
`/write` for the editor: real `write.md` or `write/index.md` content is rejected.

## 3. Build, connect and write

Build/deploy the blog normally. Connect hosting to the same branch that
Duckposting writes (`main` by default). Open `/write/`, click the GitHub icon,
and enter a fine-grained PAT for this repository with **Contents: read and
write**. Click Connect. The branch must already exist and permit direct commits.
Remembering is optional; Forget removes the token without removing drafts.

Create a post. Its frontmatter title supplies the initial filename. Publish
commits the current file; hosting deploys asynchronously. With Draft checked,
the file is committed but Quartz keeps it hidden. Use Edit for existing posts;
changing their title keeps their path/URL. Delete requires confirmation.

## Options and paths

| Option | Default / meaning |
| --- | --- |
| `repository` | Required `owner/repository`; GitHub.com only. |
| `branch` | `main`. |
| `contentRoot` | Omit to use Quartz's content directory. An override must match its actual `--directory`. |
| `contentDir` | `<contentRoot>/posts`; must be inside contentRoot. |
| `imageDir` | `<contentRoot>/images`; uploads must stay inside contentRoot. |
| `exclude` | Quartz's ignorePatterns; literal names or relative glob patterns. |
| `template` | Frontmatter title, today's `{{date}}`, `draft: false`, empty body. |

Use repository-relative Quartz content directories (`content`, `notes`,
`src/content`). `./` and Windows separators normalize; absolute paths and `..`
are unsupported. Production URL prefixes are respected, while `--serve` uses
Quartz's local root URLs.

The published index contains only paths/titles from filtered real Markdown
files. Draft discovery uses GitHub's authenticated file tree, without downloading
every body. Absent paths mean **unpublished**, not proven frontmatter draft
status. Draft title/text is not emitted into the public index. `/write` is unlisted
from Quartz RSS, sitemap and search. External crawler exclusion is separate.

## Styling and Markdown

The header, footer, article fonts and colors come from Quartz. Themes can also
include components and layouts; they are not necessarily CSS-only. A selector
like `article > p` needs `article .ProseMirror > p` for the rich editor's wrapper.
No copied theme, automatic CSS rewriting or exact renderer preview is promised.

Rich editing uses CommonMark, GFM tables/task lists and `$…$` inline math and
`$$…$$` block math. Keep Quartz's GitHubFlavoredMarkdown transformer enabled for
tables and checklists on published pages.
Enable Quartz's `@quartz-community/latex` transformer with `renderEngine: katex`
for equations on published pages; the editor renders them with KaTeX. This is
math notation, not a full LaTeX document compiler. Escape `\$` for literal dollars.

Type `/` in a paragraph or use **Insert /** below the body. The menu includes
page/URL links, images, code, equations and tables. Choose
Link page to search the existing catalog by title or path. Draft pages are
labeled; they become publicly reachable only when published. Links store full
content-root-relative Markdown paths, resolved by Quartz's link transformer.

Table controls sit beside and below each table: + Column / − Column on the
right, + Row / − Row underneath. Removal trims the last column or row and can
be undone; the header, one body row and one column remain.

Code blocks have a language picker and save ordinary fenced Markdown. Keep
Quartz's SyntaxHighlighting transformer enabled for highlighting published code;
the editor itself shows plain monospaced code. Imported language names and aliases
stay intact; Markdown mode lets you specify languages outside the picker.

Use Image to insert a URL or upload a raster image (10 MB max). Pasting images
and dropping image files use the same upload path. In source mode, files insert
at the current text selection.
Files are committed immediately to `imageDir` with unique filenames. The post
stores ordinary `![alt](images/file.png)` Markdown, never a temporary blob URL.
The editor can preview repository images before the site rebuilds. Quartz's
asset URLs and site prefixes are respected. Uploads may be public even for draft
posts; discarding or deleting a post does not remove its image files.

If a roundtrip would change existing Markdown,
Duckposting opens source mode; choosing Rich explicitly allows conversion when
you edit. This can include harmless formatting differences. Use source for
wikilinks, callouts, embeds or builder-specific syntax.

## Upgrade / remove

Install the next version with npm, commit the changed lockfile and rebuild.
During unpublished alpha testing, install a new versioned archive in `vendor/`
and remove the old archive after updating. Keep your `quartz.ts` options and YAML
layout. Asset URLs carry a content hash. Browser draft/token keys are retained;
copy important writing before any upgrade.

To remove: remove the import/function call from `quartz.ts` and the YAML layout
entry, run `npm uninstall duckposting`, delete its vendor archive, then rebuild.
Markdown posts and Git history remain. Use Forget to remove browser credentials.

[Read troubleshooting](https://jj-marinho.github.io/duckposting/docs/support).
