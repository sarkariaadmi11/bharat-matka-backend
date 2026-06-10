# Adding a Module

## Goal

Add a new feature module without breaking architecture boundaries.

## Steps

1. Create `src/modules/<module>`.
2. Add `*.routes.js`, `*.controller.js`, `*.service.js`, `*.validator.js` as needed.
3. Add `*.openapi.js` if the module exposes API endpoints.
4. Mount routes in `src/app/routes.js`.
5. Wire repositories/domain dependencies through services only.
6. Add/update docs in `docs/modules/` and related architecture pages.
7. Run `npm run lint`.
8. Run `npm run test`.
