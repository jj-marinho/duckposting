---
title: Writing
---


The editor puts the title, date, and body first. Navigation, Publish, draft status, and settings live below the writing. The title and date stay synchronized with frontmatter. Expand **Post settings** when you need to edit the YAML directly.

## A small insert menu

Type `/` in a paragraph, or tap **Insert /**. Filter the menu, press Enter, and finish the small dialog when needed.

| Command | What it inserts |
| --- | --- |
| Link page | A link chosen from the site’s content index. |
| Link URL | A normal web or email link. |
| Image | An image URL or an uploaded raster image. |
| Code block | A fenced block, with a language picker. |
| Math block | A displayed LaTeX equation. |
| Table block | A small table with row and column controls. |

Table buttons add or remove the last column and body row. The header, one body row, and one column remain. Undo restores removals. Code language is saved in the fence; the site renderer handles published syntax highlighting.

## Images

Use `![description](https://example.com/photo.jpg)`, the image dialog, clipboard paste, or file drop. Uploads support PNG, JPEG, GIF, WebP, and AVIF, up to 10 MB. GitHub must be connected to upload.

Image files commit immediately, separately from publishing the post. They may be publicly reachable while a post is a draft. Removing a post or discarding local writing does not remove uploaded files.

Adapters map repository paths to public image URLs. Astro images live in `public/` by default; Quartz images stay under the content root; Jekyll images are static assets.

## Equations

Write inline math as `$E = mc^2$`, or put a block between `$$` lines:

```text
$$
a^2 + b^2 = c^2
$$
```

Click a rendered equation to edit its source. The editor uses KaTeX. Your site needs its own math renderer to show equations after publication.

## Lists and Markdown

Normal Markdown lists work. Type `- [ ] ` or `- [x] `, including the final space, for a checklist; click the checkbox to change it. Enter continues a list, and Enter on an empty item exits it.

Use **Markdown** for direct source editing. Existing documents open in source mode if rich serialization would alter them. Choosing Rich allows conversion after an edit. Wikilinks, Liquid, MDX, custom embeds, and other renderer-specific syntax belong in source mode.

## Drafts

Local recovery stays in one browser and origin. Repository drafts are files committed with your builder’s draft setting. “Draft / unpublished” in the index means absent from the latest deployed published index; it does not prove a particular frontmatter value.

A public GitHub repository exposes committed drafts through GitHub even when the site hides them. Publish changes one document at a time.
