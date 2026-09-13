import { describe, expect, it } from 'vitest';
import { formatDuration, relativeTime, validWebUrl } from './format';

describe('format helpers', () => {
  it('formats timer values', () => {
    expect(formatDuration(1_500)).toBe('25:00');
    expect(formatDuration(9)).toBe('00:09');
  });

  it('formats recent timestamps', () => {
    const now = Date.parse('2026-09-12T10:00:00.000Z');
    expect(relativeTime('2026-09-12T09:59:40.000Z', now)).toBe('Just now');
    expect(relativeTime('2026-09-11T10:00:00.000Z', now)).toBe('Yesterday');
  });

  it('accepts only HTTP and HTTPS destinations', () => {
    expect(validWebUrl('https://example.com')).toBe(true);
    expect(validWebUrl('http://localhost:3000')).toBe(true);
    expect(validWebUrl('http://example.com')).toBe(false);
    expect(validWebUrl('https://user:password@example.com')).toBe(false);
    expect(validWebUrl('javascript:alert(1)')).toBe(false);
    expect(validWebUrl('not a URL')).toBe(false);
  });
});
