# Project site

The homepage is duckposting's local sandbox, opening an editable introduction.
`/write/` and `/demo/` are aliases sharing its browser storage. No PAT or real
repository writes. Quartz 5 renders the secondary Markdown docs in `site/content/docs/`.
The public sandbox is https://jj-marinho.github.io/duckposting/.

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
Pages Actions. The sandbox never writes to GitHub. Never test uploads just to
verify its UI.

User-facing guides live in `site/content/docs/` and are maintained through Git.
No registry publication occurs as part of a site build.
