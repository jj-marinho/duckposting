# duckposting

**A static editor for your blog. Open `/write`, write, Publish.**

Milkdown for rich Markdown, GitHub for one-file commits, your existing site
builder for publishing. No application server, OAuth backend or browser Git clone.

**Alpha: Quartz 5 is the supported integration.** Other builders are future
adapters, not advertised compatibility. No npm package or public release yet.

## Try it

The token-free sandbox uses the same core with a fake repository. Create, edit,
delete and recover writing without signing in; Publish changes only the browser.

```sh
npm ci
npm run build
python3 -m http.server 8000
```

Open `http://localhost:8000/demo/`. A public hosted demo is a launch prerequisite;
this repository currently provides its source and build, not a hosted-demo claim.

## Add it to a blog

[Follow the Quartz installation guide](packages/quartz/README.md): copy the
prebuilt `duckposting/` folder, register it in `quartz.ts`, add the layout, build.
A versioned ZIP can be generated with `npm run package`; no extra editor packages
are installed in the blog. Keep per-site configuration outside the copied folder.

The branch must exist and permit direct commits. Enter a fine-grained PAT with
Contents read/write for that repository. Remember on this device is opt-in.

## The writing flow

- `/write` lists content with New Post, Edit and confirmed Delete.
- Settings stay above the title; title and frontmatter stay synchronized.
- Local recovery is scoped to the exact document. New Post offers both local
  unfinished posts and repository drafts. Recovery is a choice.
- Publish changes one Markdown file. Draft checked means committed but hidden
  by Quartz. Cloudflare or another host deploys after the GitHub commit.
- New filenames come from titles, including Unicode letters/numbers. Existing
  documents keep their paths when their titles change.
- Source preserves renderer-specific Markdown. Rich mode is CommonMark, and
  existing source defaults to Markdown if rich serialization would change it.

Local drafts live in one browser/origin. Repository drafts are committed files.
“Draft / unpublished” in the list means absent from the deployed published
index; it does not prove a frontmatter field. Errors keep writing local.

## Small architecture

| Part | Responsibility |
| --- | --- |
| `duckposting-core` | Content UI, document metadata, recovery and GitHub Contents/Tree API. |
| `duckposting-quartz` | `/write`, host layout, browser assets and published index. |
| Host | Rendering Markdown, hiding drafts, deploying and styling articles. |

One root per page, one writing tab and one document per action. No multi-author
coordination, batch commits, image upload, exact build preview or pull-request
workflow. Tests protect publishing, metadata and recovery; they simulate GitHub.

## Reuse core

Serve the built `editor.js` and `editor.css` with your site:

```js
import { mountDuckposting } from '/duckposting/editor.js';
const destroy = await mountDuckposting(articleRoot, {
  repository: 'your-name/your-blog',
  branch: 'main',
  contentRoot: 'content',
  contentDir: 'content/posts',
  exclude: ['private', 'templates'],
  index: '/duckposting/content.json',
  template: '---\ntitle: ""\ndate: {{date}}\ndraft: false\n---\n\n',
});
```

An index is optional, but without it initial repository files appear unpublished.
Its shape is `[{ "path": "content/about.md", "title": "About" }]`, containing
only published content. Paths are scoped/validated. Call `destroy()` before
removing the root on client-side navigation; requests and old callbacks are cancelled.
Host CSS must account for `.ProseMirror` wrappers. `readTitle` and `isDraft` are
also exported for small host/demo integrations.

Core reusability does not make draft semantics or filenames universal. Jekyll's
dated filenames, Hugo's metadata conventions and MDX need adapter-specific work.

## Develop and maintain

Node 22+; CI uses Node 24. Recent browsers must support `<dialog>`,
`AbortSignal.any`, `TextEncoder` and `crypto.randomUUID`.

```sh
npm test
npm run build
node copy-to-blog.mjs /path/to/blog
npm run package
```

Packaging needs `zip`. CI uploads a release candidate; it does not publish a
release or npm package. All workspace packages remain private to prevent an
accidental incomplete npm release. Bundled dependency licenses ship alongside
the browser assets.

[Contributing](CONTRIBUTING.md) · [Support](SUPPORT.md) ·
[Security](SECURITY.md) · [Troubleshooting](docs/troubleshooting.md) ·
[Audit and release plan](docs/audit-and-release-plan.md)

A remembered PAT trusts every script on the site's origin. Never put credentials
in source or public issues. See the security policy before hosting the editor.

MIT licensed.
