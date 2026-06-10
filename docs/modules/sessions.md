# Sessions Module

## Location

`src/modules/sessions`

## Responsibilities

- Daily session creation workflows.
- Session lookup by date/market/id.
- Session locking and open-result declaration entrypoints.
- Status summaries for operational visibility.

## Routes

Mounted under `/sessions` and `/admin/sessions`.

## State Model

Session phases are defined in `src/config/constants/domain.js`:
- `open_running`
- `close_running`
- `market_closed`
- `settled`

## Operational Notes

Timed transitions rely on event tasks and should stay aligned with `src/infrastructure/queue` handlers.
