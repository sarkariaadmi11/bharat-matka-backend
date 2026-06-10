# Results Module

## Location

`src/modules/results` and `src/modules/admin/results`

## Responsibilities

- Public result retrieval endpoints.
- Admin result declaration and simulation workflows.
- Settlement orchestration and payout application.

## Core Services

- Result engine and simulation services.
- Settlement service for wallet and bet state updates.

## Safety Constraints

- Settlement correctness takes priority over throughput.
- Result declaration must respect session phase requirements.
- Payout calculations should use the shared domain engine.
- Admin simulation should consume `SessionExposure` snapshots first and rebuild from pending bets only when a snapshot is absent.

## Current Implementation Notes

- Result declaration persists a revisioned `currentResult` on the session.
- Settlement executes asynchronously through a dedicated `SettlementJob`, but the admin API returns `settlementStatus: processing` immediately after declaration.
- Financial truth is exposed separately as `settledResult`; callers must not assume `currentResult` implies wallet reconciliation.
