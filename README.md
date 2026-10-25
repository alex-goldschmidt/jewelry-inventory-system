# Express + React TypeScript starter

A layered Express/MySQL API with a Vite/React frontend and a generated Hey API
SDK. The backend owns the public Zod models; frontend types, SDK functions, and
TanStack Query helpers come from its OpenAPI contract.

## Start locally

Use Node 22.13+ (the current Node 22 release is recommended) and a local MySQL
database. From the repository root:

```sh
npm run setup
cp -n server/.env.example server/.env
cp -n client/.env.example client/.env.local
```

Keep an existing `.env` if you already configured the server. Fill in database
credentials and two different JWT secrets. Generate each secret separately:

```sh
node -e 'console.log(require("node:crypto").randomBytes(32).toString("hex"))'
```

Create your local database and apply the SQL files in `server/migrations` in
numeric order, once, using your MySQL client. This starter does not yet include
a migration runner or provision a database automatically.

Start each process in a separate terminal, from the repository root:

```sh
npm run dev:server
```

```sh
npm run dev:client
```

Open **https://localhost:5173**. Vite creates a local, untrusted certificate;
accept the browser's certificate prompt for this local development address.
The HTTPS frontend proxies `/api` to `http://localhost:3000`, so refresh cookies
remain `Secure` without changing server cookie settings.

Create an account, sign in, load your profile, refresh your session, and sign
out. Access tokens stay in memory. After reloading the page, select **Restore
an existing session** to rotate the HTTP-only refresh cookie and obtain a new
access token. Refresh is explicit; there is no automatic 401 retry or background
refresh loop. TanStack Query mutation retries are disabled to avoid replaying
one-use refresh tokens.

Swagger UI is available at `/api/docs` through either server or frontend.
`GET /api/users/me` derives ownership from the authenticated identity. The
existing `GET /api/users/:userId` also remains available with its ownership check.

## Development commands

```sh
# Regenerate server/openapi.json, then the frontend SDK and query helpers.
npm run api:generate

# Verify both generated artifacts without updating them.
npm run api:check

# Type checks, lint, tests, builds, and generated-artifact checks.
npm run check

# Preview a database-backed DTO without writing it.
npm --prefix server run generate:resource -- organization --from-db --dry-run
```

The root package only coordinates commands; `server/` and `client/` retain
separate dependencies and lockfiles. Generated frontend files are committed and
checked for drift. Edit schemas/configuration and regenerate; never hand-edit
`client/src/api/generated`.

## Adding a feature

1. Add a migration and generate the database DTO.
2. Add the repository, service, controller, and route as needed.
3. Define public request/response Zod models separately from database rows.
4. Register the OpenAPI endpoint with a stable, unique `operationId`.
5. Run `npm run api:generate` and use the generated TanStack helpers.
6. Run `npm run check` and commit the source and generated changes together.

Read [the resource pattern](server/docs/backend-resource-pattern.md),
[the code-generation walkthrough and findep comparison](server/docs/codegen-and-findep-comparison.md),
and [the type-safety policy](server/docs/type-safety.md).

## Deployment boundary

Build `client/` into static files with `npm --prefix client run build`; build
the API with `npm --prefix server run build`. Serve the frontend over HTTPS and
reverse-proxy `/api` to Express on the same origin. The Vite development proxy
and certificate plugin are development tools, not a production server.

If deploying the frontend and API on different origins, configure credentialed
CORS and review SameSite/CSRF settings for that deployment before using refresh
cookies. `VITE_API_BASE_URL` is public browser configuration; never put secrets
in `VITE_*` variables. The default server CORS settings do not enable a separate
credentialed frontend origin.

This is a tested project foundation, not a claim that production hardening is
complete. Rate limiting, recovery/email verification, migrations, hosting,
monitoring, and operational settings remain project-specific. See the existing
[auth considerations](server/docs/current-auth-flow.md#current-production-considerations).
