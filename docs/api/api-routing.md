# API Routing

## Entry Point

All API route mounting starts in `src/app/routes.js` and is prefixed in `src/app/app.js` with `/api/<API_VERSION>`.

## Module Mounts


Examples:
- `/auth`
- `/bets`
- `/wallet`
- `/markets`
- `/sessions`
- `/admin/results`
- `/admin/users`
- `/admin/payments`
- `/admin/logs`

## Routing Conventions

- Keep route files thin and declarative.
- Put middleware at route boundary.
- Delegate business decisions to services.
