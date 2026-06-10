# Rule Engine

## Location

`src/domain/rule-engine`

## Components

- `BettingRuleEngine.js`
- `GameTypeRegistry.js`
- `ExposureCalculator.js` (summary adapter)
- `ResultEvaluator.js`
- `src/domain/exposure/*` (transactional exposure + O(1) simulation lookup)
- `src/domain/combinations/*` (motor combination generation strategies)

## Why It Exists

The rule engine prevents drift by consolidating bet validation, exposure calculation, payout evaluation, and result checks in one domain layer.

## Boundaries

- Must remain deterministic and side-effect free.
- Must not query MongoDB directly.
- Must not depend on Express request/response state.

## Usage Pattern

Application services call domain APIs and pass normalized inputs. Repositories are used separately for persistence.

## Change Policy

When changing bet rules:
1. Update rule-engine behavior first.
2. Keep module services as orchestrators.
3. Add or update test cases in the domain test suite plan.

