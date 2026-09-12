# Security policy

## Reporting a vulnerability

Please report security issues privately through GitHub's **Security → Report a vulnerability** flow for this repository. Do not open a public issue containing exploit details, private data, or credentials.

Include the affected version, operating system, reproduction steps, expected impact, and any suggested mitigation. Please remove account tokens and personal note content from logs or screenshots.

## Security model

XREAL WIN HUB uses a sandboxed, context-isolated Electron renderer without Node integration. Privileged actions use an allowlisted preload bridge; HTTP(S) destinations and display identifiers are validated in the main process. The app intentionally stores no account passwords or API keys.

The project does not currently ship signed binaries. Build from source or inspect release provenance until code signing is configured.
