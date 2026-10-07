# Support

Duckposting is an early alpha maintained on a best-effort basis. Current support:
Quartz 5, static Astro 5–7, Jekyll Markdown posts, GitHub.com and recent browsers. No guaranteed response time.

Use [Issues](https://github.com/jj-marinho/duckposting/issues) for reproducible
bugs and, until a separate discussion channel is enabled, setup questions with
“Question” in the title. Check [troubleshooting](docs/troubleshooting.md) first.

Include Duckposting's VERSION, builder version or commit, browser, steps, expected
and actual behavior, and a small sanitized example. Do not upload a PAT, private
Markdown or a full browser-storage export.

One writer root, one writing tab and one document per action are supported.
Concurrent authors, arbitrary themes, custom Markdown dialects and unlisted static
builders are outside the current support promise. A theme may need a small CSS
adjustment for the rich editor's wrappers.

Astro route/collection schemas and draft filtering stay with the host. The Jekyll
adapter handles `.md` files in `_posts`, using `published: false`; custom
collections, pages and `_drafts` moves are outside this first integration.
See the [builder guides](site/content/docs/index.md).
