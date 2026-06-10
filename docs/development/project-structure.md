# Project Structure

## Source Tree

```text
src/
  app/
  config/
  domain/
    rule-engine/
  infrastructure/
    cache/
    database/
    models/
    queue/
    repositories/
  middleware/
  modules/
    admin/
    auth/
    bets/
    markets/
    notifications/
    payments/
    results/
    sessions/
    system/
    users/
    wallet/
  utils/
```

## Responsibilities by Area

- `app`: startup and route aggregation.
- `modules`: feature entrypoints and use-case orchestration.
- `domain`: shared business rules and calculations.
- `infrastructure`: persistence and runtime adapters.
- `middleware` and `utils`: cross-cutting support.
