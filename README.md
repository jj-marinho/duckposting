# duckposting

**A static editor for your blog. Open `/write`, write, Publish.**

Milkdown for rich Markdown, GitHub for one-file commits, your existing site
builder for publishing. No application server, OAuth backend or browser Git clone.

**Alpha: Quartz 5 is the supported integration.** Other builders are future
adapters, not advertised compatibility. One package and import: `duckposting`.
The npm package is prepared locally and has not been published to the registry.

## Try it

**[Try the sandbox](https://jj-marinho.github.io/duckposting/)** ·
**[Install on Quartz](packages/quartz/README.md)**

The token-free sandbox uses the same core with a fake repository. Create, edit,
delete and recover writing without signing in; Publish changes only the browser.

```sh
npm ci
npm run build
python3 -m http.server 8000
```

For a local sandbox, open `http://localhost:8000/demo/`.

## Add it to a blog

[Follow the Quartz installation guide](packages/quartz/README.md). During alpha
testing, install the locally packed npm archive; after registry publication the
command will be `npm install duckposting`.

```ts
import { duckposting } from 'duckposting'
duckposting(config, { repository: 'your-name/your-blog' })
```

Add the small Quartz YAML layout shown in the guide, then build normally.
The package supplies `/write`, the browser assets and the published content index.

The branch must exist and permit direct commits. Enter a fine-grained PAT with
Contents read/write for that repository. Remember on this device is opt-in.

## The writing flow

- `/write` lists content with New Post, Edit and confirmed Delete.
- Title, date and body come first. Controls sit below the writing; frontmatter
  stays under Post settings. Title and date stay synchronized with frontmatter.
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

## Develop and maintain

Node 22+; CI uses Node 24. Recent browsers must support `<dialog>`,
`AbortSignal.any`, `TextEncoder` and `crypto.randomUUID`.

```sh
npm test
npm run build
npm run package
```

`npm run package` builds and packs `dist/duckposting-<version>.tgz` using npm.
CI uploads this candidate; it does not publish to npm. The package remains private
until registry publication is explicitly requested. Browser dependencies are
bundled; only Quartz types and Preact are peers. Licenses ship with the assets.

[Changelog](CHANGELOG.md) · [Contributing](CONTRIBUTING.md) · [Support](SUPPORT.md) ·
[Security](SECURITY.md) · [Troubleshooting](docs/troubleshooting.md) ·
[Audit and release plan](docs/audit-and-release-plan.md)

A remembered PAT trusts every script on the site's origin. Never put credentials
in source or public issues. See the security policy before hosting the editor.

MIT licensed.
