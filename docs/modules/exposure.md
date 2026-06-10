# Exposure Domain

## Location

`src/domain/exposure`

## Responsibilities

- Maintain per-session, per-mode exposure snapshots.
- Convert placed bets into exposure deltas.
- Provide constant-time payout liability lookup for simulation.

## Core Components

- `SessionExposureState.js`: in-memory normalized state wrapper.
- `ExposureKeyRegistry.js`: maps game/template -> exposure key resolver.
- `ExposureDeltaGenerator.js`: converts bets into aggregated deltas.
- `ExposureLookupEngine.js`: computes candidate payout/profit from snapshot.

## Persistence

- Model: `src/infrastructure/models/SessionExposure.js`
- Repository: `src/infrastructure/repositories/sessionExposureRepository.js`
- Storage uses sparse maps (`singleExposure`, `jodiExposure`, `panaExposure`, `compositeExposure`) to avoid dense zero-filled arrays.
- Motor liabilities are expanded into `panaExposure` from bet snapshot (`generatedPanas`, `stakePerCombination`).
- Pana map keys use the shared zero-highest canonical format, so outcomes with `0` are stored like `120` instead of `012`.

## Safety Constraints

- Exposure updates run inside the same Mongo transaction as wallet debit + bet insert.
- Simulation uses exposure snapshots first and rebuilds from pending bets when a snapshot is absent.
- The rebuild path can materialize a fresh snapshot after simulation so later reads stay fast.

