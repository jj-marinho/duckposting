---
title: Architecture
---


Duckposting keeps the browser application separate from the site builder. Adapters supply the details that actually vary: the writing page’s layout, published routes, visibility rules, and static image paths.

```text
/write → browser editor → GitHub commit → site build → public page
```

## Core

The core owns the content list, document metadata, local recovery, Milkdown rich editing, image dialogs, and GitHub requests. GitHub’s Contents API creates or updates one file per commit. Its tree API lists paths without downloading every post body. Lost responses are reconciled against the saved file before another commit.

Credentials are entered locally. Remembering stores the PAT in localStorage; all scripts on the same origin can access that storage. Only host trusted scripts alongside the editor.

## Adapters

Quartz uses its existing page/resource pipeline and filtered content to produce the public index. Astro uses your layout and explicit published route entries; the editor does not infer routes from a collection name. Jekyll uses Liquid to emit its final post URLs and published index, avoiding a custom Ruby plugin.

The generic options cover Markdown filenames, a boolean visibility field, and a separate public image directory. They do not attempt to implement a second site builder in the browser.

## Boundaries

One writer, one writing tab, and one document per action. No real-time collaboration, batch publishing, PR workflow, or exact build preview. The rich editor supports CommonMark, GFM, and math. Each host remains responsible for rendering those features, filtering drafts, and deployment.

Themes often include layouts and components as well as CSS. Duckposting inherits styles where it is mounted, but highly specific selectors may need a small adjustment for `.ProseMirror`. It does not copy or rewrite arbitrary theme CSS.

[Source](https://github.com/jj-marinho/duckposting) · [Contribution guide](https://github.com/jj-marinho/duckposting/blob/main/CONTRIBUTING.md)
