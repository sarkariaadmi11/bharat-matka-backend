# System Overview

## Purpose

This backend powers core betting operations: authentication, session lifecycle, bet placement, result declaration, settlement, wallet accounting, and admin control.

## Runtime Shape

- Entry points: `src/app/server.js`, `src/app/app.js`
- API base: `/api/<API_VERSION>`
- Health: `/health`
- OpenAPI JSON: `/openapi.json`
- OpenAPI UI: `/api-docs`

## Architectural Characteristics

- Modular monolith: modules are isolated by folder and service boundaries.
- Transaction-focused money flow: wallet-impacting operations run with MongoDB transactions.
- Rule-engine centralization: bet validation and evaluation rules live in the domain layer.
- Event-task background processing: timed operations use task scheduling and handlers.
- Repository boundary: services are expected to use repositories as the persistence boundary instead of reaching into models directly.
- Centralized authorization: token parsing and authorization decisions flow through `src/middleware/auth.js` and `src/modules/auth/authorization.service.js`.

## Core Flows

1. Bet placement: auth -> validation -> session eligibility -> wallet debit/exposure -> bet snapshot.
2. Open/close result declaration: admin endpoints -> rule validation -> session state progression.
3. Settlement: evaluate declared results -> mark won/lost -> wallet credits/debits -> transaction records.
4. Session automation: daily creation and timed lock/phase tasks.

## Source of Truth

- Session and domain constants: `src/config/constants/domain.js`
- Module entry routing: `src/app/routes.js`
- Domain engine: `src/domain/rule-engine/*`
- Persistence and task infra: `src/infrastructure/*`
- Authorization constants and seeds: `src/config/constants/roles.js`, `src/config/constants/permissions.js`, `src/config/seed-definitions/permissions.seed.js`

## Current Authorization State

- Role assignments are stored through `UserRole` and `RolePermission`.
- Middleware resolves a normalized `req.user` with `role`, `roles`, and `permissions`.
- JWT access tokens emit normalized `roles` claims.
- Route enforcement is still predominantly admin-role based through `requireAdmin` / `requireAdminAuth`.
- Permission-based checks exist in the authorization helper but are not yet the dominant route policy across admin modules.

## What Is Pending

- RBAC hardening:
  - replace broad "admin only" route checks with narrower role/permission checks where admin capabilities differ.
  - document which admin endpoints are intended for `ADMIN` versus `SUPERADMIN`.
- PBAC rollout:
  - move high-risk admin routes to explicit permission checks such as `RESULT_DECLARE`, `USER_MANAGE`, `PAYMENT_MANAGE`, and `REPORT_VIEW`.
  - reduce dependence on single coarse role checks for operational actions.
