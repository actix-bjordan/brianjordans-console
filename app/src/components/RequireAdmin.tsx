import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";

/**
 * Hides admin-only pages from members. The server enforces the same rule on
 * /api/users, which is the check that actually matters.
 */
export default function RequireAdmin() {
  const { isAdmin } = useAuth();
  return isAdmin ? <Outlet /> : <Navigate to="/dashboard" replace />;
}
