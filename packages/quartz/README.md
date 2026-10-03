# Install duckposting on Quartz 5

Duckposting adds a static `/write` page to an existing Quartz 5 blog. It lists
Markdown content, edits posts, recovers local writing and commits one document
at a time through GitHub. No editor server or extra browser installation.
Quartz 4 is not supported. See the [project support policy](https://github.com/jj-marinho/duckposting/blob/main/SUPPORT.md).

## 1. Copy one folder

Download `duckposting-0.1.0-alpha.1.zip` from the
[alpha release](https://github.com/jj-marinho/duckposting/releases/tag/v0.1.0-alpha.1).
Extract it and copy its
`duckposting/` folder into the root of your Quartz repository. It contains the
prebuilt browser files, adapter, licenses and VERSION. No new Milkdown or YAML
dependency is installed in the blog.

Developers can build that archive in the duckposting source checkout with
`npm ci && npm run package`. For local
iteration, `node /path/to/duckposting/copy-to-blog.mjs /path/to/blog` copies the
built files. It works from another working directory too.

## 2. Register the writing page

In the blog's `quartz.ts`, after loading its config and before exporting it:

```ts
import { duckpostingQuartz } from './duckposting/index'

const config = await loadQuartzConfig()
duckpostingQuartz(config, { repository: 'your-name/your-blog' })
export default config
```

Keep your existing config loading and customizations; add the import and function
call instead of replacing the whole file. Keep site-specific options here,
outside the replaceable `duckposting/` folder.

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
| `exclude` | Quartz's ignorePatterns; literal names or relative glob patterns. |
| `template` | Frontmatter title, today's `{{date}}`, `draft: false`, empty body. |
| Third argument | Source assets folder, normally `duckposting`. |

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

Rich editing uses CommonMark. If a roundtrip would change existing Markdown,
Duckposting opens source mode; choosing Rich explicitly allows conversion when
you edit. This can include harmless formatting differences. Use source for
wikilinks, callouts, embeds, GFM extensions or builder-specific syntax.

## Upgrade / remove

Replace the `duckposting/` folder with the new release, retain your `quartz.ts`
options and YAML layout, then rebuild. Check VERSION and release notes first.
Asset URLs carry a content hash. Browser draft/token keys are retained across
these alpha changes; copy important writing before any upgrade.

To remove: remove the import/function call from `quartz.ts`, remove the optional
YAML layout entry and `duckposting/` folder, then rebuild. Markdown posts and
Git history remain. Browser recovery is separate; use Forget for credentials.

[Read troubleshooting](https://github.com/jj-marinho/duckposting/blob/main/docs/troubleshooting.md).
