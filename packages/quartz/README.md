# duckposting-quartz

A small Quartz **5** integration. Quartz 4 is not supported.

This folder contains a copy of duckposting's browser bundle and Quartz adapter.
The source is maintained in the duckposting repository; regenerate this copy
with `npm run build` followed by `node copy-to-blog.mjs /path/to/blog` there.
No npm publishing or new dependency in the blog is needed.

In the blog's `quartz.ts`, after loading its configuration:

```ts
import { duckpostingQuartz } from "./duckposting/index"

duckpostingQuartz(config, { repository: "your-name/your-blog" })
```

In `quartz.config.yaml`, add a page layout alongside the existing page types:

```yaml
layout:
  byPageType:
    duckposting:
      template: full-width
      positions:
        beforeBody: []
        afterBody: []
        left: []
        right: []
```

Use your normal content frame instead of `full-width` if desired. The header,
footer, fonts, colours and article styles come from the blog. The adapter
creates `write/index.html` and copies `editor.js` and `editor.css` into the
build output. The browser bundle loads only on the writing page, and is served
from the blog itself. No external CDN hosts editor code.

Options: `repository`, `branch` (main), `contentDir` (content/posts), `template`.
The default template contains title, today's date and `draft: false`.
The third function argument changes the source assets directory (duckposting).

Styles using `article p` apply naturally. Styles using `article > p` need the
additional selector `article .ProseMirror > p`, since rich editors introduce
wrappers. Likewise for headings. These are site CSS adjustments, not a second
theme or styles automatically inferred by duckposting.

The integration handles Quartz SPA navigation and destroys the previous editor.
Ordinary Markdown posts are supported; Quartz-specific embeds, wikilinks and
callouts are not rich-editor features. Use the Markdown source mode for these.
