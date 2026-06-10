# Local Development

## Prerequisites

- Node.js 18+
- npm 8+
- MongoDB instance

## Setup

```bash
npm install
npm run dev
```

## Common Commands

```bash
npm run lint
npm run lint:fix
npm run db:migrate:status
npm run db:migrate:up
npm run db:migrate:down
npm run db:seed:session
npm run test:unit
```

## Environment

Configuration is read through `src/config/environment.js` and `.env`.
Do not hardcode secrets.
