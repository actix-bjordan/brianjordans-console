import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";

/**
 * Client-side gate only. This keeps the shell from rendering for a signed-out
 * visitor; it is not a security control. Anything sensitive has to be
 * protected at the API, behind a verified token.
 */
export default function RequireAuth() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <Outlet />;
}
