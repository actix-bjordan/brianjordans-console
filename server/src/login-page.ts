const GOOGLE_MARK = `<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
  <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"/>
  <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"/>
  <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.96H.96a9 9 0 0 0 0 8.08l3.01-2.32Z"/>
  <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.32C4.68 5.16 6.66 3.58 9 3.58Z"/>
</svg>`;

const MESSAGES: Record<string, string> = {
  denied: "That Google account is not authorized for this console.",
  disabled: "That account has been disabled.",
  failed: "Sign-in could not be completed. Please try again.",
  expired: "The sign-in request expired. Please try again.",
  signedout: "You have been signed out.",
};

/**
 * Standalone sign-in page. Rendered by the server rather than the SPA so an
 * unauthenticated visitor never receives the application bundle.
 */
export function renderLoginPage(options: { reason?: string; returnTo?: string }): string {
  const message = options.reason ? MESSAGES[options.reason] : undefined;
  const isError = Boolean(message) && options.reason !== "signedout";
  const returnTo = options.returnTo ?? "";
  const signInHref = returnTo
    ? `/auth/google?returnTo=${encodeURIComponent(returnTo)}`
    : "/auth/google";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#060b18">
<meta name="robots" content="noindex, nofollow">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<title>Sign in | Brian Jordan Management Console</title>
<style>
  :root {
    --navy-950:#060b18; --navy-900:#0a1224; --navy-850:#0d1730;
    --border:rgba(122,155,224,.16); --border-strong:rgba(122,155,224,.32);
    --text-primary:#e8edf8; --text-secondary:#a7b4d0; --text-muted:#6e7ea3;
    --accent-bright:#6ea3ff; --danger:#f06a6a; --success:#4fc98a;
    color-scheme: dark;
  }
  * { box-sizing: border-box; }
  body {
    margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    padding:3rem 1.25rem;
    background-color:var(--navy-950);
    background-image:
      radial-gradient(1200px 600px at 80% -10%, rgba(79,142,247,.08), transparent 60%),
      radial-gradient(900px 500px at -10% 30%, rgba(36,55,107,.25), transparent 60%);
    background-attachment:fixed;
    color:var(--text-primary);
    font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
    line-height:1.6; -webkit-font-smoothing:antialiased;
  }
  .card {
    width:100%; max-width:30rem; padding:2.75rem; text-align:center;
    background:linear-gradient(160deg,var(--navy-850),var(--navy-900));
    border:1px solid var(--border); border-radius:16px;
    box-shadow:0 4px 24px rgba(2,6,18,.45);
  }
  .eyebrow {
    display:block; font-size:.75rem; font-weight:700; text-transform:uppercase;
    letter-spacing:.14em; color:var(--accent-bright); margin-bottom:.75rem;
  }
  h1 { margin:0 0 .75rem; font-size:clamp(1.4rem,1.1rem + 1.3vw,1.85rem); line-height:1.2; letter-spacing:-.02em; }
  p { margin:0 0 2rem; color:var(--text-secondary); }
  .btn {
    display:inline-flex; align-items:center; justify-content:center; gap:.5rem;
    width:100%; padding:.8rem 1.4rem; border-radius:8px; font-size:1rem; font-weight:600;
    cursor:pointer; border:1px solid #dadce0; background:#fff; color:#1f1f1f;
    text-decoration:none; font-family:inherit;
    transition:background .15s ease, border-color .15s ease;
  }
  .btn:hover { background:#f4f6fb; border-color:#c6cbd4; }
  .note { margin:1.5rem 0 0; font-size:.85rem; color:var(--text-muted); }
  .banner {
    margin:0 0 1.5rem; padding:.7rem 1rem; border-radius:8px; font-size:.9rem;
    border:1px solid var(--border-strong); text-align:left;
  }
  .banner-error { color:var(--danger); border-color:rgba(240,106,106,.4); background:rgba(240,106,106,.08); }
  .banner-info { color:var(--success); border-color:rgba(79,201,138,.4); background:rgba(79,201,138,.08); }
  .back { margin-top:2rem; font-size:.85rem; }
  a.back-link { color:var(--accent-bright); text-decoration:none; }
  a.back-link:hover { color:var(--text-primary); }
  @media (max-width:560px) { .card { padding:2rem 1.5rem; } }
</style>
</head>
<body>
  <main class="card">
    <span class="eyebrow">Management Console</span>
    <h1>Welcome to Brian Jordan's Management Console</h1>
    <p>Sign in with your Google account to continue.</p>
    ${message ? `<div class="banner ${isError ? "banner-error" : "banner-info"}">${message}</div>` : ""}
    <a class="btn" href="${signInHref}">${GOOGLE_MARK}Sign in with Google</a>
    <p class="note">Access is limited to authorized accounts. Google is the only sign-in method; this console never handles passwords.</p>
    <p class="back"><a class="back-link" href="https://brianjordans.com">Back to brianjordans.com</a></p>
  </main>
</body>
</html>`;
}
