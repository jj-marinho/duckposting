# duckposting

**Open `/write`, choose a post, write like you're reading your blog, Publish.**

A static Markdown editor with Milkdown and GitHub's REST API. Your existing
site builder publishes the blog. No application server or browser Git clone.

## Small architecture

- **duckposting-core:** content list, rich/source editing, title/frontmatter,
  per-document local drafts, GitHub connection and single-file commits.
- **duckposting-quartz:** a Quartz 5 `/write` page using the blog's own layout
  and styles, plus a tiny index of published Markdown files.

No npm release yet. Build here and copy the assets into your blog.
See [Quartz setup](packages/quartz/README.md).

## Develop

Node.js 22+:

```sh
npm ci
npm test
npm run build
python3 -m http.server 8000
```

Open `http://localhost:8000/write/`. Configure `write/index.html` first.
To update a Quartz blog:

```sh
node copy-to-blog.mjs /path/to/blog
```

Build the blog normally. No additional Milkdown dependencies in the blog.

## Writing

`/write` lists published content. Connect GitHub using the icon to include
repository drafts. Each document has **Edit** and **Delete**; deletion requires
confirmation and creates a Git commit, so earlier versions remain in history.
**+ New Post** offers unfinished local posts and repository drafts, or a fresh
post. Local changes to an existing document are offered only for that exact
repository path. Going back to the list preserves writing; reload opens the
list again. Recovery is always a choice.

**Post settings** is always visible above the title. The editable title and
frontmatter title stay synchronized. **Draft — hidden from the blog** updates
`draft: true`; unchecking it writes `draft: false`. Publish saves either state
to GitHub. The renderer is responsible for hiding drafts (Quartz's RemoveDraft
filter does this). Local drafts and repository drafts are separate: typing
saves locally, Publish commits the current document.

**Markdown** switches to full source; the toggle stays in the same place.
Source mode is useful for builder-specific syntax. Rich editing handles
CommonMark, not custom components, wikilinks or an exact renderer preview.
Rich serialization may normalize Markdown. Code blocks have a trailing
paragraph; Down Arrow from their last line or ⌘/Ctrl+Enter reaches it.

New posts get filenames from their frontmatter title: `João’s ideas!` becomes
`joaos-ideas.md`. Existing posts keep their paths when renamed in the editor,
so their URLs remain stable. New-post templates substitute only `{{date}}`.
Unknown metadata remains intact. Image uploading is not implemented.

Publish stays disabled until the editor has a valid title, body and token.
One action changes one file, with no batch publishing. On uncertain responses,
the same file is read and compared; deletion is checked for absence. Errors
preserve the local draft. Success clears only that document's local draft and
returns to the list. Cloudflare deployment follows the GitHub commit.

## Listing without downloading every post

The host generates a public JSON array of **published** source paths and titles.
GitHub's recursive tree API lists repository Markdown paths in one authenticated
request. Paths absent from the public index are shown as **Draft / unpublished**;
their title initially comes from the path. Only opening a document downloads
its Markdown. Draft titles and text are never included in the public index.

Successful editor actions cache title/visibility locally so the list stays
correct while deployment catches up. This deliberately assumes `/write` is
your writing workflow; concurrent users and edits outside it are not handled.
Repository and branch must already exist and allow direct commits.

## Integrate another builder

Serve `dist/editor.js` and `dist/editor.css` from your site, and mount inside
your article layout:

```js
import { mountDuckposting } from '/duckposting/editor.js';
const destroy = await mountDuckposting(articleRoot, {
  repository: 'your-name/your-blog',
  branch: 'main',
  contentRoot: 'content',
  contentDir: 'content/posts',
  exclude: ['private', 'templates', '.obsidian'],
  index: '/duckposting/content.json',
  template: '---\ntitle: ""\ndate: {{date}}\ndraft: false\n---\n\n',
});
```

`contentRoot` scopes the list; `contentDir` holds new posts. `exclude` contains
literal file/folder names excluded from the list, not glob expressions.
`index` is optional; without it GitHub content initially appears unpublished.
Its JSON shape is `[{ "path": "content/about.md", "title": "About", "draft": false }]`.
Call `destroy()` when removing the root during client-side navigation.

Host CSS supplies article typography; core CSS handles controls and editing
mechanics. No Shadow DOM or copied theme. Quartz 5 is supported today; other
builders need adapters for indexing, draft semantics and filename conventions.
Jekyll's dated filenames, for example, need a small integration change.

## Credentials and local storage

Use a fine-grained PAT for the repository with **Contents: read and write**.
**Remember on this device** is opt-in; **Forget** removes credentials without
removing writing. GitHub.com is the supported API host.

Anyone can open `/write`; GitHub checks commit permission. Tokens belong only
in browser storage, never source. Remembering assumes other scripts on the
site's origin are trusted. Serve the pinned editor bundle from your own site.
Local drafts are scoped by repository, branch and content directory, then by
exact path (or a unique ID for a new post). Old Duck drafts and tokens migrate.
Use one writing tab at a time.

## Contributing

`npm test` checks UTF-8 create/update/delete, collisions, lost responses,
concurrent-action protection, draft isolation/migration and metadata
preservation. GitHub is simulated; tests don't publish real posts. Browser
checks can mount with `{ request, storage }` as a third argument to supply
an isolated fake repository; normal integrations omit it.

Keep changes small. Add adapters instead of forking core. No framework or
provider registry until another integration needs it.

MIT licensed. The build includes dependency licenses in
`THIRD_PARTY_LICENSES.txt`.
