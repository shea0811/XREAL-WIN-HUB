import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('Windows audio helper', () => {
  it('uses the supported endpoint and per-session Core Audio interfaces', async () => {
    const source = await readFile(new URL('./windows-audio.ps1', import.meta.url), 'utf8');
    expect(source).toContain('IAudioEndpointVolume');
    expect(source).toContain('SetMasterVolumeLevelScalar');
    expect(source).toContain('IAudioSessionManager2');
    expect(source).toContain('ISimpleAudioVolume');
    expect(source).toContain("[ValidateSet('Get', 'SetMaster', 'SetSession')]");
  });

  it('is integrity-pinned and receives only validated fixed arguments', async () => {
    const main = await readFile(new URL('./main.cjs', import.meta.url), 'utf8');
    const helper = await readFile(new URL('./windows-audio.ps1', import.meta.url), 'utf8');
    const digest = createHash('sha256').update(helper.replace(/\r\n/g, '\n'), 'utf8').digest('hex');
    expect(main).toContain(`const AUDIO_HELPER_SHA256 = '${digest}'`);
    expect(main).toContain("return runAudioHelper('SetMaster', volume)");
    expect(main).toContain("return runAudioHelper('SetSession', volume, sessionKey)");
    expect(main).toContain("!/^[a-z0-9 ._()-]{1,120}$/i.test(sessionKey)");
  });
});
