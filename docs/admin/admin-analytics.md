# Admin Analytics

## Purpose

`/admin/analytics/*` is a read-only analytics surface for operations and support.
It exists to answer admin questions without mutating settlement, wallet, bet, or
audit state.

## Truth Model

Admin analytics intentionally exposes multiple truth layers because they do not
always move together:

- `currentResult`: current display truth used by winning-history style reports
- `settledResult`: result snapshot that was in force when settlement executed
- `transactions`: ledger truth for money movement
- `payments`: request truth for deposit lifecycle reporting

If `currentResult` changes after settlement, display reports and ledger reports
will diverge. That is expected. The API exposes:

- `isFinanciallyConsistent`
- `warning`
- `settlementStatus`

Use those fields before interpreting any session-derived analytics row.

## Canonical Endpoints

- `GET /admin/analytics/dashboard/summary`
- `GET /admin/analytics/markets/{marketId}/digits`
- `GET /admin/analytics/markets/{marketId}/bids`
- `GET /admin/analytics/reports/profit-loss`
- `GET /admin/reports/winning-history`

## Response Contract

Analytics endpoints return a strict envelope:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Market bid summary retrieved",
  "data": {},
  "pagination": null,
  "meta": {
    "generatedAt": "2026-04-24T10:00:00.000Z",
    "timezone": "Asia/Kolkata",
    "traceId": "req-123",
    "truthModel": {
      "displayTruth": "currentResult",
      "financialTruth": "transactions"
    }
  },
  "timestamp": "2026-04-24T10:00:00.000Z"
}
```

Validation and runtime failures use the analytics error envelope with stable
`error.code` values such as `ANALYTICS_VALIDATION_ERROR`.

## Guardrails

- Analytics is read-only. It must never trigger settlement, wallet mutation, or
  audit writes.
- Heavy endpoints are bounded.
  - `limit <= 100`
  - max date range is configurable and defaults to `30 days`
  - winning history requires `sessionDate` or `marketId`
- Dashboard summary is the only cached endpoint, and only for a short TTL.

## Deposit History Scope

`GET /admin/payments/deposits/history` reports deposit request truth from
`payments`.

- `summary.totalRequestedAmount` comes from filtered `Payment.amount`
- `summary.totalCreditedAmount` comes from successful `Payment` rows

This endpoint is not a ledger reconciliation report. If ledger reconciliation is
needed, it should be added as a separate transactions-based endpoint.
