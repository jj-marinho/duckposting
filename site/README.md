# Project site

Markdown in `site/content/`, Quartz 5, and the same packed duckposting package
used by consumers. `/write/` edits this repository's `site/content/`;
new posts go into `site/content/notes/`. The public site is
https://jj-marinho.github.io/duckposting/.

```sh
npm ci
npm run build:site
npm run serve:site
```

Open `http://localhost:8000/duckposting/`. The static preview respects production
URL prefixes and extensionless Quartz links. Build once before serving; this
uses Quartz’s own static-server dependency. Set `PORT` to choose another port.

The builder is pinned by commit in `site/build.mjs`. It lives in an ignored
`site/.quartz/` checkout, receives copied site configuration/content, and installs
the packed root package. There is no copied editor implementation. Build output
and builder dependencies are not committed. `npm run build:site` needs network
access for the pinned upstream checkout and npm dependencies.

`.github/workflows/demo.yml` builds and deploys `site/public` through GitHub
Pages Actions. The token-free sandbox remains at `/demo/`; it never writes to
GitHub. The real `/write/` page needs an authorized PAT. Never test publication
or uploads on the real site just to verify its UI.

User-facing guides live in `site/content/docs/` so they can be maintained through
duckposting itself. Code changes still use Git. No registry publication occurs
as part of a site build.
