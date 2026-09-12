export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand" aria-label="XREAL WIN HUB">
      <span className="brand__mark" aria-hidden>
        <span className="brand__lens brand__lens--left" />
        <span className="brand__lens brand__lens--right" />
        <span className="brand__bridge" />
      </span>
      {!compact ? (
        <span className="brand__wordmark">
          <strong>XREAL</strong>
          <span>WIN HUB</span>
        </span>
      ) : null}
    </div>
  );
}
