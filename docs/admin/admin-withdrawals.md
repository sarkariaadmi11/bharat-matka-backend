# Admin Withdrawals

## Location

`src/modules/admin/withdrawals`

## Responsibilities

- Review withdrawal requests.
- Approve/reject withdrawal workflow actions.
- Keep payout state transitions controlled and traceable.

## Route Prefix

`/admin/payments` and withdrawal-focused admin handlers.

## Safety Notes

- Approvals/rejections must remain transactional where wallet-impacting updates happen.
