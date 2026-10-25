# Backend Resource Pattern

This backend currently follows a layered resource pattern, even when people refer to it as a `route/controller/service` stack.

See [the data-flow walkthrough and findep comparison](data-flow-and-findep-comparison.md)
for concrete requests and [the type-safety policy](type-safety.md) for required checks.

For each new table-backed resource, generate the DB-backed DTO from the table schema:

- `src/dtos/<resource>.dto.ts`

Then add the persistence/API layers manually when the resource needs them:

- `src/repositories/<resource>.repository.ts`
- `src/routes/<resource>.route.ts`
- `src/controllers/<resource>.controller.ts`
- `src/services/<resource>.service.ts`

Follow the naming and endpoint examples below when adding a resource.

## Responsibilities

### Route

- Defines URL paths and HTTP verbs.
- Applies auth/authorization middleware when needed.
- Calls controller handlers.

### Controller

- Reads `params`, `body`, and `query`.
- Validates request input with public Zod models and passes typed input to services.
- Calls service methods.
- Returns responses through `executeSafely`.

### Service

- Holds resource-level business logic.
- Calls the repository layer.
- Returns public models for API-facing results, or counts/inserted IDs for mutations.
- Uses mappers to keep internal DTO fields out of public responses.

### Repository

- Contains SQL queries.
- Uses helpers from `src/config/db.ts`.
- Maps table operations to typed DTO results.

### DTO

- Defines DB-backed row types.
- DTOs usually extend `RowDataPacket`.
- Request models are not generated because API payloads can differ from table schemas. Add request-specific types manually in the appropriate API layer when needed.

## Naming Conventions

- Resource base name: use the same casing as the rest of `src/`.
- Files: `<resource>.<layer>.ts`
- Primary key: default pattern is `<resource>Id`
- Routes in `src/routes/index.ts`: usually plural path names

Examples:

- resource: `organization`
- route file: `organization.route.ts`
- DTO: `OrganizationDTO`
- service class: `OrganizationService`
- repository class: `OrganizationRepository`
- primary key: `organizationId`
- route mount: `/organizations`

## Endpoint Shape

The standard CRUD layout in this repo is:

- `GET /<resources>`
- `GET /<resources>/:<resource>Id`
- `POST /<resources>`
- `PUT /<resources>/:<resource>Id`
- `DELETE /<resources>/:<resource>Id`

Some resources can diverge when auth, nesting, or domain rules require it.

## Scaffold Command

Use the generator for DB-backed DTO types. By default, it creates `src/dtos/<resource>.dto.ts` with a placeholder primary key field:

```bash
npm run generate:resource -- organization
```

Common options:

```bash
npm run generate:resource -- cool
npm run generate:resource -- cool --from-db
npm run generate:resource -- cool --from-db --table coolTable --id coolId
npm run generate:resource -- cool --from-db --dry-run
```

Example commands for a `projectTask` table:

```bash
# Generate or update only the DTO from the DB table.
npm run generate:resource -- projectTask --from-db

# Preview the DTO generation without writing files.
npm run generate:resource -- projectTask --from-db --dry-run

# The generator runs npm run build automatically after writing files.
# Run tests after generation when behavior changed.
npm run test
```

Flags:

- `--table <tableName>`: SQL table name used for DB schema introspection
- `--id <fieldName>`: primary key field name
- `--from-db`: read table columns from the MySQL database configured in `.env`
- `--force`: overwrite generated files if they already exist
- `--dry-run`: print what would be created without writing files
- `--check`: compare generated content with the existing DTO, without writing or building

The old layer scaffold flags `--service`, `--controller`, `--route`, `--route-path`, and `--full` are intentionally unsupported. Add repositories and API layers separately so persistence behavior does not get overwritten when DTOs are regenerated from the database.

When `--from-db` is used, the generator reads `INFORMATION_SCHEMA.COLUMNS` using the app's `MYSQLHOST`, `MYSQLUSER`, `MYSQLPASSWORD`, and `MYSQLDATABASE` env vars. It uses the detected columns to generate DTO fields.

Rerunning `--from-db` updates the generated DTO from the current table schema.
Output is deterministic: regeneration no longer inserts a timestamp.
`--dry-run` prints full proposed contents; `--check` requires DB access when
combined with `--from-db`. See [the codegen walkthrough](codegen-and-findep-comparison.md)
for driver type mappings and the separate Hey API generation path.

Use `--force` when you intentionally want to overwrite an existing DTO.

After a successful non-dry-run generation, the script automatically runs `npm run build` so generated `dist/` files are updated immediately. `--dry-run` does not run the build.

## After Generation

The scaffold gives you consistent structure, but you still need to finish the resource:

- Replace placeholder DTO fields and SQL if you did not use `--from-db`.
- Add or update the repository manually for resource-specific SQL behavior.
- Add request-specific models manually if the API payload needs explicit typing.
- Add service/controller/route layers manually when the resource needs HTTP endpoints.
- Add auth/authorization middleware and tests when API behavior changes.

## Recommended Workflow

1. Add the migration for the new table.
2. Run the DTO generation command.
3. Use `--from-db` when possible so the DTO matches the real table schema.
4. Add or update the repository manually.
5. Add service/controller/route layers only when the table needs API endpoints.
6. Add middleware, nested route changes, and tests when API behavior changes.
