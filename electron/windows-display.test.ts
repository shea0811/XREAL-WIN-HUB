import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('Windows display helper structure', () => {
  it.each(['LF', 'CRLF'])('uses the documented 220-byte Unicode DEVMODE display layout with %s endings', async (ending) => {
    const original = await readFile(new URL('./windows-display.ps1', import.meta.url), 'utf8');
    const lf = original.replace(/\r\n/g, '\n');
    const fixture = ending === 'CRLF' ? lf.replace(/\n/g, '\r\n') : lf;
    const source = fixture.replace(/\r\n/g, '\n');
    expect(source).toContain('LayoutKind.Explicit, CharSet = CharSet.Unicode, Size = 220');
    expect(source).toContain('[FieldOffset(76)]\n        public int dmPositionX;');
    expect(source).toContain('[FieldOffset(80)]\n        public int dmPositionY;');
    expect(source).toContain('[FieldOffset(172)]\n        public uint dmPelsWidth;');
    expect(source).toContain('[FieldOffset(176)]\n        public uint dmPelsHeight;');
  });

  it('keeps test, staged apply, and delayed rollback paths enabled', async () => {
    const source = await readFile(new URL('./windows-display.ps1', import.meta.url), 'utf8');
    expect(source).toContain('$CdsTest = 0x00000002');
    expect(source).toContain('$CdsNoReset = 0x10000000');
    expect(source).toContain("if ($Action -eq 'Watch')");
    expect(source).toContain('Start-Sleep -Seconds $Seconds');
  });
});

describe('Windows media-key bridge', () => {
  it('accepts only fixed media commands at the main-process boundary', async () => {
    const source = await readFile(new URL('./main.cjs', import.meta.url), 'utf8');
    expect(source).toContain("previous: 0xB1");
    expect(source).toContain("toggle: 0xB3");
    expect(source).toContain("next: 0xB0");
    expect(source).toContain("'volume-up': 0xAF");
    expect(source).toContain("'volume-down': 0xAE");
    expect(source).toContain("!Object.hasOwn(MEDIA_VIRTUAL_KEYS, command)");
  });
});
