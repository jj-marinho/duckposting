---
title: duckposting
description: A small Markdown editor for the blog you already own. Static hosting, GitHub commits, and your own site style.
---

# Your blog. Your words. One Publish.

A small editor for the blog you already own. Open `/write`, write something, and publish it to GitHub. Your existing site builder does the rest.

**[Try the editor](https://jj-marinho.github.io/duckposting/)** · **[Get started](docs/index.md)**

## Writing comes first

Your title, date, and words. A rich Markdown editor that picks up your blog’s typography. Settings stay below the writing, and the underlying file is always ordinary Markdown.

Link another page, add an image, write an equation, or insert a code block. A small `/` menu helps when you need it. Switch to Markdown whenever you want.

## Static all the way through

No application server. No editor account. No browser extension. GitHub stores your posts; your existing hosting builds the blog. A personal access token lets your browser commit one file at a time.

Local drafts keep unfinished writing on your device. Committed drafts follow your builder’s visibility rules. Each Publish changes one post.

## Fits your existing site

| Builder | How it fits |
| --- | --- |
| [Quartz 5](docs/quartz.md) | Adds the writing route, shares your layout, and builds the published index. |
| [Astro](docs/astro.md) | A small integration and component inside your own layout, with routes supplied by your site. |
| [Jekyll](docs/jekyll.md) | Generates a static writing page and Liquid index, without a Ruby plugin. |

**Early alpha.** Quartz is used on [jarochin.ski](https://jarochin.ski). Astro and Jekyll are new integrations with build fixtures, rather than a promise to support every theme or Markdown extension.

## Built with itself

The [homepage](https://jj-marinho.github.io/duckposting/) is the editor itself, with a pretend repository so you can try writing safely. `/write/` opens the same sandbox. Quartz renders the Markdown docs.

One open source project. One npm package being prepared for release. No paid tiers, no content lock-in.

[Read the docs](docs/index.md) · [Explore the source](https://github.com/jj-marinho/duckposting) · [Report an issue](https://github.com/jj-marinho/duckposting/issues)
