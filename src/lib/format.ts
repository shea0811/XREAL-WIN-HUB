export function relativeTime(value: string, now = Date.now()) {
  const timestamp = new Date(value).getTime();
  const difference = Math.max(0, now - timestamp);
  const minutes = Math.floor(difference / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Yesterday' : `${days}d ago`;
}

export function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function validWebUrl(value: string) {
  try {
    const parsed = new URL(value);
    if (parsed.username || parsed.password) return false;
    return parsed.protocol === 'https:'
      || (parsed.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(parsed.hostname));
  } catch {
    return false;
  }
}
