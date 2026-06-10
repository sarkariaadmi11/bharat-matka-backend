# Betting Backend

Backend for a real-money betting platform built with Node.js, Express, and MongoDB.

## Overview

This service is a modular monolith with strict financial and domain boundaries:
- Wallet, bet placement, result declaration, and settlement are transaction-safe.
- Domain betting logic is centralized under `src/domain/rule-engine`.
- API modules are organized under `src/modules`.
- Persistence, queueing, and repositories are under `src/infrastructure`.

## Architecture Summary

Request flow:

`routes -> controllers -> services -> domain (pure rules) -> repositories -> models -> MongoDB`

Cross-cutting pieces:
- Middleware for auth, validation, rate limiting, and errors.
- Queue/task system for timed operations and background workflows.
- OpenAPI generation and UI served from `/openapi.json` and `/api-docs`.

Current engineering guardrails:
- Services should go through repositories for persistence access. Direct `repository.model` usage in `src/modules` and `src/middleware` is treated as an architectural regression.
- Authorization is centralized in `src/middleware/auth.js` and `src/modules/auth/authorization.service.js`.
- JWT access tokens emit normalized `roles` claims.
- Permissions exist and are hydrated into `req.user.permissions`, but most route protection is still role-based today.

Read: [System Overview](docs/architecture/system-overview.md)

## Folder Structure

```text
src/
  app/              # Express bootstrap, route mounting, server lifecycle
  config/           # Environment, constants, OpenAPI schema wiring
  domain/           # Rule engine and pure domain logic
  infrastructure/   # DB connection, repositories, models, queue, cache
  middleware/       # Auth, validation, logging, rate limiting, error handling
  modules/          # Feature modules (auth, bets, wallet, results, admin, ...)
  utils/            # Shared helpers and response utilities
docs/               # Engineering documentation
```

Detailed map: [Project Structure](docs/development/project-structure.md)

## Run Locally

Prerequisites:
- Node.js 20.x
- npm 8+
- MongoDB instance

Commands:

```bash
npm install
npm run dev
```

Husky hooks are for local development only. The `prepare` script runs `.husky/install.mjs`, which exits in production and CI so Render builds can run without `devDependencies`.

Server defaults to the configured `PORT` and mounts API at `/api/<API_VERSION>`.

Setup details: [Local Development](docs/development/local-development.md)

## Lint

```bash
npm run lint
npm run lint:fix
```

Lint policy and conventions: [Linting](docs/development/linting.md)

## Tests

Test suites:
- Unit: `npm run test:unit`
- Integration: `npm run test:integration`
- E2E: `npm run test:e2e`

Quality gates:
- Pre-commit: lint staged files + related tests
- Pre-push: full Jest suite
- PR CI: lint + full test + integration test
- Deploy CI: lint + unit + integration before deploy

Guide: [Testing](docs/development/testing.md)

## Documentation Index

- Start with:
  - [System Overview](docs/architecture/system-overview.md)
  - [Auth](docs/modules/auth.md)
  - [Clean Architecture](docs/architecture/clean-architecture.md)

- Architecture:
  - [System Overview](docs/architecture/system-overview.md)
  - [Clean Architecture](docs/architecture/clean-architecture.md)
  - [Module Structure](docs/architecture/module-structure.md)
  - [Rule Engine](docs/architecture/rule-engine.md)
- Modules:
  - [Auth](docs/modules/auth.md)
  - [Users](docs/modules/users.md)
  - [Bets](docs/modules/bets.md)
  - [Wallet](docs/modules/wallet.md)
  - [Payments](docs/modules/payments.md)
  - [Sessions](docs/modules/sessions.md)
  - [Results](docs/modules/results.md)
  - [Notifications](docs/modules/notifications.md)
- Admin:
  - [Admin Users](docs/admin/admin-users.md)
  - [Admin Results](docs/admin/admin-results.md)
  - [Admin Simulation](docs/admin/admin-simulation.md)
  - [Admin Withdrawals](docs/admin/admin-withdrawals.md)
  - [Admin Logs](docs/admin/admin-logs.md)
- Development:
  - [Local Development](docs/development/local-development.md)
  - [Project Structure](docs/development/project-structure.md)
  - [Coding Standards](docs/development/coding-standards.md)
  - [Linting](docs/development/linting.md)
  - [Testing](docs/development/testing.md)
- API:
  - [OpenAPI](docs/api/openapi.md)
  - [API Routing](docs/api/api-routing.md)
- Operations:
  - [Deployment](docs/operations/deployment.md)
  - [Logging](docs/operations/logging.md)
  - [Monitoring](docs/operations/monitoring.md)
- Guides:
  - [Adding a Module](docs/guides/adding-a-module.md)
  - [Adding an Endpoint](docs/guides/adding-an-endpoint.md)
