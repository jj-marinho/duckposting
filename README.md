# duckposting

**Open `/write`, write like you're reading your blog, Sync.**

A static, browser-based Markdown editor. Milkdown handles rich editing;
GitHub's Contents API creates the post; your existing site builder publishes it.
No application server, browser Git clone, or browser site build.

## The small architecture

- **duckposting-core:** editor, title/frontmatter, local drafts, PAT connection,
  and publishing. The host supplies one DOM root and repository configuration.
- **duckposting-quartz:** generates `/write` using Quartz 5's layout and styles,
  includes the compiled core assets, and handles SPA navigation.

One repository, two packages. No packages are published to npm yet. Built assets
are copied into the blog while we develop; implementation stays here.
See [Quartz setup](packages/quartz/README.md).

## Develop

Requires Node.js 22+.

```sh
npm ci
npm test
npm run build
python3 -m http.server 8000
```

Open `http://localhost:8000/write/` for the standalone editor. Edit the small
configuration in `write/index.html` before publishing from this example.
To update a Quartz blog's copied assets:

```sh
node copy-to-blog.mjs /path/to/blog
```

Then build the blog normally. The blog needs no additional Milkdown dependencies.
The root directory's historical name (`duckblog`) doesn't affect the project.

## Integrate another builder

Build core once and serve `dist/editor.js` and `dist/editor.css` with your site.
Use your article layout and a mount point:

```js
import { mountDuckposting } from "/duckposting/editor.js";

const destroy = await mountDuckposting(articleRoot, {
  repository: "your-name/your-blog",
  branch: "main",
  contentDir: "content/posts",
  template: '---\ntitle: ""\ndate: {{date}}\ndraft: false\n---\n\n',
});
```

Core supplies an editable title, an article body, formatting buttons, and small
controls inside that root. Call `destroy()` when removing it during client-side
navigation. Host article styling supplies typography; core CSS styles controls
and editor mechanics. No Shadow DOM or copying an entire theme.

This is a generic browser interface, not a claim that every builder is already
supported. Jekyll's dated filenames, for example, need an integration change.
Astro, Hugo and Jekyll integrations are future work. Avoid generalising the API
until a second integration actually needs it.

## Writing and syncing

Type in the rich editor, use familiar Markdown typing and keyboard commands.
**Markdown** switches to the full source textarea; the mode toggle stays in
the same position. The GitHub icon beside **Sync** opens connection settings.
Sync stays disabled until the editor is ready and the post has a valid title,
body content and a token. **Post settings** exposes
frontmatter; unknown metadata fields remain alongside title/date/draft.
Code blocks have a trailing paragraph: **Enter** adds a code line;
**⌘/Ctrl+Enter** continues in a paragraph below. **Down Arrow** from the last
code line also reaches the paragraph below.

The title supplies a lowercase ASCII filename: `João’s ideas!` becomes
`joaos-ideas.md`. Title edits update frontmatter, not a heading in the body.
Only `{{date}}` is substituted in new templates.

Rich editing supports CommonMark: paragraphs, headings, emphasis, lists, links,
quotes, code and linked images. There is no image uploading, post list, editing
of existing files or deletion yet. Rich serialization can normalize Markdown
formatting. Builder-specific syntax should be written in source mode rather
than round-tripped through the rich editor. This is a writing experience, not
an exact preview of custom renderer plugins or components.

Drafts save on each editor change and restore on return. Existing Duck drafts
and remembered tokens retain the same browser storage keys. One active draft
per repository/branch/content directory; use one writing tab at a time.

Sync creates a **new** file with no `sha`, so it cannot overwrite another post.
Repeated clicks are guarded. On an uncertain response, it reads the same file
and compares its content before considering the save successful. Errors preserve
writing. Confirmed success clears the saved draft and starts a new post.
Cloudflare deployment follows asynchronously; Sync confirms the GitHub commit.

## Connect GitHub

Use an existing repository and branch permitting direct commits. Connect your
static hosting provider to that branch. Create a fine-grained PAT for only that
repository, with **Contents: read and write**, and enter it in GitHub connection.
**Remember on this device** is opt-in; **Forget** removes credentials, not writing.
GitHub.com is the supported API host.

Anyone can open `/write` and type locally. GitHub checks permission to commit.
Tokens belong only in browser storage, never source or config. Remembering a
PAT assumes scripts on the site's origin are trusted. Serve the pinned editor
bundle from your own site, as the Quartz integration does.

## Checks and contributions

`npm test` checks title/frontmatter preservation, UTF-8 publishing, collisions,
credential storage, draft recovery, denied requests, uncertain responses and
repeated clicks. GitHub is simulated; tests do not publish posts.

Keep changes small. Add an integration by mounting the same core, rather than
forking it. Tests should protect writing and publishing behaviour, not mirror
markup. Minimal code and a fast writing flow matter more than feature count.

MIT licensed. Milkdown and its dependencies retain their own licenses in the
installed packages; the build includes their full licenses in `THIRD_PARTY_LICENSES.txt`.
# duckposting
