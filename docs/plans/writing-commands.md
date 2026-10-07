# Writing commands

Scope: Link page, Link URL, Image, Code block, Math block, Table block,
Bullet list and Checklist. No heading, quote or divider commands.

1. Enable Milkdown GFM for task lists and simple tables. Keep image and math
   extensions and conservative source preservation.
2. Add one vanilla slash menu using Milkdown's positioning provider. Keyboard,
   touch and the Insert button use the same command registry.
3. Reuse image/equation dialogs. Add a searchable page picker using the existing
   catalog and one URL dialog. Capture insertion ranges; cancel preserves text.
4. Insert standard Markdown fragments without replacing the whole document.
   Both rich and source mode use the same templates.
5. Paste/drop image files through the same validated upload path, sequentially.
   Do not use the demo to test uploads. Do not publish test content.
6. Verify syntax, reopen/serialization, context filtering, undo, cancellation,
   upload errors, lifecycle cleanup and phone layout. Package, integrate, build
   and push both repositories, preserving live content changes.

Implementation boundaries: no new server, framework, stored command syntax,
second content index, or Crepe migration. Uploaded files commit immediately;
post publication remains singular and separate.

## Implemented in alpha.6

The registry lives in `commands.js`, the vanilla popup in `menu.js`, and small
fragment/transfer helpers in `insert.js` and `media.js`. The editor owns dialogs;
the app supplies catalog entries and its existing validated image upload callback.
No new dependencies, index, storage format or publishing endpoint were added.

Verification: 63 automated tests pass, including native Milkdown GFM parsing,
fragment replacement/undo, portable page paths, catalog reuse and image transfer.
The packaged install/replacement gate builds Quartz with a site prefix and checks
links, checkboxes, tables, math, assets and draft filtering. The blog builds too.
Browser checks cover fast Enter, list continuation/exit, table navigation, source
insertion, dialog cancellation, light/dark themes and a 390px viewport. Clipboard
paste and simulated drops/uploads run in an isolated local fixture; no real files
were uploaded and no test posts were published.

Tables start at two columns with two body rows. Use source to change their size.
Source-mode image drops insert at the text selection rather than pointer position.
Draft page links work publicly after those pages are published. These helpers
write Markdown, so the host still determines the final rendering.
