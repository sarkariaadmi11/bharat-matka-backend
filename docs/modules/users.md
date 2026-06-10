# Users Module

## Location

`src/modules/users`

## Responsibilities

- User self-service profile endpoints.
- User-facing aggregation endpoints for wallet, transactions, and bets.
- User-facing deposit and withdrawal history endpoints.

## Routes

Mounted at root (`/`) and exposed as `/my/*` user endpoints.

## Notes

- These endpoints should remain read-heavy and avoid duplicating wallet/bet business logic from their owning modules.
- `/my/deposits` returns deposit request history from `Payment` with strict filtering by `status`, `provider`, `fromDate`, and `toDate`.
- `/my/withdrawals` returns withdrawal request history from `Payout` with strict filtering by `status`, `method`, `fromDate`, and `toDate`.
- Both history endpoints use a stable descending sort on `createdAt` and `_id`, apply pagination after final filtering and sorting, and return `{ data, meta }`.
- Sensitive withdrawal fields are masked before response mapping. Raw account numbers, full UPI IDs, IFSC, internal beneficiary IDs, idempotency keys, and internal references are not exposed.
