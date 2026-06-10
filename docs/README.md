# Documentation Index

This directory is organized by architecture concern:
- `architecture/`: high-level system design and boundaries.
- `modules/`: feature module behavior and responsibilities.
- `admin/`: admin workflows and constraints.
- `development/`: day-to-day engineering standards and setup.
- `api/`: OpenAPI and route registration guidance.
- `operations/`: runtime, logging, and monitoring guidance.
- `guides/`: implementation playbooks.

## Canonical Reading Order

Start here if you need the current architecture state instead of historical implementation detail:
- [System Overview](architecture/system-overview.md)
- [Auth Module](modules/auth.md)
- [Clean Architecture](architecture/clean-architecture.md)
- [Project Structure](development/project-structure.md)
- [Testing](development/testing.md)

## Current Consolidation Notes

- `modules/auth.md` is the canonical source for JWT, RBAC, and permission-model status.
- `architecture/clean-architecture.md` is the canonical source for service/domain/repository boundaries.
- Module docs describe business behavior; architecture docs describe system-wide rules. Avoid duplicating those rules in every module doc.
- Do not add new high-level architecture files when an update to one of the canonical docs above is enough.

## Deep Dives

- [AI Prompt Preface](guides/ai-prompt-preface.md)
- [Exposure Domain](modules/exposure.md)
- [Combination Engine](architecture/combination-engine.md)
- [SP Motor](games/sp-motor.md)
- [DP Motor](games/dp-motor.md)

