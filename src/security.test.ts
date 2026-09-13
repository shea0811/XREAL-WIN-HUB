import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

async function source(relativePath: string) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

describe('security invariants', () => {
  it('routes all renderer IPC through the trusted rate-limited registrar', async () => {
    const main = await source('electron/main.cjs');
    expect(main.match(/ipcMain\.handle\(/g)).toHaveLength(1);
    expect(main).toContain('function registerTrustedHandler');
    expect(main).toContain("recordSecurityEvent(channel, 'blocked', 'untrusted-sender')");
    expect(main).toContain('enforceIpcRate(channel)');
  });

  it('keeps provider scripts out of the privileged renderer', async () => {
    const html = await source('index.html');
    const players = await source('src/components/MediaPlayers.tsx');
    expect(html).toContain("script-src 'self'");
    expect(html).toContain("object-src 'none'");
    expect(players).not.toContain("document.createElement('script')");
    expect(players).not.toContain('spotify-player.js');
    expect(players).not.toContain('youtube.com/iframe_api');
    expect(players).toContain('sandbox="allow-scripts allow-same-origin');
  });

  it('pins the Windows display helper to its reviewed SHA-256 digest', async () => {
    const main = await source('electron/main.cjs');
    const helper = await readFile(new URL('../electron/windows-display.ps1', import.meta.url));
    const digest = createHash('sha256').update(helper).digest('hex');
    expect(main).toContain(`const DISPLAY_HELPER_SHA256 = '${digest}'`);
    expect(main).toContain('await verifyDisplayHelper()');
  });

  it('hardens packaged Electron capabilities', async () => {
    const packageJson = JSON.parse(await source('package.json'));
    expect(packageJson.build.electronFuses).toMatchObject({
      runAsNode: false,
      enableCookieEncryption: true,
      enableNodeOptionsEnvironmentVariable: false,
      enableNodeCliInspectArguments: false,
      enableEmbeddedAsarIntegrityValidation: true,
      onlyLoadAppFromAsar: true,
    });
  });
});
