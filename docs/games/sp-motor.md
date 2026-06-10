# SP Motor

## Overview

`SP_MOTOR` lets the frontend generate motor combinations from digits, then place a bet using the final single-pana list selected by the user.

Example:
- Input digits: `[1,2,3,4]`
- Generated panas: `123`, `124`, `134`, `234`

## Limits

- Minimum digits: `3`
- Maximum digits: `7`
- Maximum combinations: `35`
- Digits must be integers in `0-9`
- Digits must be unique
- Generated panas use the canonical zero-highest format, so combinations containing `0` are stored like `120` instead of `012`.

## API

### Generate combinations

`POST /motor/generate`

Auth: Bearer token required.

Request:

```json
{
  "type": "SP_MOTOR",
  "digits": [1, 2, 3, 4]
}
```

Response:

```json
{
  "type": "SP_MOTOR",
  "digits": [1, 2, 3, 4],
  "panas": ["123", "124", "134", "234"],
  "count": 4,
  "maxCombinations": 35
}
```

## Bet Placement

The betting API does not accept motor digits anymore. The frontend should call `POST /motor/generate`, allow the user to remove unwanted panas, then submit the remaining list to `/bets/place`.
Submitted motor panas must already be in canonical zero-highest order. Values like `012` are rejected.

Example:

```json
{
  "sessionId": "SESSION_ID",
  "gameTypeId": "SP_MOTOR_ID",
  "bets": [
    {
      "value": { "panas": ["123", "124", "234"] },
      "amount": 30,
      "betMode": "open"
    }
  ]
}
```

## Bet Snapshot Behavior

SP motor is persisted as a single bet document with the submitted pana snapshot:

- `generatedPanas: string[]`
- `combinationCount: number`
- `stakePerCombination: number`

Why: this keeps settlement deterministic and matches the exact subset the user selected.

## Exposure Behavior

Exposure is expanded at placement time inside the same DB transaction.

For each generated pana:

- liability increment = `stakePerCombination * oddsSnapshot`
- update `SessionExposure.panaExposure[pana] += liability`

This keeps admin simulation unchanged because it only reads precomputed exposure maps.
