# Payments Module

`src/modules/payments`

## Scope

- Razorpay deposit order creation and verification
- UPI intent deposit initiation and app-resume verification flow
- Withdrawal request creation
- Payment transaction logs and payment-state transitions

## Boundary

- Payment lifecycle creation, verification, callback handling, and withdrawal request submission stay in `src/modules/payments`.
- User read-only history views are exposed from `/my/deposits` and `/my/withdrawals` in the users module.
- The older `/payments/deposits/history` endpoint remains transaction-oriented and should not be treated as the primary self-service history API.

## UPI Intent Deposit Flow

Frontend should treat the UPI deposit flow as a state machine driven by deposit endpoints, not by wallet endpoints.

### 1. Initiate deposit

Call:

- `POST /payments/deposits/initiate-upi`

Use response fields:

- `data.depositId`
- `data.merchantTxnId`
- `data.upi.upiUrl`

Open the returned `upiUrl` through deep linking into the UPI app.

### 2. App resumes after UPI app

When the user returns to the app, call:

- `POST /payments/deposits/upi-callback`

Send:

- `depositId`
- `statusFromClient`
- Any identifiers the UPI app returns, such as `txnRef`, `approvalRefNo`, `transactionId`, `responseCode`
- Optional raw payload in `rawResponse`

### 3. Interpret callback response

The callback response is the primary source of truth for what frontend should do next.

- `status === "success"`: deposit is credited; use `walletBalance`
- `status === "failed"`: show failure state
- `status === "submitted"` or `status === "verifying"`: poll the status endpoint
- `status === "manual_review"`: show pending/manual verification state

Important:

- `amount` is returned in INR for the deposit amount
- `walletBalance` is returned in rupee
- `walletBalance` is available for successful settlements, including idempotent or already-processed responses
- `alreadyProcessed: true` does not mean failure; it means the deposit was settled earlier and the response is safe to use as the final state

### 4. Poll while pending

If callback returns `submitted`, `verifying`, or if the app resumes without enough callback data, call:

- `GET /payments/deposits/:depositId/status`

Recommended frontend polling behavior:

1. Poll every 2 to 3 seconds
2. Stop on `success`, `failed`, or `manual_review`
3. Stop after a reasonable timeout and show a retry/status screen

### 5. Update wallet UI

On `success`:

- Update wallet UI from `data.walletBalance`
- Treat `data.walletBalance` as an INR value already
- Do not wait for a separate wallet fetch to confirm the deposit result

The wallet endpoint may still be fetched later for a full refresh, but deposit success should be driven by the deposit response itself.

## UPI Deposit Status Semantics

- `pending`: deposit created, no client confirmation yet
- `submitted`: client reported payment details, backend is waiting for stronger verification
- `verifying`: backend verification is in progress
- `manual_review`: payment needs manual validation
- `success`: wallet credited
- `failed`: payment failed or verification failed

## Response Contract

Callback and status endpoints return:

- `depositId`
- `amount`
- `currency`
- `merchantTxnId`
- `status`
- `verificationStatus`
- `clientStatus`
- `credited`
- `alreadyProcessed`
- `walletBalance`
- `message`
- `createdAt`
- `updatedAt`
- `creditedAt`
- `failedAt`

For frontend integration, treat `status`, `alreadyProcessed`, and `walletBalance` as the key fields.
