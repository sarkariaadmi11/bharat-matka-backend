# Deployment

## Runtime

- Node.js process using `src/app/server.js` bootstrap.
- Target Node.js runtime: `20.x`.
- Environment variables loaded via `src/config/environment.js`.

## Recommended Deployment Checks

1. Run `npm ci` in CI and `npm ci --omit=dev` or `npm install --omit=dev` in production builds if you want a production-only install.
2. Run `npm run lint`.
3. Apply migrations with `npm run db:migrate:up` when needed.
4. Start with `npm run start:prod`.
5. Verify `/health` and `/openapi.json`.

## Notes

- GitHub Actions should install dev dependencies with `npm ci` so lint, Jest, and tooling remain available.
- Husky is a local development tool only. The `prepare` script delegates to `.husky/install.mjs`, which exits in `NODE_ENV=production` and CI, so Render or other production builds do not require the `husky` package.

## Post-Deploy Validation

- Confirm DB connectivity.
- Confirm task handlers initialize.
- Confirm log cleanup job starts.
