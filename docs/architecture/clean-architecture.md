# Clean Architecture

## Layering

Request lifecycle follows strict layers:

`routes -> controllers -> services -> domain -> repositories -> models -> database`

## Responsibilities

- Routes: endpoint registration and middleware composition.
- Controllers: HTTP boundary concerns (request parsing, response shape, transaction boundaries when needed).
- Services: application orchestration and use-case logic.
- Domain: pure rules and deterministic logic (no DB and no HTTP concerns).
- Repositories: data access abstraction around models.
- Infrastructure: queue, cache, database connection, and operational adapters.

## Dependency Rule

- Outer layers can depend on inner layers.
- Domain must not depend on Express, Mongoose models, or transport concerns.
- Controllers should not call models directly.
- Services should not reach into `repository.model` from feature modules. If a service needs a new query shape, add a repository method instead.

## Financial Safety Boundaries

- Wallet and settlement operations must be atomic and auditable.
- Transaction records are append-only accounting events.
- Rule changes should be centralized in domain services instead of duplicated in modules.

## Practical Enforcement

- Keep shared constants in `src/config/constants`.
- Keep cross-module, pure bet logic in `src/domain/rule-engine`.
- Use repository factory from `src/infrastructure/database` to isolate data access.
- Keep authz decisions centralized in middleware/helpers instead of embedding role strings throughout controllers and services.
- Treat documentation drift as architecture drift: update the canonical docs when changing repo boundaries, authz policy, or token semantics.
