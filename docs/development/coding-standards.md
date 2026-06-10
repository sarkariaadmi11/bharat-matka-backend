# Coding Standards

## Core Principles

- Keep layer boundaries explicit.
- Keep domain logic centralized and deterministic.
- Keep controllers focused on HTTP boundary concerns.
- Keep services focused on orchestration.
- Keep repositories focused on data access.

## Style

- Follow ESLint rules from `eslint.config.js`.
- Prefer `const` over `let` unless reassignment is required.
- Avoid dead code and commented-out logic.
- Use explicit names over short ambiguous abbreviations.

## Change Safety

- Avoid business logic changes inside refactors.
- Keep commits scoped by module/concern.
- Update docs whenever behavior or architecture changes.
