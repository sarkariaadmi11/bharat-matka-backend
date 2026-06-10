# Linting

## Configuration

Primary ESLint config: `eslint.config.js` (flat config).
The repository still contains `.eslintrc.json`, but `eslint.config.js` is the active source for ESLint v9 scripts.

## Commands

```bash
npm run lint
npm run lint:fix
npm run lint:staged
```

## Rules Emphasized

- Safety: `no-undef`, `no-unused-vars`, `eqeqeq`, `curly`
- Consistency: `semi`, `quotes`, `indent`, `comma-dangle`
- Maintainability: `prefer-const`, `no-var`, `no-else-return`

## Stability Policy

- Keep lint zero-error in CI.
- Resolve warnings in touched files during feature work.
- Do not disable rules without documented rationale.

## Git Hook Validation

This repository uses Husky hooks:
- Pre-commit: `npm run validate:precommit`
- Pre-push: `npm run validate:prepush`

Hook behavior:
- `validate:precommit` runs `lint-staged`, which performs:
  - ESLint fix on staged JS files.
  - Jest related tests only for staged JS files.
- `validate:prepush` runs full Jest suite (`npm run test`).
