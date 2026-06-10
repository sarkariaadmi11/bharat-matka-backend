# Monitoring

## Operational Signals

Track at minimum:
- API health (`/health` uptime and latency)
- Error rate by module
- Task queue depth and failed task count
- Settlement duration and failure count
- Withdrawal processing latency

## Alerting Priorities

- P1: failed settlement or repeated task processing failures
- P2: elevated API 5xx rates
- P3: delayed session automation and log cleanup failures

## Dashboard Recommendation

Create module-level dashboards aligned with route groups and critical background tasks.
