# Current Auth Flow

This document describes the current custom authentication flow implemented by the Express API.

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
4. Inserts the user into the `user` table.
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
4. If the user does not exist, verifies against a dummy Argon2id hash anyway.
5. Uses a generic failure message for missing users and incorrect passwords.
6. Generates:
   - access token: JWT, `15m`
   - refresh token: JWT, `7d`
7. Adds a random `jti` to each refresh token so every issued refresh token is unique.
8. Hashes the refresh token with SHA-256.
9. Stores the refresh-token hash, user id, and expiration in the `refreshToken` table.
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
7. Checks the stored DB expiration.
8. If expired:
   - revokes that token row,
   - clears the refresh cookie,
   - rejects the request.
9. Attempts to atomically revoke the active refresh token:

```sql
UPDATE refreshToken SET isRevoked = 1
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

### `user`

Relevant fields:

- `userId`
- `email`
- `password`

Security hardening migration:

```sql
ALTER TABLE user
  MODIFY password VARCHAR(512) NOT NULL;
```

### `refreshToken`

Relevant fields:

- `refreshTokenId`
- `userId`
- `tokenHash`
- `isRevoked`
- `expiration`

Security hardening migration:

```sql
ALTER TABLE refreshToken
  ADD CONSTRAINT fk_refreshToken_user
    FOREIGN KEY (userId) REFERENCES user(userId) ON DELETE CASCADE;

CREATE UNIQUE INDEX ux_refreshToken_tokenHash
  ON refreshToken (tokenHash);

CREATE INDEX ix_refreshToken_userId_isRevoked
  ON refreshToken (userId, isRevoked);
```

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
