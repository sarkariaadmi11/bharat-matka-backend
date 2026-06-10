# Auth Module

## Location

`src/modules/auth`

## Responsibilities

- User registration/login.
- Token refresh/logout workflows.
- Account deletion entrypoint.
- Role resolution and token claim generation.
- Authorization normalization for route middleware.

## Routes

Mounted under `/auth`.

## Current Design

- Token issuance is centralized in `src/modules/auth/auth.service.js` and `src/utils/token.js`.
- Request authorization is centralized in `src/middleware/auth.js`.
- Low-level authorization rules live in `src/modules/auth/authorization.service.js`.
- Role data is sourced from `UserRole`/`Role` and permission data from `RolePermission`/`Permission`.

## JWT Contract

- Access tokens include:
  - `roles`
- `roles` is the canonical claim for authorization decisions.
- Middleware can normalize either a single `role` claim or an array `roles` claim into uppercase `req.user.roles`.

Example token payload:

```json
{
  "sub": "user-id",
  "roles": ["ADMIN"]
}
```

## Current RBAC / PBAC State

- Current route protection is mostly RBAC with coarse checks such as `requireAdmin` or `requireAdminAuth`.
- Permission codes are seeded and loaded into `req.user.permissions`.
- The authorization helper already supports `anyRole` and `anyPermission`.
- In practice, most admin routes are not yet protected by fine-grained permission checks.

## Pending RBAC Work

- Replace broad admin-only checks on operational routes with explicit role intent where needed.
- Clarify which actions are `SUPERADMIN` only versus general `ADMIN`.
- Remove remaining assumptions that one string role is the only consumer-facing representation.

## Pending PBAC Work

- Move admin routes to permission-based checks using codes from `src/config/constants/permissions.js`.
- Prioritize high-risk flows:
  - result declaration and simulation
  - user fund adjustments and password resets
  - payout approval and payment configuration
  - admin reporting
  - broadcast notifications
- Document the permission matrix by route once route enforcement is migrated.

## Maintainability Rules

- Input validation stays in validators/middleware.
- Token creation and token-shape changes stay centralized in this module.
- Controllers and unrelated services should not decode or reinterpret JWT claim shape themselves.
- Authz changes should update this document and the architecture docs in the same change.
