# brianjordans-console

Management console for Brian Jordan's personal technical operations, hosted at
**https://app.brianjordans.com**.

The public marketing site lives in a separate repository,
[brianjordans-website](https://github.com/actix-bjordan/brianjordans-website).

## Status

This is a **scaffold**. The shell, theme, routing, and hosting are in place.
No data sources are connected, so every panel renders an empty state, and
**authentication is not implemented** (see below).

## Architecture

- **`app/`** — React 19 + TypeScript + Vite single-page app (React Router).
- **`infra/`** — AWS CDK (TypeScript), one stack in `us-east-1`:
  - **BrianJordansConsole** — Private S3 bucket (Block Public Access ON) served
    exclusively through CloudFront with Origin Access Control, HTTPS enforced,
    TLS 1.2+, and SPA routing (403/404 → `index.html`). Price class is
    `PriceClass_100`.

The Route 53 hosted zone for `brianjordans.com` is created and owned by the
website repository. This stack only references it by ID to attach the
`app.brianjordans.com` alias records, and never modifies the zone itself.

### Why this is a separate origin

The console is deliberately *not* served from a path under `brianjordans.com`.
Its own origin means the browser, not our configuration, enforces isolation of
console session state from the public site: separate cookies, separate
`localStorage`, separate JS context. It also lets the two carry different cache
and indexing policies without maintaining path-prefix behaviors, and decouples
deploy blast radius, since each deploy purges only its own distribution.

Accordingly, this distribution is stricter than the marketing site's:

| Header | Value |
|---|---|
| `Content-Security-Policy` | self-only, except `accounts.google.com` for sign-in |
| `X-Robots-Tag` | `noindex, nofollow` |
| `Cache-Control` (shell) | `no-store, no-cache, must-revalidate` |
| `Strict-Transport-Security` | 2 years, `includeSubDomains`, `preload` |
| `X-Frame-Options` / `frame-ancestors` | `DENY` / `'none'` |

## Authentication is not implemented

`app/src/lib/auth.tsx` holds a placeholder session in `sessionStorage` purely so
the shell is navigable. The "Preview" badge in the topbar is a standing reminder
of this. `RequireAuth` is a routing convenience, **not** a security control.

Do not put anything sensitive in this console until real auth is in place.

The intended path is a Cognito user pool with Google as a federated identity
provider:

1. Create the user pool and app client, add Google as an IdP, and restrict
   sign-in to your own Workspace accounts.
2. Point the Hosted UI callback at `https://app.brianjordans.com/`.
3. Replace the bodies of `signInWithGoogle` and `signOut` in
   `app/src/lib/auth.tsx` with the Hosted UI redirect and token exchange.
4. Add the console API as a second origin on this distribution under `/api/*`
   and verify the JWT there. That is the boundary that actually protects data.

Keeping the API on this same distribution (rather than a third domain) keeps
session cookies first-party (`HttpOnly`, `Secure`, `SameSite=Strict`) and avoids
CORS entirely.

## Resources

| Resource | Value |
|---|---|
| Console URL | https://app.brianjordans.com |
| CloudFront distribution ID | `E19KH0ZICQMPL7` |
| Console bucket | `app.brianjordans.com-104322895649` |
| Route 53 hosted zone (owned by website repo) | `Z00406963PWDGGJZA3WA2` |

## Deploying

```bash
cd app && npm run deploy
```

This runs `scripts/deploy.sh`, which builds the app, uploads it to S3,
invalidates the entire CloudFront cache (`/*`), **waits for the invalidation to
complete at every edge location**, and then verifies the live domain is serving
the new bundle before reporting success. The bucket and distribution are
resolved from the `BrianJordansConsole` stack outputs at run time, so the script
and the infrastructure cannot drift apart.

Infrastructure changes:

```bash
cd infra
npx cdk diff
npx cdk deploy BrianJordansConsole
```

## Local development

```bash
cd app && npm install && npm run dev   # http://localhost:5174
```
