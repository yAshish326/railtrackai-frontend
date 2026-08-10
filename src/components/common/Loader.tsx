export default function Loader() {
  return (
    <div className="enterprise-page" role="status" aria-live="polite">
      <div className="enterprise-card" style={{ maxWidth: 360, display: "grid", gap: 12 }}>
        <div className="skeleton-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </div>
        <div className="muted-copy">Loading content…</div>
      </div>
    </div>
  );
}
