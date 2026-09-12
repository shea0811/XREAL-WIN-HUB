# Contributing

## Development flow

1. Install Node.js 22.12 or newer.
2. Run `npm ci`.
3. Create a focused branch.
4. Run `npm run check` before opening a pull request.
5. For native changes, also exercise `npm run package:win` on Windows.

Keep renderer code free of Node.js APIs. Add privileged behavior through a purpose-specific preload method and validate every argument again in the Electron main process.

Do not label a hardware feature supported from inference alone. Link the official XREAL capability documentation or SDK contract and include a reproducible device/firmware test note.
