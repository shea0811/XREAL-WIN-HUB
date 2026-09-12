import type { SVGProps } from 'react';

export type MediaService = 'spotify' | 'youtube';

export function MediaBrandIcon({
  service,
  ...props
}: SVGProps<SVGSVGElement> & { service: MediaService }) {
  if (service === 'spotify') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
        <circle cx="12" cy="12" r="11" fill="#1ed760" />
        <path d="M6.8 9.1c3.6-1.05 7.92-.82 10.9.78" fill="none" stroke="#07140c" strokeLinecap="round" strokeWidth="1.8" />
        <path d="M7.45 12.25c3.12-.82 6.8-.6 9.42.72" fill="none" stroke="#07140c" strokeLinecap="round" strokeWidth="1.55" />
        <path d="M8.05 15.12c2.6-.62 5.45-.4 7.72.7" fill="none" stroke="#07140c" strokeLinecap="round" strokeWidth="1.4" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <rect x="1.5" y="4.5" width="21" height="15" rx="5" fill="#ff0033" />
      <path d="m10 8.5 6 3.5-6 3.5z" fill="white" />
    </svg>
  );
}
