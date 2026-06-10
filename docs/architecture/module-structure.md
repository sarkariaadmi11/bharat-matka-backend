# Module Structure

## Top-Level Modules

`src/modules` currently contains:
- `auth`
- `users`
- `bets`
- `wallet`
- `markets`
- `sessions`
- `results`
- `notifications`
- `payments`
- `system`
- `admin/*` (users, results, simulation, withdrawals, logs)

## Typical Module Layout

Most modules follow:
- `*.routes.js`
- `*.controller.js`
- `*.service.js`
- `*.validator.js`
- `*.openapi.js` (when documented in schema)

## Admin Namespace

Admin features are grouped under `src/modules/admin/<area>` and mounted through `/admin/*` routes.

## Route Mounting

Route composition happens in `src/app/routes.js`.
Each module is mounted under a stable path segment (for example `/auth`, `/bets`, `/sessions`, `/admin/results`).

## Supporting Layers

- Shared middleware: `src/middleware`
- Shared utilities: `src/utils`
- Shared infra contracts: `src/infrastructure/repositories`
- Domain engines: `src/domain/rule-engine`, `src/domain/exposure`, `src/domain/combinations`
