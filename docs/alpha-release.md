# Public alpha: 0.1.0-alpha.1

The release turns the audit candidate into a usable distribution for Quartz 5:
[try the sandbox](https://jj-marinho.github.io/duckposting/),
[download the integration](https://github.com/jj-marinho/duckposting/releases/tag/v0.1.0-alpha.1),
then follow its included installation guide.

The sandbox is on GitHub Pages, separate from the blog origin. It uses the same
editor with a pretend repository. Publish, Delete and recovery operate locally;
there is no login, real token or GitHub write. A reset button starts over.
The demo workflow tests/builds before deploying and only publishes `demo/`.

The archive contains one `duckposting/` folder: adapter, prebuilt browser assets,
third-party licenses, MIT license, README, VERSION and changelog. Consumers do
not install the editor's npm dependencies. Site-specific options stay in Quartz's
configuration, outside the folder replaced on upgrade. Workspace packages remain
private, and no npm release is needed.

## Changes after the audit

Keyboard checks exposed a real recovery-dialog defect: Escape was interpreted as
“use repository version.” Cancellation now has its own outcome; it preserves
local writing and returns to the index. Closing or disposing the editor also
resolves pending choices safely. Dialogs have accessible names; deletion starts
with Cancel focused. Opening and switching editors focus the writing field,
while returning to the index focuses New Post.

The roundtrip guard was also too conservative about leading blank lines after
frontmatter. It now ignores outer newlines only when comparing. Opening a post
still leaves stored Markdown untouched. CommonMark paragraphs open rich;
wikilinks/callouts and meaningful internal whitespace differences remain
protected by source mode.

Private vulnerability reporting is enabled on GitHub, and the security policy
links directly to that channel. The alpha includes a changelog and a named
support scope: Quartz 5, GitHub.com, recent browsers and one writer/tab.

## Evidence

- 46 automated checks cover document preservation, GitHub operations, local
  recovery, navigation and dialog cancellation. No tests publish real posts.
- The actual ZIP was extracted into an independent upstream Quartz 5 checkout.
  Installation and replacing the integration folder both build successfully;
  the host's TypeScript/YAML configuration remains unchanged on replacement.
- That fixture uses `notes` and a production `/garden` URL prefix. Generated
  assets match archive bytes; draft titles/text remain out of the published
  index, and `/write` remains out of RSS, search and sitemap.
- Native browser checks cover default cancellation focus, Escape, restored
  control focus, new-post typing, source fallback and ordinary rich editing.
- At a 390px viewport, the sandbox index and editor do not overflow horizontally.
  This is a narrow-screen smoke check, not a claim of full device coverage.

## What remains before a stable release

Independent people should install, publish, recover and upgrade using only the
public docs. The clean fixture proves portability, but it cannot prove that an
unfamiliar person understands the workflow. Seek 3–5 Quartz users and address
their actual friction before adding other builders.

Safari/Firefox, real mobile input and screen-reader testing remain unverified.
The static PAT trust boundary and renderer differences documented in the audit
still apply. This alpha does not promise collaborative editing, arbitrary theme
compatibility, image upload, pull requests or exact build preview.

The next communication can be one short personal article/demo and a Quartz
community listing. External announcements and user recruitment are separate
from shipping these release assets; no outreach is performed by this release.
