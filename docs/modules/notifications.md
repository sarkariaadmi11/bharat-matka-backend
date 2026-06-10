# Notifications Module

## Location

`src/modules/notifications`

## Responsibilities

- Device token registration and lifecycle updates.
- Result/event-triggered notification dispatch.

## Routes

Mounted under `/notifications`.

## Integration Notes

- Provider implementations are under `src/modules/notifications/providers`.
- Notification sending should not block core financial flows.
