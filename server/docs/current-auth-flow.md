# Current Auth Flow

This document describes the current custom authentication flow implemented by the Express API.

Auth repositories and generated DTOs use the approved `users` and `refreshTokens`
tables. Resource filenames and class names remain singular. See the
[approved database design and integration gaps](jewelry-inventory-design.md)
for the complete schema and planned business membership authorization.

## Overview

The app uses a custom email/password authentication system:

- Passwords are hashed with Argon2id.
- Successful sign-in returns a short-lived JWT access token.
- A longer-lived JWT refresh token is stored in an HTTP-only cookie.
- Refresh tokens are hashed with SHA-256 before being stored in MySQL.
- Refresh token rotation is one-time-use: each refresh consumes the old token and issues a new token pair.

The current route prefix is `/api/users`.

`GET /api/users/me` verifies the bearer token and returns the public user model
for its validated subject. Missing user records return 404, including on the
existing ID route. The Vite/React starter uses `/me` for its profile query; local
HTTPS and the `/api` proxy preserve secure refresh-cookie behavior.

## Routes

### `POST /api/users/register`

Creates a new local user.

Flow:

1. Validates the request body with `UserInputSchema`.
2. Checks whether the email already exists.
3. Hashes the password with Argon2id.
4. Inserts the user into the `users` table. This does not create a business or membership.
5. Returns `{ success: true }` with status `201`.

Errors:

- Existing email returns `409 Conflict`.
- Invalid request body returns validation errors.

### `POST /api/users/signIn`

Authenticates a user and starts a session.

Flow:

1. Validates the request body with `UserInputSchema`.
2. Looks up the user by email.
3. Verifies the submitted password with Argon2id.
4. If the user does not exist or has a NULL password, verifies against a dummy
   Argon2id hash anyway, then rejects the credentials regardless of that result.
5. Uses a generic failure message for missing users and incorrect passwords.
6. Generates:
   - access token: JWT, `15m`
   - refresh token: JWT, `7d`
7. Adds a random `jti` to each refresh token so every issued refresh token is unique.
8. Hashes the refresh token with SHA-256.
9. Stores the refresh-token hash, user id, and expiration in the `refreshTokens` table.
10. Sets the raw refresh token in an HTTP-only cookie.
11. Returns `{ accessToken }`.

Cookie settings:

```ts
{
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  maxAge: refreshTokenExpiresAt - Date.now()
}
```

Security notes:

- The sign-in error is always `Invalid email or password.` for credential failures.
- The dummy Argon2id verification reduces user enumeration through timing differences.
- Refresh-token uniqueness is enforced by the `jti` claim plus a unique DB index on `tokenHash`.

### `POST /api/users/refreshToken`

Rotates the refresh token and issues a new access token.

Flow:

1. Reads `refreshToken` from the HTTP-only cookie.
2. Verifies the refresh JWT with `JWT_REFRESH_TOKEN_SECRET`.
3. Reads `sub` from the refresh token and parses it as the user id.
4. Hashes the raw refresh token.
5. Looks up the stored refresh-token row by `userId` and `tokenHash`.
6. Rejects unknown tokens.
7. Validates and parses the stored DB expiration as a UTC timestamp. Malformed
   database values fail with a server error before token consumption or issuance.
8. If expired:
   - revokes that token row,
   - clears the refresh cookie,
   - rejects the request.
9. Attempts to atomically revoke the active refresh token:

```sql
UPDATE refreshTokens SET isRevoked = 1
WHERE tokenHash = ? AND userId = ? AND isRevoked = 0
```

10. If the update affects `0` rows, treats the request as refresh-token reuse:
    - revokes all active refresh tokens for the user,
    - clears the refresh cookie,
    - rejects the request.
11. If the update affects `1` row:
    - generates a new access token and refresh token,
    - stores the new refresh-token hash,
    - sets the new refresh-token cookie,
    - returns `{ accessToken }`.

Security notes:

- `revokedRows` is the source of truth for replay detection.
- Expiration is compared with the current instant in UTC; equality counts as expired.
- The service intentionally does not return early on `isRevoked === 1`; already-revoked tokens are handled by the atomic update returning `0` rows.
- Expired tokens revoke only the expired token, not all sessions.
- Reused or concurrently consumed tokens trigger the revoke-all breach protocol.

### `POST /api/users/logout`

Ends the current refresh-token session.

Flow:

1. Reads `refreshToken` from the HTTP-only cookie.
2. If no cookie exists, clears the cookie anyway and returns success.
3. If a cookie exists:
   - hashes the refresh token,
   - marks the matching token row revoked,
   - clears the refresh cookie,
   - returns `{ success: true }`.

Note:

- Existing access tokens remain valid until they expire. Current access-token TTL is `15m`.

### `GET /api/users/:userId`

Fetches a user by id.

Middleware:

1. `authenticateToken`
2. `authorizeUserId`

Flow:

1. `authenticateToken` requires an `Authorization: Bearer <token>` header.
2. It verifies the access JWT with a required `JWT_ACCESS_TOKEN_SECRET` and the `HS256` algorithm.
3. It validates the decoded claims before storing them on `req.user`; `sub` must be a canonical positive safe integer string.
4. `authorizeUserId` compares `req.user.sub` with the `:userId` route parameter.
5. If they match, the user record is returned.

Security notes:

- `authenticateToken` uses strict `Bearer ` parsing.
- Middleware forwards failures through `next(err)` so the central error middleware formats responses.
- Route IDs must also be canonical positive safe integer strings; partial numeric strings are rejected.
- Non-string refresh cookies are treated as missing tokens on refresh and cleared on logout.

## Token Design

### Access Token

Payload:

```ts
{
  sub: userId.toString()
}
```

Properties:

- Signed with `JWT_ACCESS_TOKEN_SECRET`.
- Algorithm: `HS256`.
- TTL: `15m`.
- Sent to the client in the JSON response.
- Expected on protected routes as `Authorization: Bearer <accessToken>`.

### Refresh Token

Payload:

```ts
{
  sub: userId.toString(),
  jti: crypto.randomUUID()
}
```

Properties:

- Signed with `JWT_REFRESH_TOKEN_SECRET`.
- Algorithm: `HS256`.
- TTL: `7d`.
- Stored client-side in an HTTP-only cookie.
- Stored server-side only as a SHA-256 hash.
- Rotated on every successful refresh.

## Database Tables

### `users`

Relevant fields:

- `userId`
- `email`
- `password`: nullable `VARCHAR(512)`; password-based accounts store an Argon2id hash.

Password login always rejects a NULL password. The approved migration permits
NULL for future provider-only accounts; Google authentication is not implemented.
User IDs are `INT UNSIGNED`, and audit timestamps are non-null strings in the DTO.

### `refreshTokens`

Relevant fields:

- `refreshTokenId`
- `userId`
- `tokenHash`
- `isRevoked`
- `expiration`

The approved migration defines `fk_refreshTokens_user` referencing
`users(userId)` with `ON DELETE CASCADE`, unique `uq_refreshTokens_tokenHash`,
`ix_refreshTokens_userId_isRevoked`, and `chk_refreshTokens_isRevoked` limiting
the flag to 0/1. IDs are `INT UNSIGNED`; expiration and audit timestamps are
required. These are application sessions, not provider tokens.

The mysql2 pool keeps `dateStrings: true` and uses `timezone: "Z"` for JavaScript
Date parameters. The first checkout of each physical connection awaits
`SET SESSION time_zone = '+00:00'` before exposing it; a failed setup destroys that
connection and rejects the request. Successful setup is tracked in a WeakSet keyed
by the underlying connection, since mysql2 creates a new promise wrapper on each
checkout. New and replacement physical connections initialize independently;
reused connections skip setup. Repository helpers release connections after
success or failure. Callers must preserve the session time zone; destroy a
connection if its session is reset or changed rather than returning it to the pool.
Use the exported `getConnection()` for future explicit transactions; the raw
pool stays private. The default export exposes `getConnection()` and `end()`.

`pool.execute()` normally checks out a pooled connection, calls that connection's
`execute()` and releases it. Our `withConnection()` performs the same lifecycle
with awaited UTC initialization before a connection's first use. Pool reuse and
prepared-statement execution remain available; the extra SET round trip occurs
only once per physical connection. Initialization is awaited directly on checkout,
so application queries do not race an asynchronous pool event listener.
`withConnection()` does not start a transaction:
atomic multi-write work still needs one explicitly shared connection with
begin/commit/rollback handling.

`parseMysqlUtcTimestamp` accepts the approved schema's second-precision
`YYYY-MM-DD HH:mm:ss` format and rejects invalid calendar dates with an
`AppError` carrying status 500, because the invalid value came from the database.
DTO timestamps
remain strings; conversion to Date is explicit for expiry comparison. A future
timestamp API should map valid UTC values to ISO 8601 strings with `Z` and let
the frontend localize display. Fractional-precision columns would require an
explicit parser update.

Regenerate the internal DTOs from an already-created local schema with:

```sh
npm --prefix server run generate:resource -- user --from-db --table users
npm --prefix server run generate:resource -- refreshToken --from-db --table refreshTokens
```

These commands run from the repository root, read database metadata and write
DTOs, then build the server. They do not create tables or execute migrations.
The approved [initial migration](../migrations/0001_initial_schema.sql) contains
the constraints directly; do not apply the earlier singular-table ALTER examples
from the starter's history to the new tables.

## Error Handling

Auth errors use app-specific exception classes:

- `UnauthorizedError`
- `ForbiddenError`
- `ConflictError`

These extend `AppError` and are formatted by the central error middleware.

Common auth error cases:

- Missing access token: `401 Unauthorized`
- Invalid access token: `403 Forbidden`
- Expired access token: `403 Forbidden`
- Invalid email/password: `401 Unauthorized`
- Missing refresh token: `401 Unauthorized`
- Unknown refresh token: `401 Unauthorized`
- Expired refresh token: `403 Forbidden`
- Refresh-token reuse: `403 Forbidden`

## Current Production Considerations

The auth flow includes several production-oriented controls:

- Argon2id password hashing.
- Generic sign-in failure responses.
- Dummy password verification for missing users.
- Short-lived access tokens.
- HTTP-only refresh-token cookies.
- Refresh-token hashing at rest.
- One-time refresh-token rotation.
- Atomic refresh-token consumption.
- Reuse detection with revoke-all-session breach handling.
- Strict bearer-token parsing.

Remaining items to address before production:

- Add platform or app-level rate limiting for auth endpoints.
- Restrict CORS to known frontend origins.
- Review CSRF protection for cookie-backed endpoints.
- Add password reset flow if custom auth remains.
- Add email verification if custom auth remains.
- Decide whether access tokens remaining valid after logout for up to `15m` is acceptable.
- Add refresh-token cleanup for old expired/revoked rows.
- Rotate any secrets that may have been shared or committed.

## Clerk Migration Note

This project does not currently depend on Clerk; its sibling `findep` does.
See [the data-flow comparison](data-flow-and-findep-comparison.md) for that
provider boundary. A future Clerk migration can retain the current
middleware → controller → service → repository architecture.
