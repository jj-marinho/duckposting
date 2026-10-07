---
title: Safety and support
---


Duckposting is early alpha. Keep important unfinished writing somewhere you can recover independently, particularly before upgrading or clearing browser storage.

## Common problems

**Publish is disabled.** Enter valid frontmatter, a title and body, connect GitHub, and wait for any pending operation. A token grants GitHub access; an empty writing page alone does not.

**GitHub denies the save.** Check the repository and branch, PAT repository access and Contents read/write permission, and whether direct commits are allowed. An organization may require token approval.

**The site has not changed.** Publish confirms GitHub, not deployment. Check your host’s build for the configured branch. The latest public index may still reflect the previous build.

**An existing file opens in Markdown.** Its rich-editor roundtrip would change the source. Keep source mode for custom Markdown, Liquid, and unsupported extensions.

**A rendered image or equation differs from the editor.** The site renderer has its own settings. Enable the matching math/GFM plugins and check the adapter’s public image directory/base URL.

## Credentials and drafts

Remembering a PAT trusts all scripts on the site’s origin. Shared origins also share browser storage. Forget removes the saved token; revoke it in GitHub if the device or origin is compromised.

Repository drafts and uploaded images are not private in a public repo. Local drafts exist only on the current browser/origin and can disappear when browser data is cleared.

## Get help

[Open an issue](https://github.com/jj-marinho/duckposting/issues) with the duckposting version, builder version, browser, reproduction steps, and a small sanitized Markdown example. Do not include a token, private writing, or a storage export.

[Support policy](https://github.com/jj-marinho/duckposting/blob/main/SUPPORT.md) · [Security policy](https://github.com/jj-marinho/duckposting/blob/main/SECURITY.md)
