# Combination Engine

## Location

`src/domain/combinations`

## Responsibilities

- Generate deterministic combinations for motor game families.
- Keep combination expansion pure and strategy-based.
- Allow future game families to register new generation strategies.
- Keep generated panas in a centralized canonical format where digit `0` is treated as the highest digit and appears last.

## Core Components

- `CombinationEngine.js`: strategy registry and dispatcher.
- `SpMotorStrategy.js`: expands Single Pana Motor combinations.
- `DpMotorStrategy.js`: expands Double Pana Motor combinations.

## Integration Notes

- `POST /motor/generate` delegates frontend combination generation to `CombinationEngine`.
- Motor exposure uses persisted bet snapshots (`generatedPanas`, `stakePerCombination`) to keep liability deterministic after the frontend selects the final pana subset.
