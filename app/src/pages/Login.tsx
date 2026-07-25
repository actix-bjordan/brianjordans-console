import { Navigate, useLocation, useNavigate } from "react-router-dom";
import GoogleMark from "../components/GoogleMark";
import { useAuth } from "../lib/auth";

export default function Login() {
  const { user, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/dashboard";

  if (user) return <Navigate to={from} replace />;

  const handleSignIn = () => {
    signInWithGoogle();
    navigate(from, { replace: true });
  };

  return (
    <section className="auth-shell">
      <div className="auth-card card">
        <span className="eyebrow">Management Console</span>
        <h1 className="auth-title">Welcome to Brian Jordan's Management Console</h1>
        <p className="auth-subtitle">Sign in with your Google account to continue.</p>

        <button type="button" className="btn btn-google" onClick={handleSignIn}>
          <GoogleMark />
          Sign in with Google
        </button>

        <p className="auth-note">
          Access is limited to authorized accounts. Sign-in is a placeholder until the
          identity provider is connected.
        </p>

        <p className="auth-back">
          <a href="https://brianjordans.com">Back to brianjordans.com</a>
        </p>
      </div>
    </section>
  );
}
