---
title: duckposting
description: A small browser CMS for your Markdown blog, using one GitHub PAT.
---

I created this because I wanted to write on my phone without paying for an actual CMS. My brain really hates friction, so hopefully this makes me write more!

Hey, this is a small CMS that runs in your browser with a single GitHub PAT. Add `/write` to your blog, write, and Publish. It saves Markdown to your repo, and your usual site build takes it from there.

This page is the editor. Click into the text and try it. Publishing here only saves in this browser.

## Here's what you can do

### Write

* Bullet lists
* **Bold**, *italics*, and ~~strikethrough~~
* Numbered lists, headings, and quotes
* Plain Markdown whenever you want: use the switch below

1. Open your blog on your phone.
2. Write something.
3. Publish.

> The point is to get the words down.

### Check things off

* [x] Build a small editor
* [ ] Write more often
* [ ] Finish that half-written post

Click a checkbox to change it. To start a checklist, type `- [ ] ` with a space at the end.

### Make tables

| Thing        | Where it lives                  |
| ------------ | ------------------------------- |
| Your writing | Markdown files                  |
| Your posts   | Your GitHub repo                |
| Your drafts  | This browser, until you publish |

Click into a table to add or remove rows and columns with its buttons.

### Add code

```javascript
const idea = "just write";
console.log(idea);
```

Choose a language from the block's menu. Your site handles syntax highlighting after publication.

### Write equations

Inline LaTeX: $E = mc^2$.

Or a whole block:

$$
a^2 + b^2 = c^2
$$

Click an equation to edit it. Your blog needs math rendering enabled to show it after publication.

### Add images and links

Type `/` or tap **Insert /** for six helpers: **Link page**, **Link URL**, **Image**, **Code block**, **Math block**, and **Table block**.

Link page lets you search your blog's pages instead of remembering their URLs. Link URL works for web links and email addresses.

Images can come from a URL, a file picker, clipboard paste, or a file drop. Uploads accept PNG, JPEG, GIF, WebP, and AVIF. On your blog, an upload saves the image to GitHub immediately; publishing the post is a separate step.

### Manage your posts

**All content** opens the page list: create, edit, or delete one post at a time. Local drafts sit at the top, ready to resume or discard. They're saved as you type, with one local draft per existing post.

Use **Draft** to keep a committed post out of the blog. Change the title and date directly; extra frontmatter lives under **Post settings**.

The version selector below shows your local draft and the post's GitHub commits. Browse an older version without losing your writing, then restore it if you want.

Clearing website data removes local drafts and a remembered PAT. Anything committed to GitHub stays there.

## Put it on your blog

The editor uses your site's styling. Pick your builder for its setup guide:

* [Astro](/duckposting/docs/astro)
* [Quartz 5](/duckposting/docs/quartz)
* [Jekyll](/duckposting/docs/jekyll)

Use a fine-grained GitHub PAT limited to your blog repo, with **Contents: read and write**. Keep it in the editor's connection settings, never in your code.

This is still an alpha, and it isn't on npm yet. The guides explain how to install the package from source for now.

[Source code](https://github.com/jj-marinho/duckposting) · [Docs](/duckposting/docs/) · [Issues](https://github.com/jj-marinho/duckposting/issues)
