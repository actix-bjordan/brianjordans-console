import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="empty-state">
      <span className="empty-state-icon" aria-hidden="true">?</span>
      <h1>Page not found</h1>
      <p>That console page doesn't exist.</p>
      <Link to="/dashboard" className="btn btn-primary">Back to dashboard</Link>
    </div>
  );
}
