# Security

Supported version: the latest alpha release.
Do not deploy an unreviewed bundle from an
untrusted source; editor code can read the PAT entered on its origin.

The static page does not grant GitHub permission. Use a fine-grained token for
one repository with Contents read/write and a finite expiry. Remembering it in
localStorage is opt-in and trusts every script on the same origin. No browser
storage encryption can isolate a token from those scripts.

Never include tokens or private posts in public issues. For vulnerabilities,
use [Report a vulnerability](https://github.com/jj-marinho/duckposting/security/advisories/new).
Private vulnerability reporting is enabled for this repository. Include a
reproduction, affected version and impact without using live credentials.

Report ordinary credential errors through support with secrets removed. If a
PAT was exposed, revoke it through GitHub and create a replacement.
