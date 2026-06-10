# Bets Module

## Location

`src/modules/bets`

## Responsibilities

- Bet placement.
- User bet listing/history.

## Routes

Mounted under `/bets`.
Primary endpoints include `/place` and `/my-bets`.

## Dependency Highlights

- Depends on session eligibility checks and rule-engine validation.
- Uses wallet and transaction repositories for financial operations.

## History Behavior

- `/bets/my-bets` keeps the existing flat response shape.
- Non-motor bets return one history item per stored bet document.
- Motor bets (`SP_MOTOR`, `DP_MOTOR`) are expanded into one history item per selected pana.
- Expanded motor items reuse the stored bet metadata and split the total stake equally across returned panas.
- For settled motor bets, history resolves status and payout per pana row. Only the actual winning pana is shown as `won`; the other selected panas are shown as `lost`.
- Expansion is response-only; DB storage, exposure, and settlement remain unchanged.
- Pagination is applied after expansion so the visible history page respects the requested `limit`.
- The `total` count still reflects the underlying stored bet count, not the expanded visible row count.

## Safety Constraints

- Never bypass session phase checks.
- Persist immutable bet snapshots for settlement correctness.
- Apply exposure deltas in the same DB transaction as wallet debit and bet insertion.
- Motor placement stores submitted pana snapshots for deterministic settlement.
- Pana values use the shared zero-highest canonical format across bet storage, exposure, and settlement.

