import { useCallback, useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Role } from "../lib/auth";

interface DirectoryUser {
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  status: "active" | "disabled";
  lastLoginAt?: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  user_exists: "A user with that email already exists.",
  valid_email_required: "Enter a valid email address.",
  first_name_required: "First name is required.",
  last_name_required: "Last name is required.",
  invalid_role: "Pick a valid role.",
  last_admin: "This is the last active admin. Promote someone else first.",
  cannot_demote_self: "You cannot remove your own admin access.",
  cannot_remove_self: "You cannot remove your own account.",
  forbidden: "You do not have permission to do that.",
};

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    return ERROR_MESSAGES[error.code] ?? "Something went wrong. Please try again.";
  }
  return "Something went wrong. Please try again.";
}

function formatLastLogin(value?: string): string {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ users: DirectoryUser[] }>("/api/users");
      setUsers(data.users);
      setError(null);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await api.post("/api/users", { firstName, lastName, email, role });
      setFirstName("");
      setLastName("");
      setEmail("");
      setRole("member");
      await load();
    } catch (err) {
      setFormError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const mutate = async (target: string, patch: Partial<DirectoryUser>) => {
    setBusyEmail(target);
    setError(null);
    try {
      await api.patch(`/api/users/${encodeURIComponent(target)}`, patch);
      await load();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusyEmail(null);
    }
  };

  const remove = async (target: string) => {
    if (!window.confirm(`Remove ${target} from the console?`)) return;
    setBusyEmail(target);
    setError(null);
    try {
      await api.delete(`/api/users/${encodeURIComponent(target)}`);
      await load();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusyEmail(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Users"
        description="Everyone who can sign in to this console. Access is granted by email address; Google verifies the identity and this list decides who is allowed through."
      />

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div className="card-header">
          <h2>Add a user</h2>
        </div>
        <form onSubmit={handleAdd} className="user-form">
          <div className="field">
            <label htmlFor="firstName">First name</label>
            <input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label htmlFor="lastName">Last name</label>
            <input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label htmlFor="email">Google account email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label htmlFor="role">Role</label>
            <select id="role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="field field-action">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Adding…" : "Add user"}
            </button>
          </div>
        </form>
        {formError && <div className="alert alert-error" style={{ marginTop: "1rem" }}>{formError}</div>}
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Directory</h2>
          <span className="text-muted" style={{ fontSize: "0.85rem" }}>
            {users.length} {users.length === 1 ? "user" : "users"}
          </span>
        </div>

        {loading ? (
          <div className="empty-state">
            <p>Loading…</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last sign-in</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {users.map((entry) => {
                const isSelf = entry.email === currentUser?.email;
                const busy = busyEmail === entry.email;
                return (
                  <tr key={entry.email}>
                    <td>
                      {entry.firstName} {entry.lastName}
                      {isSelf && <span className="badge badge-inline">You</span>}
                    </td>
                    <td>{entry.email}</td>
                    <td>
                      <select
                        value={entry.role}
                        disabled={busy || isSelf}
                        onChange={(e) => mutate(entry.email, { role: e.target.value as Role })}
                        aria-label={`Role for ${entry.email}`}
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td>
                      <span className={entry.status === "active" ? "pill pill-ok" : "pill pill-off"}>
                        {entry.status}
                      </span>
                    </td>
                    <td>{formatLastLogin(entry.lastLoginAt)}</td>
                    <td className="row-actions">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={busy || isSelf}
                        onClick={() =>
                          mutate(entry.email, {
                            status: entry.status === "active" ? "disabled" : "active",
                          })
                        }
                      >
                        {entry.status === "active" ? "Disable" : "Enable"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-danger"
                        disabled={busy || isSelf}
                        onClick={() => remove(entry.email)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
