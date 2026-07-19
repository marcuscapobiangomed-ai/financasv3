export function PanelSkeleton({ wide }: { wide?: boolean }) {
  return (
    <article className="panel" style={wide ? { gridColumn: "1 / -1" } : undefined}>
      <div className="panel-heading">
        <div>
          <div className="skeleton-text skeleton-short" />
          <div className="skeleton-text skeleton-medium" />
        </div>
      </div>
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <div className="skeleton-block" style={{ height: "200px", borderRadius: "8px" }} />
        <div className="skeleton-text skeleton-long" />
      </div>
    </article>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="stat-card" style={{ pointerEvents: "none" }}>
      <div className="stat-card-heading">
        <div className="skeleton-text skeleton-short" />
        <div className="skeleton-icon" />
      </div>
      <div className="skeleton-text skeleton-large" style={{ marginTop: "8px" }} />
      <div className="skeleton-text skeleton-medium" style={{ marginTop: "4px" }} />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="table-wrap" style={{ pointerEvents: "none" }}>
      <table className="data-table">
        <thead>
          <tr>
            {Array.from({ length: 7 }).map((_, i) => (
              <th key={i}><div className="skeleton-text skeleton-short" /></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: 7 }).map((_, c) => (
                <td key={c}><div className="skeleton-text" style={{ width: c === 0 ? "180px" : c === 5 ? "100px" : "80px" }} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <section className="decision-hero flex-col" style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "28px 32px", pointerEvents: "none" }}>
      <div className="skeleton-text skeleton-short" style={{ width: "200px" }} />
      <div className="skeleton-text skeleton-large" style={{ width: "300px" }} />
      <div className="skeleton-text skeleton-long" />
    </section>
  );
}
