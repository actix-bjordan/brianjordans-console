import PageHeader from "../components/PageHeader";

interface ReportRow {
  name: string;
  scope: string;
  cadence: string;
  lastRun: string;
}

/** Placeholders until a reporting backend is connected. */
const reports: ReportRow[] = [
  { name: "AWS cost by service", scope: "All accounts", cadence: "Monthly", lastRun: "Never" },
  { name: "Form submissions", scope: "brianjordans.com", cadence: "Weekly", lastRun: "Never" },
  { name: "Certificate expiry", scope: "All domains", cadence: "Weekly", lastRun: "Never" },
  { name: "Security posture", scope: "All accounts", cadence: "Monthly", lastRun: "Never" },
];

export default function Reports() {
  return (
    <>
      <PageHeader
        title="Reports"
        description="Scheduled and ad hoc reporting across cost, delivery, and security posture. These are placeholder definitions; none of them run yet."
      />

      <div className="card">
        <div className="card-header">
          <h2>Report definitions</h2>
          <button type="button" className="btn btn-secondary" disabled>
            New report
          </button>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Report</th>
              <th>Scope</th>
              <th>Cadence</th>
              <th>Last run</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr key={report.name}>
                <td>{report.name}</td>
                <td>{report.scope}</td>
                <td>{report.cadence}</td>
                <td>{report.lastRun}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
