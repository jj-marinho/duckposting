# Security

Supported version: the current alpha candidate on main. Versioned support policy
will follow the first public release. Do not deploy an unreviewed bundle from an
untrusted source; editor code can read the PAT entered on its origin.

The static page does not grant GitHub permission. Use a fine-grained token for
one repository with Contents read/write and a finite expiry. Remembering it in
localStorage is opt-in and trusts every script on the same origin. No browser
storage encryption can isolate a token from those scripts.

Never include tokens or private posts in public issues. For vulnerabilities,
use GitHub's private vulnerability report button if it is enabled. If absent,
open a public issue requesting a private reporting channel without including
exploit details or secrets. A SECURITY.md file does not enable private reporting;
the maintainer must enable it in repository settings before the public launch.

Report ordinary credential errors through support with secrets removed. If a
PAT was exposed, revoke it through GitHub and create a replacement.
