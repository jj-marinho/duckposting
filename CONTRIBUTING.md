# Contributing

Keep the writing flow small. Fix reproducible problems before adding abstractions.
The supported integration is Quartz 5; avoid claiming support for other builders
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
- `demo`: sandbox using the same core and a fake request function.
- `build.mjs`, `copy-to-blog.mjs`, `release.mjs`: development and packaging.

Tests use fake GitHub responses and a DOM fixture; none commit real posts.
Protect recovery, metadata preservation and uncertain responses when changing
publishing. Native browser checks should use the sandbox. Test an adapter change
on a clean upstream site as well as the maintained blog.

`npm run package` creates `dist/duckposting-<version>.zip`; it needs `zip` on PATH.
Packaging does not tag, release or publish to npm. Keep per-site configuration
outside the replaceable `duckposting/` folder.
