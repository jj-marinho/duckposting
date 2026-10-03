# Troubleshooting

| Symptom | Check |
| --- | --- |
| Publish is disabled | Title, body and token are required. Invalid or unclosed YAML must be fixed. The editor must finish loading. |
| GitHub says 401/403/404 | Token expiry, selected repository, Contents read/write permission, repository name and branch. GitHub may return 404 for inaccessible private repositories. Local writing stays saved. |
| Branch rejects a commit | Use an existing branch that allows direct commits. Protected-branch and pull-request workflows are not implemented. |
| Filename already exists | Edit that document, or change the new post's title. Creating never overwrites an existing file. |
| Publish is not confirmed | Writing remains local. Retry; uncertain responses are checked against the same file. Don't assume the website is deployed until its build finishes. |
| Draft appears on the website | Ensure Quartz's RemoveDraft filter is enabled. The supported adapter refuses setup without it. |
| File says Draft / unpublished | It is absent from the deployed published index. This does not prove its frontmatter contains `draft: true`. Initial draft titles come from filenames. |
| Editing opens Markdown | A rich-editor roundtrip would change the source. Source preserves it; choosing Rich explicitly opts into conversion on editing. Some harmless formatting differences also trigger this. |
| Local recovery warning | Browser storage may be blocked, full or damaged. Copy the source before closing. Damaged draft data is retained under the scoped `drafts:recovery` key when storage permits. |
| Draft missing on another device | Local recovery belongs to this browser/origin. Publish with Draft checked to save it in the repository. |
| Styling differs from the blog | The rich editor adds `.ProseMirror`. Extend wrapper-sensitive selectors such as `article > p` to `article .ProseMirror > p`. Scoped/theme component rules may need their own adjustment. |
| New JavaScript does not appear | Rebuild and deploy the site. The Quartz adapter hashes asset URLs; a reload should select the new bundle. |
| Editor paths fail under a URL prefix | Use the supported Quartz adapter; it distinguishes production baseUrl paths from local `--serve`. Keep content paths repository-relative. |
| Very large post won't load | GitHub's inline Contents response is limited. Files returning non-base64 content are rejected rather than silently loaded empty. |
| Encoded-data / byte order mark error | Save the file as valid UTF-8 without a BOM. Unsupported encoding is rejected instead of changing bytes silently. |

Use the Markdown source and copy it as a backup when diagnosing an editor issue.
Remembered credentials are independent from drafts; Forget removes only the token.
