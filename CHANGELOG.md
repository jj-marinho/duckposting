# Changelog

## 0.1.0-alpha.5 — unpublished

- Fix reopening standard Markdown images without an optional title. Milkdown
  rejected null titles and silently removed image nodes from the rich preview.

## 0.1.0-alpha.4 — unpublished

- Inline and block LaTeX preview, with click-to-edit equations.
- Image URLs and raster file uploads with immediate repository preview.
- Binary uploads reconcile uncertain responses; existing files cannot be overwritten.
- Quartz asset mapping and bundled KaTeX fonts work with site URL prefixes.

## 0.1.0-alpha.3 — unpublished

- Writing comes first: title, editable date and body above the control panel.
- All content sits on the left; Publish and GitHub sit together on the right.
- Frontmatter is collapsed under Post settings; draft and Markdown controls
  move below the text. The writing column uses a restrained reading width.
- Date edits update frontmatter while preserving unrelated settings and body.

## 0.1.0-alpha.2 — unpublished

- One npm package and import: `import { duckposting } from "duckposting"`.
- Prebuilt editor assets and typed Quartz entry ship together. Assets resolve
  beside the installed module, independent of the build working directory.
- npm pack replaces the ZIP/copy scripts; the blog uses a pinned local archive
  while testing. No registry publication.
- Existing editor behavior, document paths and browser storage stay unchanged.

## 0.1.0-alpha.1 — 2026-10-03

First public alpha, supporting Quartz 5. Copy the prebuilt integration folder;
no editor npm dependencies are required in the blog.

- Content index, new posts, exact-document local recovery, singular Publish and
  confirmed Delete. Repository drafts remain hidden by Quartz's draft filter.
- CommonMark rich editor with exact-source fallback, synchronized title/YAML
  settings, Unicode filenames and opt-in remembered GitHub credentials.
- Validated metadata, scoped GitHub operations, request cancellation/timeouts,
  uncertain-response reconciliation and recoverable storage migration.
- Custom Quartz content directories, ignore patterns and deployed URL prefixes.
- Token-free static sandbox, installation/support/security guides and CI.
- Accessible dialog names, safe cancellation and keyboard focus restoration.
  Escape dismisses recovery without choosing the repository version.
- Ordinary Markdown stays rich when only outer blank lines differ; custom
  syntax and meaningful whitespace differences still receive source protection.

Alpha limits: one writer/tab, recent browsers, GitHub.com and a branch allowing
direct commits. No image upload, batch publishing, pull-request workflow or
exact renderer preview. Other static builders and Quartz 4 are not supported.

Opening existing Markdown defaults to source if rich serialization would change
it. Explicitly selecting Rich allows conversion when editing. Back up important
local drafts before upgrades; replacing the integration folder preserves site
configuration outside it and existing browser storage keys.
