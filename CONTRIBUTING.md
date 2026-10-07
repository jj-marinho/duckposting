# Contributing

Keep the writing flow small. Fix reproducible problems before adding abstractions.
Quartz, Astro and Jekyll have small adapters; avoid claiming support for more builders
without an adapter and an independent installation test.

Node.js 22+, with Node 24 used in CI:

```sh
npm ci
npm test
npm run build
python3 -m http.server 8000
```

Try `http://localhost:8000/demo/`. It uses a fake repository and does not send
requests to GitHub. Source mode is the safe path for renderer-specific Markdown.

- `packages/core`: browser application, editor, document handling and GitHub API.
- `packages/quartz`: Quartz page, resource copying and published index.
- `packages/astro`, `packages/jekyll`: static builder integrations and fixtures.
- `site/content`: editable Markdown project site and canonical user guides.
- `demo`: sandbox using the same core and a fake request function.
- `build.mjs`: browser bundle and prebuilt adapter entries.

Tests use fake GitHub responses and a DOM fixture; none commit real posts.
Protect recovery, metadata preservation and uncertain responses when changing
publishing. Native browser checks should use the sandbox. Test an adapter change
on a clean upstream site as well as the maintained blog.

`npm run package` creates `dist/duckposting-<version>.tgz` via npm pack.
Packaging does not tag, release or publish to npm. Keep per-site configuration
outside the installed package. Verify the packed artifact, not a workspace link:

```sh
node scripts/quartz-smoke.mjs /private/tmp/installed-quartz-5 dist/duckposting-<version>.tgz
```

The fixture must be disposable with dependencies installed. The smoke test
changes its config and content, installs the archive, and builds twice to check
installation, replacement, URL prefixes and draft filtering.

The Astro and Jekyll smoke scripts accept the same archive and create disposable
fixtures under the system temporary directory. `npm run build:site` builds the
Quartz project site from the packed package. No script publishes to npm.

Jekyll smoke checks need the selected Jekyll gem and `kramdown-parser-gfm`;
Jekyll 3 does not pull that parser into a standalone gem installation. CI installs
both explicitly. Existing blogs retain their own Gemfile and renderer settings.
