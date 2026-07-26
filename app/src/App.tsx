import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import RequireAdmin from "./components/RequireAdmin";
import { useAuth } from "./lib/auth";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import Reports from "./pages/Reports";
import Users from "./pages/Users";

export default function App() {
  const { loading } = useAuth();

  // The server only serves this bundle to a signed-in user, so this is a brief
  // identity fetch rather than an authentication check.
  if (loading) {
    return (
      <div className="app-loading" role="status" aria-live="polite">
        Loading console…
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/reports" element={<Reports />} />
        <Route element={<RequireAdmin />}>
          <Route path="/users" element={<Users />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
