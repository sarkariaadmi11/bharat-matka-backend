# Admin Simulation

## Location

`src/modules/admin/simulation`

## Responsibilities

- Simulate candidate outcomes prior to final result declaration.
- Support controlled outcome analysis for admin decisions.

## Quality Notes

- Simulation logic must remain deterministic for reproducible analysis.
- Any scoring/profit ranking policy changes require explicit review.
- Simulation should read precomputed session exposure snapshots for low-latency lookups.
- If a snapshot is missing, simulation may rebuild from pending bets and backfill the snapshot.
