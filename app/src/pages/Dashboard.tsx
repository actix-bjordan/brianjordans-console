import PageHeader from "../components/PageHeader";

interface Metric {
  label: string;
  value: string;
  meta: string;
}

/** Placeholders until a data source is connected. */
const metrics: Metric[] = [
  { label: "Month to date spend", value: "—", meta: "Cost Explorer not connected" },
  { label: "Active environments", value: "—", meta: "No inventory source" },
  { label: "Open alerts", value: "—", meta: "CloudWatch not connected" },
  { label: "Deploys this week", value: "—", meta: "No pipeline source" },
];

export default function Dashboard() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Operational status across the environments and services I run. Data sources are not connected yet, so every panel below is showing its empty state."
      />

      <div className="metric-grid">
        {metrics.map((metric) => (
          <div key={metric.label} className="card metric-card">
            <div className="metric-label">{metric.label}</div>
            <div className="metric-value">{metric.value}</div>
            <div className="metric-meta">{metric.meta}</div>
          </div>
        ))}
      </div>

      <div className="split-grid">
        <div className="card">
          <div className="card-header">
            <h2>Recent activity</h2>
          </div>
          <div className="empty-state">
            <span className="empty-state-icon" aria-hidden="true">◷</span>
            <p>No activity feed connected.</p>
            <p className="text-muted" style={{ fontSize: "0.85rem", margin: 0 }}>
              Wire this to CloudTrail or your deployment pipeline to populate it.
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Service health</h2>
          </div>
          <ul className="status-list">
            <li className="status-row">
              <span className="status-dot status-ok" aria-hidden="true" />
              <span className="status-row-name">brianjordans.com</span>
              <span className="status-row-meta">CloudFront</span>
            </li>
            <li className="status-row">
              <span className="status-dot status-ok" aria-hidden="true" />
              <span className="status-row-name">app.brianjordans.com</span>
              <span className="status-row-meta">CloudFront</span>
            </li>
            <li className="status-row">
              <span className="status-dot status-ok" aria-hidden="true" />
              <span className="status-row-name">Forms API</span>
              <span className="status-row-meta">API Gateway</span>
            </li>
            <li className="status-row">
              <span className="status-dot status-warn" aria-hidden="true" />
              <span className="status-row-name">Console authentication</span>
              <span className="status-row-meta">Not configured</span>
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}
