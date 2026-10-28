This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Sign-in

Two ways in, one session cookie (`kpi_session`):

- **Continue with Google**: Keycloak (realm `modula`, client `kpi-tracker`) via `openid-client`, with PKCE, state and nonce. The role (`admin` or `viewer`, admin wins if both) comes only from `resource_access["kpi-tracker"].roles` in the validated ID token. Grants are managed in the Access Hub; a user without one is sent to `$HUB_URL/no-access?app=kpi-tracker`.
- **Email + password**: the `.env` account (`AUTH_EMAIL` / `AUTH_PASSWORD`), always `admin`, unaffected by Keycloak.

For Google sessions the refresh token sits in the encrypted `kpi_sso` cookie (AES-256-GCM, key derived from `AUTH_SECRET`). `proxy.ts` re-checks with Keycloak once the last check is 5 minutes old:

| Keycloak says | The app does |
|---|---|
| `invalid_grant` (disabled, logged out, session over) | ends the session → 401 → `/login` |
| no `kpi-tracker` role any more | ends the session → 403 → hub `/no-access?app=kpi-tracker` |
| unreachable / 5xx | 503 → `/unavailable`; access is never extended |
| ok | updates the role |

`/api/*` gets JSON instead (`{"error":"unauthenticated" | "forbidden" | "auth_unavailable"}`). Logging out also ends the Keycloak session (RP-initiated logout).

Environment: see `.env.example` (`HUB_ISSUER`, `HUB_CLIENT_ID`, `HUB_CLIENT_SECRET`, `HUB_REDIRECT_URI`, `HUB_POST_LOGOUT_URI`, `HUB_URL`). Code: `lib/sso.ts`, `lib/gate.ts`, `lib/session.ts`, `lib/seal.ts`, `app/auth/hub/route.ts`, `proxy.ts`.

## Tests

```bash
npm test           # unit: role extraction, `next` open redirects, tampered cookies, the gate (no Keycloak needed)
npm run test:int   # against the local Keycloak (centralauth: npm run kc): login, revoke, suspend, outage, logout
npm run test:e2e   # runs the app on :3003 against the local Keycloak, then with Keycloak unreachable
npm run dev:local  # the app on :3003 against the local Keycloak (test/local.env)
```

The local Keycloak's `upstream` realm stands in for Google; check a real Google login by hand.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
