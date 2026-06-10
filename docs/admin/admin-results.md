# Admin Results

## Location

`src/modules/admin/results`

## Responsibilities

- Declare open/close results with immediate settlement visibility.
- Reset open/close results (display correction only — no wallet changes).
- Create and execute resumable revert batches for pending bet stake refunds.
- Provide admin-focused result control endpoints with full consistency metadata.

## Route Prefix

`/admin/results`

## Endpoints

### Result Declaration

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/sessions/:sessionId/open` | Declare open result, create settlement job |
| `POST` | `/sessions/:sessionId/close` | Declare close result, create settlement job |

### Preview Winners (Before Declaration)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/sessions/:sessionId/preview-winners/:phase/:pana` | Preview who will win & payouts for a specific result before declaring |

### Result Reset (display correction only)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/sessions/:sessionId/reset-open` | Clear open result only; admin can declare a corrected result later |
| `POST` | `/sessions/:sessionId/reset-close` | Clear close result only; admin can declare a corrected result later |

### Revert Batches (stake refund)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/sessions/:sessionId/revert-batches` | Create + execute revert batch; idempotent via `idempotencyKey` |
| `GET`  | `/sessions/:sessionId/revert-batches` | List all batches for a session |
| `GET`  | `/revert-batches/:batchId` | Get status of a specific batch (polling) |

### Simulation

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/sessions/:sessionId/simulate` | Simulate top profitable outcomes |

---

## Preview Winners Endpoint Details

**Use Case:** Admin selects market + phase + specific pana and wants to see who will win and how much **before declaring the result**.

**Endpoint:** `GET /admin/results/sessions/:sessionId/preview-winners/:phase/:pana`

**Parameters:**
```
sessionId: ObjectId of the game session
phase: "OPEN_RUNNING" | "CLOSE_RUNNING"
pana: 3-digit string (e.g., "123")
page: page number (default: 1)
limit: items per page (default: 50)
```

**Request Example:**
```bash
curl -X GET 'http://localhost:5000/api/v1/admin/results/sessions/65a1b2c3d4e5f6g7h8i9j0k1/preview-winners/OPEN_RUNNING/456?page=1&limit=50' \
  --header 'Authorization: Bearer YOUR_ADMIN_TOKEN'
```

**Response shape (amounts are numbers in INR, not strings):**
```json
{
  "status": "success",
  "data": [
    {
      "id": "65a1b2c3d4e5f6g7h8i9j0k2",
      "betId": "65a1b2c3d4e5f6g7h8i9j0k2",
      "userId": "65a1b2c3d4e5f6g7h8i9j0k3",
      "username": "user123",
      "selection": "456",
      "betDigit": "456",
      "gameType": "SINGLE_PANA",
      "market": "KALYAN",
      "session": "Open",
      "isExpanded": false,
      "expansionKey": null,
      "motorLineHit": null,
      "betAmount": 500,
      "totalAmount": 500,
      "payout": 4500,
      "totalPayout": 4500,
      "createdAt": "2026-05-01T10:30:00Z"
    }
  ],
  "summary": {
    "totalWinningBets": 3,
    "totalPreviewRows": 3,
    "totalWinners": 3,
    "totalBets": 150,
    "totalLosingBets": 142,
    "totalWinningPayout": 36000
  },
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 3,
    "pages": 1
  },
  "previewInfo": {
    "sessionId": "65a1b2c3d4e5f6g7h8i9j0k1",
    "phase": "OPEN_RUNNING",
    "resultPana": "456",
    "resultDigit": "5",
    "market": "KALYAN",
    "marketId": "65a1b2c3d4e5f6g7h8i9j0k4",
    "previewedAt": "2026-05-01T11:00:00Z"
  }
}
```

**Key Points:**
- **No settlement happens** — this is a read-only preview
- All amounts in **Rupees format only** (e.g., "500.00", not paise)
- Includes **market, gameType, session** for UI display
- Automatically derives the **digit** from pana sum (e.g., 4+5+6=15 → digit=5)
- Evaluates all **pending bets** for the given session + phase
- Filters bets that **match the pana/digit** using `ResultEvaluator.isWinningBet()`
- Calculates payouts using `BettingRuleEngine.calculatePayout()`
- Returns **paginated** winner list with user, bet amount, and payout
- Summary includes **total exposure** (totalWinningPayout)
- **Motor preview rows:** For each **winning stored motor bet**, the API returns only the pana line that exactly matches the preview result. The pana and derived digit are treated as one unique winning combination, so sibling motor lines with the same resultant digit are not returned with zero payout.
- **Summary:** `totalWinningBets` is the number of stored bets that would win; `totalPreviewRows` (and legacy alias `totalWinners`) is the number of visible winning rows after motor line filtering; `totalWinningPayout` is the sum of per-ticket winning payouts.

---

## Safety Notes

- Declarations must be phase-valid.
- Open result can only be declared after the session open time has passed.
  If the scheduler is late, admin may still declare it in `close_running` or `market_closed`.
- Close result can only be declared after the session close time has passed,
  with open result already declared.
- **Revert is blocked after the result for the corresponding scope has been declared.**
  Open-scope revert is blocked after open result declaration.
  Close-scope revert is blocked after close result declaration.

---

## Contract Notes

### Declaration
- Asynchronous settlement with immediate visibility:
  the response includes `settlementStatus: processing` before settlement completes.
- Response always includes: `currentResult`, `settledResult`, `resultRevision`,
  `settlementJobId`, `settlementStatus`, `isFinanciallyConsistent`, `warning`.
- Declaration fails if the settlement job cannot be created (no silent orphaned declarations).

### Reset
- Requires only `reason` and optionally `expectedResultRevision` / `note`.
- Clears the selected displayed result instead of forcing a replacement pana in the same request.
- Creates a new `resultRevision`; does not roll back wallet or ledger state.
- Sets `isFinanciallyConsistent = false` and emits a structured `warning` when
  `currentResult` diverges from `settledResult`.
- Does not create a new settlement job.
- Resetting open also flips `openResultDeclared` back to `false` so the corrected
  open result can be declared through the normal workflow.

### Revert Batch
- Refunds **stake only** — does not reverse settled payouts.
- Execution is chunked and resumable: a crash leaves `lastProcessedCursor` intact
  so re-posting with the same `idempotencyKey` resumes from the safe point.
- Each bet carries `revertBatchId` as a database-level double-refund guard.
- Same `idempotencyKey` + same payload → replay/resume existing batch.
- Same `idempotencyKey` + different payload → `409 Conflict`.
- Concurrent batch on the same session → `409 Conflict`.

### Warning Object
When `isFinanciallyConsistent = false`, the `warning` field is always present:
```json
{
  "warning": {
    "code": "RESULT_FINANCIAL_DIVERGENCE",
    "message": "Current displayed result differs from the financially settled result...",
    "severity": "high",
    "actionRequired": true
  }
}
```
Admin UIs must color-code or raise alert banners on this warning.

---

## See Also

- `docs/architecture/result-financial-divergence.md` — business decision record
- `docs/admin/admin-users.md` — wallet adjustment API for post-reset reconciliation
