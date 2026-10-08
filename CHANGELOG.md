# Changelog

## 0.1.0-alpha.13 — unpublished

- Add a centered post-version selector: one local draft per document, followed
  by paginated GitHub commits with messages and timestamps.
- Preview older commits without changing the draft; restore explicitly to the
  working copy and Publish as a new commit using the current file revision.
- Offer Discard draft & edit in exact-document recovery. Failed repository reads
  keep the draft. Add browser-storage and repository-scoped PAT reminders.
- Show local drafts above repository pages with a faint Local draft label and
  confirmed discard action. New Post starts fresh without a recovery picker.
- Keep the sandbox history local, using the same API-shaped flow.

## 0.1.0-alpha.12 — unpublished

- Open the GitHub Pages homepage directly in the sandbox's editable introduction;
  `/write/` and `/demo/` share the same safe browser-only repository.
- Complete the sandbox's light and dark palettes, including text, links and Publish.
- Let browser mounts opt into `initialPath`, preserving exact-document recovery.

## 0.1.0-alpha.11 — unpublished

- Build the GitHub Pages project site with Quartz and its own duckposting `/write`;
  keep the token-free sandbox under `/demo/` and editable guides under `site/content`.
- Add static Astro integration/component and plugin-free Jekyll setup helper,
  each with a real packed-install build fixture. Keep one root package.
- Share explicit published URLs, boolean draft field configuration, dated
  filenames and separate static image roots across adapters.
- Make builder peers optional and document the npm release path without publishing.

## 0.1.0-alpha.10 — unpublished

- Place + Column / − Column beside each table and + Row / − Row underneath.
- Remove the last column or body row with native table operations and one-step
  undo. Retain the header, one body row and one column; disable removal at these
  limits, including after publishing/uploads finish.

## 0.1.0-alpha.9 — unpublished

- Choose a language above each code block. The selection saves as the normal
  Markdown fence language; published highlighting stays with the site renderer.
- Imported language names and aliases remain intact. Changing a language keeps
  the code, cursor, other blocks and undo; pickers pause during uploads/publishing.

## 0.1.0-alpha.8 — unpublished

- Remove Bullet list and Checklist from the insert/slash menu. Markdown list
  input and existing task checkboxes continue to work.

## 0.1.0-alpha.7 — unpublished

- Click + Row or + Column beneath any rich-editor table to grow it at the bottom
  or right. Focus moves into the new cell, ready to type.
- Native table operations retain existing text, column alignment and undo.
  Controls act on their own table and are disabled during publishing/uploads.

## 0.1.0-alpha.6 — unpublished

- A small slash menu for page/URL links, images, code, equations, tables,
  bullets and checklists. The Insert button opens the same menu on phones.
- Search pages from the existing content catalog, retaining complete Markdown
  paths. Commands insert fragments at the cursor in rich and source modes.
- Native GFM tables and task lists, including clickable checkboxes.
- Paste/drop raster images through the existing upload path. Ordinary text
  paste and internal editor dragging retain their native behavior.
- Fast Enter uses the latest command range; block insertion keeps undo and
  cursor placement. Cancelling a wizard preserves the original writing.

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
