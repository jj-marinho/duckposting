---
title: Getting started
---


Duckposting adds `/write` to a Markdown site stored in GitHub. You keep your renderer, your theme, and your hosting. The editor creates, edits, and deletes individual Markdown files through GitHub’s browser-friendly REST API.

## Choose your builder

- **[Quartz 5](quartz.md)** — register the adapter and add a layout entry.
- **[Astro](astro.md)** — add the integration and put its component in your own `/write` page.
- **[Jekyll](jekyll.md)** — run the setup helper; commit its generated static files.

The package is called **duckposting**. It has not been published to npm yet. During alpha testing, clone [the source](https://github.com/jj-marinho/duckposting), run `npm ci` and `npm run package`, and install the resulting `.tgz` in your blog. This uses normal npm installation; the temporary archive step disappears after [registry release](release.md).

## Connect GitHub

Your repository needs an existing branch that accepts direct commits. Configure the same branch that your hosting builds.

Create a **fine-grained personal access token**, limited to that repository, with **Contents: read and write**. Open `/write`, select the GitHub icon, paste it, and Connect. Remember on this device is optional; Forget removes the stored token without removing drafts.

Anyone can open the writing page. Only an authorized GitHub token can commit. Your token stays in the browser: never put it in site configuration or Markdown.

## Write and publish

Choose **+ New Post**, write a title and body, then **Publish**. The first title determines the filename; later title edits keep the existing path. GitHub confirms the save immediately. Hosting updates the public site after its next build.

Choose **Edit** to change existing content. Duckposting offers unfinished local changes for that exact file before opening it. New Post also offers local new-post drafts and committed unpublished posts. **Delete** asks for confirmation.

[Writing, images, and equations](writing.md) · [How the pieces fit](architecture.md) · [Safety and troubleshooting](support.md)
