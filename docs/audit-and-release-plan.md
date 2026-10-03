# duckposting: code audit and public-alpha plan

Audit date: 3 October 2026. Scope: the core, Quartz adapter, browser assets,
local recovery, GitHub protocol, packaging, installation and support experience.
The audit included independent reviews of core and integration code, a clean
upstream Quartz installation, automated regressions and browser testing.

This report records the original audit candidate. Subsequent work is tracked in
[the public-alpha follow-up](alpha-release.md), including distribution and the
additional keyboard/editor fixes.

## Assessment

**A reasonable Quartz 5 public alpha is achievable with this architecture.**
The original version had real correctness problems that should have been fixed
before inviting strangers to put their writing through it. The changes in this
audit address those problems. The remaining work is mostly distribution,
independent usability testing and clear expectations.

Do not launch it as a universal static-site CMS. Its reusable core is real, but
only the Quartz 5 adapter has been exercised. A renderer's draft conventions,
file naming and page layout cannot be generalized by loading its CSS.

The product promise should be: **a static `/write` editor for an existing Quartz
blog, with local recovery and one-file GitHub publishing.** Keep that small.

## Findings and changes

| Original pattern | Consequence | Change |
| --- | --- | --- |
| Regex-based YAML metadata | Comments, quoting, multiline values and duplicate keys could disagree with the renderer or corrupt metadata. | A real YAML parser validates the mapping. Field changes replace source ranges, preserving unrelated settings and body. |
| Concatenating metadata and body | A closing separator without a final newline could become `---Body`. | One document join function guarantees separation; regression covers the missing newline. |
| Rich editor serializes on initialization | Opening an existing post could normalize or lose renderer-specific syntax. | No initialization autosave. Compare the CommonMark roundtrip; default to source if it changes the document. Explicitly selecting Rich opts into conversion when editing. |
| Title-based ASCII-only filenames | Non-Latin titles could produce an empty filename. | Preserve Unicode letters/numbers, remove accents and apostrophes, normalize separators. Existing posts retain their original path. |
| Late editor/network callbacks | Navigation during loading could update the wrong view or leave an editor alive. | View generations, captured document sessions, cleanup, navigation locks and abortable requests. |
| Unvalidated cached JSON | A damaged cache could crash startup or silently lose recoverable material. | Validate shapes, keep damaged raw data for manual recovery, retain legacy data if migration cannot be persisted. |
| Cached drafts depend on the published index | An exact-document local edit could disappear from the list offline. | Merge validated local document drafts independently of the deployed index. |
| Treating every delete 404 as success | GitHub's private-repository denial could erase the user's local recovery copy. | Read the current file, then delete its revision; a denied action preserves local writing. |
| Loosely scoped file operations | Bad configuration/index data could target unrelated repository files. | Validate repository/path configuration and enforce the content root, Markdown extension and exclusions on reads and mutations. |
| Ad hoc exclusion matching | Real Quartz glob patterns could behave differently in the editor. | Use a small glob matcher and pass Quartz ignore patterns through. |
| Implicit assumptions about GitHub responses | Truncated trees, symlinks or non-inline content could be displayed incorrectly. | Reject truncated listings, skip symlinks and reject unsupported file responses. Reject invalid UTF-8 and BOM-marked files instead of silently changing bytes. |
| Unbounded requests | A stalled request could leave the UI busy indefinitely. | A 30-second per-request timeout plus navigation cancellation; mutation locks release on failure. |
| Adapter assumes `content/` and root hosting | Custom content folders and deployed URL prefixes broke. | Derive the actual build content directory and distinguish production prefixes from local preview. Reject conflicting content-root overrides. |
| One spelling of Quartz's draft filter | A clean upstream installation differed from the blog fixture. | Accept the actual singular/plural filter names and require draft protection. |
| Virtual editor page treated as normal content | `/write` could enter feeds/search and acquire a fresh feed date on every build. | Mark it unlisted; omit virtual pages from the published manifest. |
| Editor assets missing or stale | Failed setup was obscure; browser could reuse an old bundle. | Preflight all required assets, hash JS/CSS URLs and ship matching files together. |
| Build/copy scripts depend on current directory | Calling a script from elsewhere could read/write the wrong paths. | Resolve project paths from the script's URL. Copy a VERSION file with the integration. |
| Source checkout is the installation artifact | Users would need the editor's build dependencies or could copy an incomplete folder. | Build a ZIP with the adapter, prebuilt JS/CSS, licenses, installation guide and version. |

Relevant implementation: [document](../packages/core/document.js),
[editor](../packages/core/editor.js), [app](../packages/core/app.js),
[configuration](../packages/core/config.js), [catalog](../packages/core/catalog.js),
[storage](../packages/core/storage.js), [GitHub](../packages/core/github.js),
[Quartz adapter](../packages/quartz/index.tsx).

## What is already a good pattern

GitHub Contents is a good fit for singular actions. It creates the file change
and commit in one request. Trees lists paths without downloading every post.
There is no need to clone Git into the browser, build an OAuth server or maintain
a second database. Uncertain mutations are reconciled by reading the same file;
there is no blind retry that creates another commit.

The deployed manifest contains published paths/titles only, not unpublished
post bodies. Comparing it with the authenticated tree avoids a request per file
just to render the index. Local known states cover deployment delay.

The distinction matters: **“Draft / unpublished” means absent from the deployed
published index**, not proof that the file says `draft: true`. Other Quartz
filters can also hide a file. On edit, the actual frontmatter determines the
checkbox. This is documented rather than disguised as certainty.

The host supplies the article layout and styling. The adapter does not copy
Pato's theme. Per-site configuration stays outside the replaceable integration
folder. Browser code uses text content and form values for post titles rather
than inserting user text as HTML; Milkdown's link mark also uses its upstream
URL sanitizer. The sandbox swaps the request/storage boundary, rather than
forking the application into a second implementation.

## What is intentionally not generalized

| Concern | Current contract | What another adapter must provide |
| --- | --- | --- |
| Content | UTF-8 `.md` files in one configured root; no BOM | Its supported document formats and scope. MDX is not CommonMark. |
| Metadata | YAML `title` and `draft`, with unknown fields preserved | Builder-specific metadata formats and visibility rules. |
| New paths | A title slug in a posts directory | Jekyll-style dated filenames, sections, index bundles or another naming convention. |
| Published visibility | Filtered Quartz build manifest | Equivalent published index that excludes private/draft content. |
| Layout | Quartz 5 page/resource lifecycle | Mount location, assets and navigation cleanup. |
| Publishing | Existing writable branch, one file per action | Protected-branch/PR workflows only if the product later needs them. |
| Preview | CommonMark rich editing or exact source | A renderer-aware preview would need actual host rendering. |

Hugo can use different frontmatter formats and page bundles; Jekyll and Astro
themes contain templates/components as well as CSS; Quartz plugins add Markdown
syntax and rendering behavior. A theme is therefore often much more than a
stylesheet. Supporting arbitrary themes means understanding their DOM and
renderer, not inventing a universal CSS importer.

The differing contracts are documented by the builders themselves:
[Hugo frontmatter](https://gohugo.io/content-management/front-matter/),
[Jekyll posts](https://jekyllrb.com/docs/posts/) and
[Astro scoped styling](https://docs.astro.build/en/guides/styling/).

Inherited fonts/colors/ordinary element rules generally follow site styling.
Selectors such as `article > p` do not reach a paragraph inside `.ProseMirror`;
component-scoped styles and syntax highlighting can also differ. The integration
guide explains the wrapper. Do not promise a pixel-identical build preview.

One mounted root, one writing tab and one writer are the supported model. Global
control IDs and simple local persistence are acceptable within that explicit
contract. Multi-tab coordination, collaborative editing, external-change
reconciliation, image uploads and batch commits remain outside the scope.

## Verification and its limits

The final automated suite has **42 passing checks**. Tests exercise metadata preservation and validation, Unicode paths,
collision rejection, UTF-8 transport, uncertain create/update/delete responses,
denied credentials, concurrent mutations, timeouts, scope/exclusions, damaged
storage, migration failures, exact-document recovery, navigation disposal and
Quartz manifest/path/privacy behavior. DOM-level application tests confirm that
recovering A does not recover B, publishing changes only A, and denied deletion
does not discard writing.

A separate clean Quartz 5 checkout at upstream commit
`97a2d05f80c4c50534959b1d0d41cc4b3895625e` was built with a `notes` content
directory, a production URL prefix and unchanged upstream components. Production
and local `--serve` editor assets/index resolved. Hidden draft titles/bodies did
not appear in emitted HTML/JSON/XML. `/write` did not enter RSS/search/sitemap.
Watch-mode changes from draft to published and back updated the manifest.

Browser checks in the token-free sandbox covered new Unicode posts, repository
draft discovery, invalid/duplicate YAML, metadata without a trailing newline,
publishing and reopening non-CommonMark syntax in protective source mode.
The sandbox uses the same built editor; its GitHub confirmations are explicitly
simulated. It does not prove a live token's permissions or a host's deployment.

The application's network-failure tests use a fake GitHub service. This audit
does not claim exhaustive Safari/Firefox/mobile accessibility coverage, a formal
security audit, or support for every Quartz plugin/theme combination. A clean
dependency install reports no known npm advisories at audit time; that is not a
guarantee about undiscovered vulnerabilities.

Release verification: source fixes were pushed as `ebca560`; its
[GitHub CI run passed](https://github.com/jj-marinho/duckposting/actions/runs/37141753276).
The matching blog integration was pushed as `e8fd065`, after pulling Pato's
latest content changes. The deployed `/write/` loaded its Content index with
asset hash `a02d691a4ad0`, matching the final local bundle. The ZIP's adapter,
assets, guide and VERSION were byte-compared with the blog's copied files.
No real post was created/deleted by these browser checks.

## Security and data expectations

A remembered PAT is readable by all scripts on its origin. A malicious theme,
third-party script or XSS can steal it. That is a trust boundary inherent in this
minimal static design, not something encryption with a key in the same browser
would solve. Use a finite-expiry fine-grained token scoped to the blog repository;
remembering is opt-in. No credentials belong in configuration, demo seeds,
screenshots or bug reports.

Draft visibility prevents website publication; it does not make committed files
private in a public GitHub repository. Local drafts remain browser-local. Storage
failure leaves writing in memory and displays a recovery warning; users should
copy it before closing. Sync confirms GitHub, while the host builds asynchronously.

See [Security](../SECURITY.md), [Support](../SUPPORT.md) and
[Troubleshooting](troubleshooting.md) for the user-facing versions of these rules.

## Distribution with the least work

The audit adds `npm run package`, producing `dist/duckposting-0.1.0.zip`.
The current minified JavaScript is 525,623 bytes (164,922 bytes gzip); CSS is
4,280 bytes. The complete ZIP is 176,079 bytes. Milkdown and its parser are a
substantial browser dependency even though the application code is small.
Extracting it yields one `duckposting/` folder. The blog needs no Milkdown npm
installation: copy the folder, add the adapter/layout configuration, build.
The copy helper produces the same installation files. Licenses ship alongside
the bundle, and VERSION makes support reports identifiable.

CI now installs from the lockfile, runs tests and creates an artifact. That is
a candidate, not a public release: workflow artifacts can expire and require
sign-in. Attach the ZIP to a versioned GitHub prerelease so users can download
the actual built integration; GitHub's automatic source archives do not contain
ignored generated assets. [GitHub releases documentation](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases).

Keep workspace packages private for now. An npm release would require deciding
which files/exports/types are a supported consumer API. Publishing a half-ready
package adds support work without simplifying the current copy-and-configure
installation. A template can help brand-new blogs later; it creates independent
history and does not itself solve upgrades.
[GitHub template documentation](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-template-repository).

An upgrade is currently replacement of the integration folder, rebuild and
redeploy, with a short changelog and preserved per-site configuration. Test
storage migration before changing its format. Do not require people to copy
individual functions or manually reconcile generated JS.

## Research: useful maintainer practices

These are observed practices, not proof that a launch channel causes success.
Some projects began with one creator and now have substantial communities;
they should not be described as permanently solo-maintained.

| Reference | Observable practice | Apply here |
| --- | --- | --- |
| [Pagefind getting started](https://pagefind.app/docs/) | A short working path, with deeper APIs separately documented. | Lead with one Quartz installation and a working example. |
| [Pico documentation](https://picocss.com/docs) | Manual distribution, examples and clear documentation. | A prebuilt folder/ZIP and usable demo beat a new installer ecosystem. |
| [Quartz documentation](https://quartz.jzhao.xyz/) | Setup, preview, deployment and customization guides. | Fit its existing workflow and support vocabulary. |
| [Eleventy's maintainer discussion of GitHub issues](https://www.11ty.dev/blog/github-issues/) | Distinguishes actionable issue reports from help conversations. | Bug template with reproduction; questions in Discussions if enabled. |
| [Pagefind security policy](https://github.com/Pagefind/pagefind/blob/main/SECURITY.md) | Names support scope and a private reporting channel. | State supported versions and provide private vulnerability reporting. |

The docs now include the happy path, configuration, supported boundaries,
upgrade/removal, troubleshooting, contribution commands, best-effort support and
security policy. These are the useful minimum. There is no need for a separate
documentation framework, Discord, elaborate governance or multiple support
inboxes before there are users.

GitHub recognizes standard community files, but adding SECURITY.md does not
enable its private vulnerability-reporting setting. Enable that repository
setting before wider launch; until then the policy describes requesting a
private channel without posting the vulnerability publicly.
[Community profiles](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/about-community-profiles-for-public-repositories),
[private reporting setup](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository).

## Recommended launch sequence

1. Host `demo/` and its built assets on a public static URL. Keep the clear local-only
   banner and reset button. A visitor must be able to try it without a PAT.
2. Give the candidate ZIP and install guide to 3–5 independent Quartz users.
   Observe installation, first publish, recovery and upgrade. Fix their actual
   friction rather than expanding the feature list.
3. Tag a Quartz 5 alpha, attach the ZIP, add a concise changelog, demo link and
   screenshot/30–60 second video. Verify a downloaded ZIP in a clean checkout.
4. Publish a personal article explaining the static design and honest limits.
   Submit it to Quartz's community Tools & Integrations directory, which accepts
   contributions. This is a closer audience than a broad generic CMS launch.
   [Quartz community](https://quartz.jzhao.xyz/community).
5. Once strangers can try it, make a Show HN submission and answer technical
   questions yourself. Its guidelines emphasize something people can use and
   discourage signup barriers or vote solicitation.
   [Show HN guidelines](https://news.ycombinator.com/showhn.html).
6. Consider broader launch sites later if they fit the audience. Product Hunt
   is optional, not a release prerequisite; even established maintainers use it
   as one channel among others. [Eleventy's launch account](https://www.11ty.dev/blog/product-hunt/).

Use GitHub Issues for reproducible bugs and a single best-effort support policy.
Enable Discussions only when there is enough question traffic to justify it.
No uptime or response-time promise is needed for a static editor maintained by
one person. Support the latest alpha and recent browsers; document regressions
and provide a way to get back to Markdown source.

## Remaining gates

- Public hosted sandbox, real downloadable prerelease and repository private
  vulnerability-reporting setting. None is created merely by building this ZIP.
- Independent installations and upgrade/recovery trials; broader browser,
  keyboard, screen-reader and narrow-screen checks before a stable claim.
- CI confirmation on the pushed commit, plus one final download-and-install of
  the release asset when actually published.
- A short versioned changelog for releases. Keep exact-build preview, additional
  builders and image publishing as separate future work.

The correct next investment is evidence that another Quartz user can install
and recover writing confidently. The code should grow only when that exercise
shows a concrete need.
