# Logging

## Components

- Request logging middleware: `src/middleware/requestLogger.js`
- Central logger utility: `src/utils/logger.js`
- Admin log query and cleanup: `src/modules/admin/logs/*`

## Guidelines

- Log domain-significant events (declarations, settlements, failures).
- Avoid logging secrets and raw credentials.
- Include IDs useful for traceability (userId, sessionId, betId, taskId).
