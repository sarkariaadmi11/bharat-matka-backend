# Scheduler

The app uses **node-cron** for in-process scheduling. Two jobs run on a fixed cadence.

---

## Jobs

| Job | Schedule | What it does |
|-----|----------|--------------|
| Daily Market Session Creator | `1 0 * * *` — 12:01 AM IST | Creates game sessions for all active markets at the start of each business day |
| Pending Tasks Processor | `*/10 * * * *` — every 10 min | Picks up and executes all due `EventTask` records (market locks, phase changes, settlements) |

All times are expressed in **IST (Asia/Kolkata)**. The server's physical timezone (Singapore / UTC+8) has no effect.

---

## Architecture

```
CronScheduler          — only file that knows about node-cron
  └─ registers jobs in ScheduledJobRunner
  └─ wires cron expressions → ScheduledJobRunner.trigger()

ScheduledJobRunner     — job registry + execution wrapper
  └─ concurrency guard (same job can't run twice simultaneously)
  └─ error-only logging (failures logged via pino; successes are silent)
  └─ trigger(jobName, triggeredBy) — called by cron OR the HTTP heartbeat

Jobs (src/infrastructure/scheduler/jobs/)
  └─ DailySessionCreation.job.js   → sessions.service.createDailySessionsForAllMarkets()
  └─ PendingTasksProcessor.job.js  → TaskRunner.run()
```

The `ScheduledJobRunner` has no knowledge of node-cron. Jobs have no knowledge of how they are triggered. This means:
- Swapping node-cron for another scheduler means changing **only** `CronScheduler.js`.
- External cron services (cronjob.org, Render cron jobs) can still trigger work via the HTTP heartbeat endpoint and the exact same code path executes.

---

## HTTP Heartbeat

`GET /api/v1/system/heartbeat`

Triggers the **Pending Tasks Processor** job with `triggeredBy: 'http'`. Intended for external uptime/cron services as a fallback or supplement. The endpoint returns immediately — job runs in the background.

---

## Failure handling

When a job throws, `ScheduledJobRunner` catches the error and logs it via pino:

```json
{
  "message": "scheduler.job_failed",
  "jobName": "Daily Market Session Creator",
  "triggeredBy": "cron",
  "error": { "name": "...", "message": "...", "stack": "..." }
}
```

Nothing else happens — no crash, no retry storm. The next cron tick will attempt the job again naturally.

---

## Adding a new job

1. Create `src/infrastructure/scheduler/jobs/YourJob.job.js`:
   ```js
   module.exports = {
     name: 'Your Human Friendly Job Name',
     description: 'What it does in one sentence',
     async run() {
       // call your service here
     },
   };
   ```

2. Add it to `SCHEDULES` in `CronScheduler.js`:
   ```js
   { job: YourJob, expression: '0 6 * * *' },
   ```

That's it. No changes to `ScheduledJobRunner` or anywhere else.
