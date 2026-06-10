# DP Motor

## Overview

`DP_MOTOR` lets the frontend generate motor combinations from digits, then place a bet using the final double-pana list selected by the user.

Example:
- Input digits: `[1,2,3]`
- Generated panas: `112`, `113`, `122`, `133`, `223`, `233`

## Limits

- Minimum digits: `3`
- Maximum digits: `6`
- Maximum combinations: `35`
- Digits must be integers in `0-9`
- Digits must be unique
- Generated panas use the canonical zero-highest format, so combinations containing `0` are stored with `0` last.

## API

### Generate combinations

`POST /motor/generate`

Auth: Bearer token required.

Request:

```json
{
  "type": "DP_MOTOR",
  "digits": [1, 2, 3]
}
```

Response:

```json
{
  "type": "DP_MOTOR",
  "digits": [1, 2, 3],
  "panas": ["112", "113", "122", "133", "223", "233"],
  "count": 6,
  "maxCombinations": 35
}
```

## Bet Placement

The betting API does not accept motor digits anymore. The frontend should call `POST /motor/generate`, allow the user to remove unwanted panas, then submit the remaining list to `/bets/place`.
Submitted motor panas must already be in canonical zero-highest order. Values like `011` with `0` first are rejected if they are not already canonical.

Example:

```json
{
  "sessionId": "SESSION_ID",
  "gameTypeId": "DP_MOTOR_ID",
  "bets": [
    {
      "value": { "panas": ["112", "122", "223"] },
      "amount": 30,
      "betMode": "open"
    }
  ]
}
```

## Bet Snapshot Behavior

DP motor is persisted as a single bet document with the submitted pana snapshot:

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
