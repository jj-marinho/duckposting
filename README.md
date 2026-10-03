# Duck

A static Markdown editor: **open `/write`, write, Sync**.

The editor is one self-contained HTML file. It uses browser APIs and GitHub's
REST API, with no dependencies or application server.

## Setup

1. Copy `write/index.html` into your blog's static/public directory, keeping the
   `write/index.html` path. For example, Astro uses `public/write/index.html`.
2. Edit the `config` object near the top of its script:

   ```js
   const config = {
     repository: "your-name/your-blog",
     branch: "main",
     contentDir: "content/posts",
     template: "---\ntitle: \"\"\ndate: {{date}}\n---\n\n",
   };
   ```

   Use the Markdown directory your blog already builds. `contentDir: ""` writes
   to the repository root. Duck only creates new `.md` files.
3. Connect Cloudflare Pages to that repository and branch. The build must include
   the editor in its output. Visit `https://your-blog.example/write/`.
4. Create a fine-grained GitHub PAT for **only this repository**, with
   **Contents: read and write**. Enter it under **GitHub connection**.

The repository needs an existing branch that allows direct commits. GitHub
checks permission to write; anyone can open the editor and type locally.
GitHub.com is the supported API host.

## Writing

The frontmatter `title:` supplies the filename. For example,
`title: "João’s ideas!"` creates `joaos-ideas.md`. Duck removes accents and apostrophes,
replaces other punctuation and whitespace with hyphens, and keeps lowercase
ASCII letters and numbers. The written Markdown stays unchanged.

Use a single-line title in a frontmatter block at the beginning of the file:

```md
---
title: "João’s ideas!"
date: 2026-10-03
---

Start writing here.
```

Plain titles, single-quoted titles, and JSON-style double-quoted titles are
supported. Multiline titles and YAML aliases are outside V0. Double quotes are
recommended, particularly when a title contains a colon or a hash.

Set `template` to the raw Markdown your blog expects, including its frontmatter.
Duck replaces `{{date}}` with the browser's local `YYYY-MM-DD` date when starting
a post. It reads only the title for the filename and uploads all metadata and
body text unchanged.

Drafts save locally while typing and return after reload. V0 keeps one active
draft per repository/branch/content directory in a browser; use one writing tab
at a time. If local saving is blocked, Duck shows a notice.

**Sync** creates one file and one commit using GitHub's Contents API. Existing
files are never overwritten. If a response is lost, Duck reads the same file:
matching content counts as saved, and different content asks you to change the
frontmatter title. Failed requests keep the draft. Confirmed success resets the editor.

Saved to GitHub means the commit is saved. Cloudflare builds and deploys
afterward; Duck does not track deployment status. The existing blog renderer
remains responsible for building the Markdown into pages.

**Remember on this device** stores the PAT in `localStorage`. **Forget** removes
the PAT without deleting your draft. Never put the PAT in the HTML or repository.
Browser storage is shared by scripts on the blog's origin, so remember credentials
only on a trusted blog and device.

## Check locally

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/write/`. Local storage belongs to this origin and will
not carry over to your deployed domain.

With Node.js installed, run `node --test test.mjs` for dependency-free checks of
publishing, collisions, credentials, recovery, and repeated clicks. GitHub
responses are simulated; these tests do not publish anything.

## Roadmap

- **V0:** new Markdown posts, templates, remembered PAT, draft recovery, Sync.
- **V1:** post list, editing, deletion, images, visibility metadata, and atomic
  commits for related changes using the Git Data API.
- **V2:** a rich editor that uses the blog's CSS; site preview/build approach TBD.
- **V3:** custom CSS support.
