import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('Windows display helper structure', () => {
  it('uses the documented 220-byte Unicode DEVMODE display layout', async () => {
    const source = await readFile(new URL('./windows-display.ps1', import.meta.url), 'utf8');
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
