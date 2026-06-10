# Wallet Module

## Location

`src/modules/wallet`

## Responsibilities

- Wallet balance retrieval.
- Transaction history retrieval.
- Bank account management.
- Admin credit adjustment endpoint.

## Routes

Mounted under `/wallet`.

## Response Contract

- Wallet summary endpoints return amounts in rupee.
- `/wallet` and `/my/wallet` should be treated as the same money-unit contract.
- Frontend should format rupee to INR locally for display.

## Safety Constraints

- Wallet mutations must be auditable with corresponding transaction entries.
- Any new wallet-changing operation must define idempotency and rollback behavior.
- All transaction writes now require explicit `transactionContext` so ledger origin and reference semantics are unambiguous.
