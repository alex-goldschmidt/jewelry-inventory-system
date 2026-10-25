# OpenAPI and Zod Contract

This backend now uses public Zod models as the source of truth for client-facing request and response shapes. The OpenAPI document is generated from those same schemas with `@asteasolutions/zod-to-openapi`, so validation, documentation, and future frontend type generation stay aligned.

## Why This Exists

- Client input is untrusted, so controllers validate request bodies with Zod before calling services.
- Database DTOs can contain internal fields, such as `UserDTO.password`, so they should not be returned directly.
- Public models in `src/models` describe only API-safe shapes.
- Mappers in `src/mappers` convert internal DTOs/projections into public models.
- Hey API consumes `openapi.json` to generate the React frontend's SDK, types, and TanStack Query helpers.

## Important Files

- `src/openapi/zod.ts`: extends the shared Zod import with `.openapi(...)`. Import Zod from this file inside public API models.
- `src/openapi/document.ts`: registers OpenAPI components and routes. This is where endpoint paths, methods, request bodies, responses, tags, and auth schemes are documented.
- `src/openapi/generate.ts`: writes or checks the generated `openapi.json` file. `npm run openapi:generate` updates the file; `npm run openapi:check` verifies it is current without rewriting it.
- `openapi.json`: generated API contract consumed by tools such as Hey API.
- `/api/openapi.json`: serves the generated document shape directly from the running Express app.
- `/api/docs`: serves Swagger UI for local, interactive API docs.
- `src/models`: public request/response schemas only. Do not put DB-only types here.
- `src/dtos` and `src/dtos/projections`: internal database and query result shapes.
- `src/types/dbTypes`: internal database write/input helper types that are not public API models.

## Boundary Rules

- Repositories return DTOs/projections and accept DB write shapes.
- Services perform business logic and return public models when the value is going directly to an API response.
- Controllers validate client input, set HTTP-specific behavior such as cookies/status codes, and return service results through `executeSafely`.
- OpenAPI schemas should reference public models, not DTOs.
- Give each endpoint a stable unique `operationId`; it determines generated SDK and query-helper names.
- Mark required request bodies explicitly.

Run `npm run api:generate` at the repository root to export OpenAPI and generate
the frontend SDK. Run `npm run api:check` to detect stale contracts or client
output without updating them. See [the full codegen workflow and findep
comparison](codegen-and-findep-comparison.md).

## Response Shape Notes

Responses use named objects instead of primitives where practical. For example, auth endpoints return `{ accessToken }`, and mutation-style endpoints return `{ success }`. This makes generated frontend types easier to understand and evolve.
