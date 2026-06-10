# Admin Users

## Location

`src/modules/admin/users`

## Responsibilities

- List users and retrieve user details.
- Block/unblock user accounts.
- View per-user admin statistics.
- View per-user bets and transaction history.
- Edit or cancel pending user bets.
- Credit/debit wallet funds through idempotent wallet adjustments and reset passwords.
- Send admin notifications to selected users or all users.

## Route Prefix

`/admin/users`

## Endpoints

### User Management

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/` | List all users (paginated) |
| `GET` | `/{id}` | Get user details |
| `PATCH` | `/{id}/block` | Block user account |
| `PATCH` | `/{id}/unblock` | Unblock user account |

### Bet Management

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/{id}/bets` | List user's bets (paginated) |
| `PATCH` | `/{id}/bets/{betId}` | Edit pending bet (amount/selection) |
| `DELETE` | `/{id}/bets/{betId}` | Cancel pending bet and refund stake |

### Wallet & Transactions

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/{id}/wallet` | Get user wallet balance and history |
| `POST` | `/{id}/wallet-adjustments` | Adjust wallet (credit/debit) |
| `PATCH` | `/{id}/reset-password` | Reset user password |

### Notifications

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/notifications/send-to-users` | Send notification to selected users or all |

---

## Bet Editing Endpoint Details

**Endpoint:** `PATCH /admin/users/{userId}/bets/{betId}`

**Purpose:** Admin can modify pending bets (amount, selection) before result declaration.

**Requirements:**
- Bet status must be **PENDING** (cannot edit settled/cancelled bets)
- User must exist
- Request must include `idempotencyKey` for replay safety

**Request Body:**
```json
{
  "amount": 500.50,          // (optional) new bet amount in rupees
  "value": "123"             // (optional) new selection (pana/digit/jodi/motor)
}
```

**Request Example:**
```bash
curl -X PATCH 'http://localhost:5000/api/v1/admin/users/65a1b2c3d4e5f6g7h8i9j0k1/bets/65a1b2c3d4e5f6g7h8i9j0k2' \
  --header 'Authorization: Bearer YOUR_ADMIN_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
    "amount": 750.00,
    "value": "456"
  }'
```

**Motor bet expansion (list + edit):**
- SP Motor and DP Motor tickets are returned as **one API row per pana** (same projection as user bet history).
- Each row has a stable **`id` / `rowId`** (composite for motor: `{storedBetId}_{canonicalPana}`), a **`betId`** that always references the stored MongoDB bet document, and **`isExpanded`: true** with **`expansionKey`** set to that pana.
- **`amount`** on a row is the **line stake in INR**; **`totalAmount`** is the **full stored bet stake in INR** for that document.
- **`editScope`** is `row` when `isExpanded` is true, otherwise `bet`.
- **Editing a motor line:** `PATCH .../bets/{storedBetId}_{pana}` updates **only that line** on the same stored bet. Uneven stakes are persisted in `motorLineStakesPaise` (paise, server-side); totals and exposure are reconciled in one transaction. You may send **`amount`** (rupees) and/or **`value`** (a single canonical pana to replace that line).
- **Deleting a motor line:** `DELETE .../bets/{storedBetId}_{pana}` removes that pana from the ticket, refunds **that line’s stake**, and leaves one stored bet if any panas remain. Deleting the **last** line cancels the whole bet and refunds the **full** remaining stake.
- Composite ids are **only valid for motor** bets; using `{id}_{suffix}` on a non-motor bet returns a validation error.

**Example bet list row (motor, expanded):**
```json
{
  "id": "65a1b2c3d4e5f6g7h8i9j0k2_123",
  "rowId": "65a1b2c3d4e5f6g7h8i9j0k2_123",
  "betId": "65a1b2c3d4e5f6g7h8i9j0k2",
  "expansionKey": "123",
  "isExpanded": true,
  "editScope": "row",
  "amount": 10,
  "totalAmount": 30,
  "totalPayout": 0,
  "payout": 0,
  "selection": "123",
  "status": "pending"
}
```

**Example delete response (full ticket cancelled):**
```json
{
  "status": "success",
  "message": "User bet deleted",
  "data": {
    "id": "65a1b2c3d4e5f6g7h8i9j0k2",
    "rowId": "65a1b2c3d4e5f6g7h8i9j0k2",
    "betId": "65a1b2c3d4e5f6g7h8i9j0k2",
    "expansionKey": null,
    "isExpanded": false,
    "status": "cancelled",
    "refundedAmount": 30,
    "wallet": {
      "balance": 2500,
      "exposure": 500
    }
  }
}
```

---

## Bet Deletion Endpoint Details

**Endpoint:** `DELETE /admin/users/{userId}/bets/{betId}`

**Purpose:** Admin can cancel pending bets and fully refund the stake to user.

**Request Example:**
```bash
curl -X DELETE 'http://localhost:5000/api/v1/admin/users/65a1b2c3d4e5f6g7h8i9j0k1/bets/65a1b2c3d4e5f6g7h8i9j0k2' \
  --header 'Authorization: Bearer YOUR_ADMIN_TOKEN'
```

**Response Structure:**
```json
{
  "status": "success",
  "message": "User bet deleted",
  "data": {
    "betId": "65a1b2c3d4e5f6g7h8i9j0k2",
    "userId": "65a1b2c3d4e5f6g7h8i9j0k1",
    "amount": 75000,
    "refundedTo": "wallet",
    "status": "CANCELLED",
    "deletedAt": "2026-05-01T11:00:00Z"
  }
}
```

---

## Access Control
- Endpoints are protected by authenticated admin role checks.
- Middleware also hydrates normalized `roles` and `permissions` into `req.user`.

Pending:
- user support actions should move to explicit permission checks such as `USER_MANAGE` instead of relying only on coarse admin-role gates.
- sensitive actions such as fund adjustments and password resets should be reviewed for `SUPERADMIN`-only or higher-assurance policy where appropriate.

## Wallet Adjustment Contract

- `POST /admin/users/{id}/wallet-adjustments` is the canonical endpoint for admin balance changes.
- Requests require `idempotencyKey`, `reason`, and an explicit `operation` so repeated submissions can replay safely or conflict on mismatched payloads.
