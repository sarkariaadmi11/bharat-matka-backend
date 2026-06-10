# OpenAPI

## Source

OpenAPI schema is assembled in:
- `src/config/openapi/openapi.js`
- `src/config/openapi/schema.js`
- module-level `*.openapi.js` files

Runtime exports in `docs/openapi.js` and UI helpers under `docs/openapiUi.js` / `docs/scalar/*`.

## Endpoints

- JSON: `/openapi.json`
- Versioned JSON: `/openapi/v1.json`
- UI: `/api-docs`

## Documentation Policy

When adding endpoints, update module OpenAPI fragments and confirm schema registration paths.

The new `/my/deposits` and `/my/withdrawals` account history endpoints use a standardized `{ data, meta }` response shape and are documented in `src/modules/users/users.openapi.js`.
