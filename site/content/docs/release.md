---
title: Releasing to npm
---


The package name is **duckposting**. The npm registry returned 404 for that name when checked on 7 October 2026; availability can change before publication.

All integrations ship together:

```js
import { duckposting } from 'duckposting';        // Quartz
import duckposting from 'duckposting/astro';       // Astro integration
import Duckposting from 'duckposting/astro/component';
import { prepareJekyll } from 'duckposting/jekyll';
```

Browser dependencies are bundled, including editor styles, math fonts, and license notices. Builder peers are optional, so installing for Jekyll does not install Astro or Quartz. Each builder guide names its prerequisites.

## Current status

This repository remains `private: true`, preventing accidental registry publication. `npm run package` produces the alpha archive; CI checks and uploads a release candidate. GitHub Pages deployment does not publish npm packages.

Before release, test the packed artifact against the supported builders and review `npm pack --dry-run`. Keep public documentation honest about alpha support and custom Markdown boundaries.

## First publication

An npm maintainer must claim the name using their own npm account. Enable 2FA, remove `private: true`, select an unused alpha version, and commit the reviewed release changes. Then:

```sh
npm ci
npm test
npm run package
npm publish ./dist/duckposting-VERSION.tgz --dry-run --tag next
npm login
npm publish ./dist/duckposting-VERSION.tgz --access public --tag next
```

These are release instructions, not commands the site build executes. Test `npm install duckposting@next` in a fresh site after the actual publication. Use `latest` for the eventual stable release. A published version cannot be reused. See [npm publish](https://docs.npmjs.com/cli/commands/npm-publish/) and [dist-tags](https://docs.npmjs.com/adding-dist-tags-to-packages).

## Later releases

Configure npm trusted publishing for `jj-marinho/duckposting` and a future `publish.yml` workflow, using GitHub-hosted runners, Node 24, and `id-token: write`. Allow direct publishing explicitly; OIDC replaces a stored npm token and provides public-package provenance. Newly created configurations must complete their first publish within two days. [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)

That future workflow should validate its tag against `package.json`, run tests, build and check the archive, then publish with `next` for prereleases. Keep it separate from ordinary pushes and Pages deployments. No publishing workflow is enabled here yet.

## Making installation easier

After registry release, installation becomes `npm install duckposting`. Quartz and Astro consume the prebuilt package directly. Jekyll runs a small setup helper once and commits the generated static assets, which also work with GitHub Pages’ standard Jekyll build.

No extra packages named duckposting-core or duckposting-quartz need to be published. The source directories are implementation boundaries, not separate products.
