# Architecture Decision Record: Result-Financial Divergence

**Status:** Accepted  
**Decision timestamp:** 2026-04-23 23:21:27 +05:30  
**Authors:** Platform Engineering  
**Scope:** Result declaration, reset, revert, settlement, and reconciliation subsystems

---

## Summary

This document records the accepted architectural decision for how the platform
manages the deliberate separation between **result truth**, **financial truth**,
and **display truth**.  It explains why these three layers exist, why they can
diverge, and what admin responsibilities exist when they do.

> **Future reader warning:** If you are reading this because `currentResult`
> and `settledResult` show different values, or because winning history does not
> match wallet balances, **this is not a bug**.  Read this document before
> raising an incident or attempting a code fix.

---

## The Three Truth Layers

### 1. Result Truth (`currentResult`)

The current administrative declaration of what the result is.

- Set by `POST /admin/results/sessions/:id/open` and `.../close`
- Updated by `POST /admin/results/sessions/:id/reset-open` and `.../reset-close`
- Changes with every declaration and every reset
- **Does not automatically change wallet balances**

### 2. Financial Truth (`settledResult`)

The result that was in effect when financial settlement (bet payouts) ran.

- Set only by the settlement worker after a successful settlement job
- Never changed by a reset
- If reset happens after settlement, `settledResult` and `currentResult` diverge
- `isFinanciallyConsistent = false` when they diverge

### 3. Display Truth

What users see in winning history, result pages, and session detail.

- Always built from `currentResult`
- May diverge from wallet ledger after a reset
- **Does not imply wallet auto-adjustment**

---

## Why Reset Does Not Roll Back Wallet Balances

When an admin resets a result, the intent is to correct the displayed result.
It is **not** a rollback instruction.

Reasons:
1. Settlement may have already credited hundreds of users; reversing that would
   require debiting each winner's wallet, which may be impossible if the balance
   has been withdrawn.
2. The system cannot determine whether the "old" settlement was correct or
   incorrect without explicit admin reconciliation.
3. Auto-rollback on reset would make resets dangerous and non-recoverable.

**Admin responsibility after reset:**
If wallets need adjustment, use `POST /admin/users/:id/wallet-adjustments` for
each affected user with a clear `reason` and `idempotencyKey`.

---

## Why Settlement Is Async with Immediate Visibility

Settlement (evaluating all bets and crediting winners) is **asynchronous** —
it runs in a background worker — but it is **immediately visible** as
`settlementStatus: processing` from the moment the result is declared.

This design is chosen because:
1. Settlement for large sessions (10 000+ bets) may take several seconds.
2. The API response should not be blocked on completion of that work.
3. The admin UI must never show "unknown" status — `processing` is always set
   within the declaration transaction, before the API returns.

**Failure contract:**  
If the settlement worker fails, `settlementStatus = failed` and the
settlement job record holds the failure reason and revision.  The admin
must investigate and retry manually or trigger reconciliation.

---

## Why Revert Is Resumable, Not One Giant Transaction

A revert batch refunds the **stake** of pending bets in a session scope.

For a session with 10 000 pending bets, a single database transaction would:
- Hold write locks for potentially seconds
- Fail the entire operation on any single error, losing all progress
- Leave no recovery path — the admin must restart from zero

Instead, the system uses:
- A persisted `RevertBatch` document that tracks progress
- Chunked execution (100 bets per chunk, configurable via `REVERT_BATCH_CHUNK_SIZE`)
- Per-chunk independent commits
- A `lastProcessedCursor` (_id of last processed bet) for resume
- A `revertBatchId` field on each bet as a database-level double-refund guard

**If a crash occurs at bet 2 000/10 000:**
- The batch remains in `processing` or `failed`
- Bets 1–2 000 are safely refunded and marked
- Re-posting with the same `idempotencyKey` resumes from bet 2 001
- Bets 1–2 000 are skipped (not double-refunded)

---

## Admin Reconciliation Responsibilities

The system exposes consistency metadata on every session API response:

| Field | Meaning |
|---|---|
| `isFinanciallyConsistent` | false = currentResult ≠ settledResult |
| `settlementStatus` | pending / processing / completed / failed |
| `warning.code` | `RESULT_FINANCIAL_DIVERGENCE` when inconsistent |
| `warning.actionRequired` | true when admin must act |

**When `isFinanciallyConsistent = false`:**
1. Identify which bets were settled under the old result.
2. Determine which users were incorrectly credited or should have been.
3. Use `POST /admin/users/:id/wallet-adjustments` to make corrections.
4. Record the `reason` and `idempotencyKey` for each adjustment.
5. Update this ADR or a linked runbook with a post-incident summary.

---

## Winning History After Reset

Winning history is always built from `currentResult`, not from `settledResult`
or the wallet ledger.

**This means:**
- After a reset, the winning history may show a different result than what
  was financially settled.
- A user may appear to have "won" based on the displayed result but their
  wallet may reflect the previous settlement outcome.
- This is correct behaviour — it is the admin's job to reconcile if needed.

Public APIs **do not** expose `isFinanciallyConsistent` or divergence warnings
by default.  Admin APIs always do.

## Analytics and Reporting Interpretation

Admin analytics now formalizes the truth split instead of hiding it:

- `/admin/reports/winning-history` is display truth from `currentResult`
- `/admin/analytics/reports/profit-loss` is ledger truth from `transactions`
- `/admin/payments/deposits/history` is request truth from `payments`

Practical consequence:

1. Declare a result
2. Run settlement
3. Reset the result
4. Call winning history
5. Call profit/loss

Expected outcome:

- winning history changes because display truth changed
- profit/loss does not change because ledger truth did not
- `isFinanciallyConsistent = false`
- `warning.code = RESULT_FINANCIAL_DIVERGENCE`

This is expected system behavior, not a data corruption signal. Support and
operations should use the truth metadata first, then decide whether manual
reconciliation is required.

---

## Revert Is Stake-Only

Revert refunds **stake** (the amount the user bet) and cancels the bet.

Revert **does not** reverse settlement payouts.  If a bet was already won and
the user was credited a payout, the revert path does not apply to that bet.

Eligibility rules:
- Open-scope revert blocked after open result declaration
- Close-scope revert blocked after close result declaration
- Already-reverted bets are skipped (idempotent guard)
- Settlement payouts cannot be reverted via this path

---

## Related Documents

- `docs/admin/admin-results.md` — admin result API reference
- `docs/admin/admin-users.md` — wallet adjustment API reference
- `docs/modules/wallet.md` — ledger and transaction model
- `docs/modules/results.md` — result module architecture
- `docs/architecture/system-overview.md` — system-wide architecture

---

*This document must be updated if any of the above decisions are reversed or
supplemented by new product requirements.*
