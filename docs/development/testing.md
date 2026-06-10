# Testing

## Test Layers

- Unit tests: `tests/unit`
- Integration tests: `tests/integration`
- E2E tests: `tests/e2e`

Current structure:

```text
tests/
  unit/
    domain/
      betting/
      rule-engine/
  integration/
    betting/
    wallet/
  e2e/
    bet-flow/
```

This aligns with architecture boundaries:
- `unit`: domain rules, pure logic, validators, utilities
- `integration`: module/service + repository + DB behavior
- `e2e`: API and multi-step financial workflows

Financial safety smoke coverage includes:
- Bet placement acceptance/rejection paths
- Wallet deduction and insufficient-balance rejection
- Result evaluation and winning/losing split
- Payout distribution for winners and losers
- Multi-scenario simulation profit/risk calculation

## Commands

```bash
npm run test
npm run test:watch
npm run test:coverage
npm run test:related -- <changed-files...>
npm run test:unit
npm run test:integration
npm run test:e2e
```

## Git Workflow Quality Gates

Expected local flow:
1. Developer writes code
2. `git commit`
3. Pre-commit hook runs:
   - `lint-staged`
   - related Jest tests for staged JS files
4. `git push`
5. Pre-push hook runs full Jest suite
6. CI runs full test matrix, including integration and e2e jobs

## CI Quality Gates

- PR workflow (`.github/workflows/ci.yml`):
  - `npm run lint`
  - `npm run test`
  - `npm run test:integration`
- Deploy workflow (`.github/workflows/deploy.yml`):
  - `npm run lint`
  - `npm run test:unit`
  - `npm run test:integration`
  - Deploy only if all checks pass

## Why This Decision

- Fast feedback on commit (`lint-staged` + related tests) reduces cycle time.
- Full suite on push protects mainline from cross-module regressions.
- Unit/integration/e2e split maps directly to modular-monolith boundaries and financial-risk controls.
- Explicit scripts remove hidden fallback behavior and make failures intentional.
