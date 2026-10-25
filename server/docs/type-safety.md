# Type safety policy

Run the complete local checks from `server/`:

```sh
npm ci
npm run check
```

The root `eslint.config.mjs` applies to all handwritten repository TypeScript
files, including tests and future directories. Dependency, build, and coverage
output is ignored. The sole generated-source exemption is
`client/src/api/generated/**`: Hey API emits casts and `any` internally, and its
output is regenerated rather than edited. Generated server DTOs and all
handwritten client code still follow the policy. `npm run lint` checks the repository, and npm runs it automatically
before `npm run build` and `npm test`. The GitHub Actions workflow runs the
server checks, client build/tests, and both OpenAPI and SDK freshness checks on
pushes and pull requests.
Branch protection requiring that workflow is a hosting setting outside this
repository; it is not configured by these files.

The policy rejects:

- Type assertions using `as` or angle brackets, including double assertions,
  with the sole exception of `as const`.
- Non-null and definite-assignment assertions.
- Explicit `any`.
- `@ts-ignore`, `@ts-expect-error`, and `@ts-nocheck` suppression comments.
- Enums, including const enums. Prefer a const object with `as const` and derive
  its value union with `typeof` and `keyof`.

Use this pattern for enum-like constants such as `HttpStatusCode` and `JwtSecretEnv`:

```ts
export const Status = {
  Active: "ACTIVE",
  Inactive: "INACTIVE",
} as const;

export type Status = (typeof Status)[keyof typeof Status];
```

`as const` preserves precise literal types and makes the literal's properties
readonly at compile time. It is erased during compilation and does not freeze
the object at runtime. Other assertions remain forbidden, including a cast
nested inside an `as const` expression and angle-bracket `<const>` syntax.

Inline ESLint configuration is disabled, so a file cannot bypass the policy
with an `eslint-disable` comment. TypeScript's existing `strict` mode remains
enabled. Tooling tests exercise these restrictions on source, test, and future
package paths.

Use annotations or `satisfies` to check values you construct. Use `unknown`,
runtime narrowing, or Zod schemas for external values. These checks do not
override the compiler's view of a value. Import aliases using `as` are ordinary
module syntax and remain allowed.

In this cleanup:

- Swagger uses its published type definitions and a normal import.
- DB insert IDs use mysql2's existing numeric return type; SQL parameters use `unknown[]`.
- JWT signing/verification obtains nonblank secrets through `getRequiredEnv`,
  whose parameter is restricted to the value union derived from `JwtSecretEnv`.
  Missing secrets throw `AppError` with status 500, and authentication forwards
  that error through a dedicated secret-reading helper.
- Verified payloads must pass `parseTokenClaims` before becoming `req.user`.
- Subjects and route IDs must be canonical positive safe integers.
- Refresh cookies are parsed as external data, including cookie-parser's JSON values.
- Tests use `jest.mocked`, typed HTTP mocks, and complete DB row fixtures.

Removing assertions does not by itself validate all runtime data. mysql2's query
generics still describe the expected row shape, library types may contain
`any`, and the generic cache API still relies on callers using the right value
type for a key. Do not replace a removed cast with an unchecked generic or a
handwritten type predicate that simply claims a value has the desired shape.
