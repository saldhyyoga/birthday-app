# Birthday Greeting Application

A robust NestJS application that sends birthday greeting emails to users at 9:00 AM in their local timezone. Built with PostgreSQL, Prisma, and designed for scalability and reliability.

## Features

- **Timezone-Aware Birthday Greetings**: Sends emails at exactly 9:00 AM in each user's local timezone
- **Automatic Recovery**: Catches up on missed messages if the service was down (within 24-hour recovery window)
- **Scalable Architecture**: Handles thousands of birthdays per day with batch processing
- **Race Condition Prevention**: Uses PostgreSQL `FOR UPDATE SKIP LOCKED` for atomic job claiming
- **Extensible Design**: Supports future message types (e.g., anniversaries)
- **Global Timezone Support**: Handles all IANA timezones including non-standard offsets (e.g., Nepal +05:45)

## Tech Stack

- **Framework**: NestJS 11
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Scheduling**: @nestjs/schedule (cron jobs)
- **Date Handling**: date-fns, date-fns-tz
- **HTTP Client**: Axios
- **Validation**: class-validator, class-transformer

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Birthday App                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐       │
│  │   User API   │    │  Job Scheduler   │    │   Job Worker     │       │
│  │  (REST CRUD) │    │  (Cron: ) 1 hour │    │  (Cron: */15min) │       │
│  └──────┬───────┘    └────────┬─────────┘    └────────┬─────────┘       │
│         │                     │                       │                  │
│         │                     │                       │                  │
│         ▼                     ▼                       ▼                  │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      PostgreSQL Database                         │    │
│  │  ┌─────────────────────┐    ┌────────────────────────────────┐  │    │
│  │  │       Users         │    │         MessageJobs            │  │    │
│  │  │ - id                │    │ - id                           │  │    │
│  │  │ - firstName         │◄───│ - userId (FK)                  │  │    │
│  │  │ - lastName          │    │ - type (BIRTHDAY/ANNIVERSARY)  │  │    │
│  │  │ - email             │    │ - scheduledAt                  │  │    │
│  │  │ - birthDate         │    │ - status (PENDING/PROCESSING/  │  │    │
│  │  │ - timezone          │    │          DONE/FAILED)          │  │    │
│  │  │ - nextBirthdayAtUtc │    │ - attempts / maxAttempts       │  │    │
│  │  └─────────────────────┘    └────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                       │                                  │
│                                       ▼                                  │
│                          ┌────────────────────────┐                      │
│                          │     Mail Service       │                      │
│                          │  (External Email API)  │                      │
│                          └────────────────────────┘                      │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. User Creation/Update Flow

```
User API Request → Validate Input → Calculate nextBirthdayAtUtc → Save to DB
                                           ↓
                            (If update: Delete pending jobs)
```

### 2. Job Scheduling Flow (Every hour)

```
Scheduler Cron → Find users with nextBirthdayAtUtc in next 24h → Create PENDING jobs
            ↓
            → Find users with missed birthdays (within recovery window) → Create recovery jobs
```

### 3. Job Processing Flow (Every 15 minutes)

```
Worker Cron → Claim jobs atomically (FOR UPDATE SKIP LOCKED) → Set status to PROCESSING
                                    ↓
                          Send email via Mail Service
                                    ↓
                    Success: Set DONE, Update nextBirthdayAtUtc
                    Failure: Increment attempts, Set FAILED or retry
```

## Database Schema

### User Model

| Field             | Type     | Description                                                    |
| ----------------- | -------- | -------------------------------------------------------------- |
| id                | UUID     | Primary key                                                    |
| firstName         | String   | User's first name                                              |
| lastName          | String   | User's last name                                               |
| email             | String   | Unique email address                                           |
| birthDate         | DateTime | User's birth date                                              |
| timezone          | String   | IANA timezone (e.g., "Asia/Kathmandu")                         |
| nextBirthdayAtUtc | DateTime | Pre-calculated next birthday at 9 AM local time, stored in UTC |

### MessageJob Model

| Field        | Type     | Description                           |
| ------------ | -------- | ------------------------------------- |
| id           | Int      | Auto-increment primary key            |
| userId       | String   | Foreign key to User                   |
| type         | Enum     | BIRTHDAY or ANNIVERSARY               |
| scheduledAt  | DateTime | When the message should be sent (UTC) |
| status       | Enum     | PENDING, PROCESSING, DONE, or FAILED  |
| attempts     | Int      | Current retry count                   |
| maxAttempts  | Int      | Maximum retries (default: 3)          |
| lastError    | String   | Last error message                    |
| errorMessage | JSON     | Detailed error information            |

**Unique Constraint**: `[userId, type, scheduledAt]` - Prevents duplicate jobs

## Getting Started

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- npm or yarn

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd birthday-app
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start PostgreSQL with Docker**

   ```bash
   docker-compose up -d
   ```

5. **Run database migrations**

   ```bash
   npx prisma migrate dev
   ```

6. **Generate Prisma client**

   ```bash
   npx prisma generate
   ```

7. **Start the application**

   ```bash
   # Development mode
   npm run start:dev

   # Production mode
   npm run build
   npm run start:prod
   ```

### Environment Variables

| Variable     | Description                  | Example                                           |
| ------------ | ---------------------------- | ------------------------------------------------- |
| DATABASE_URL | PostgreSQL connection string | postgresql://user:pass@localhost:5432/birthday_db |
| PORT         | Application port (optional)  | 3000                                              |

## API Endpoints

### User Management

#### Create User

```http
POST /user
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "birthDate": "1990-05-15",
  "timezone": "America/New_York"
}
```

#### Get User

```http
GET /user/:id
```

#### Update User

```http
PUT /user/:id
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Smith",
  "birthDate": "1990-05-16",
  "timezone": "Europe/London"
}
```

> **Note**: Updating `birthDate` or `timezone` automatically recalculates `nextBirthdayAtUtc` and deletes any pending jobs for the user.

#### Delete User

```http
DELETE /user/:id
```

> **Note**: Deleting a user cascades to delete all associated message jobs.

## Key Design Decisions

### 1. Pre-calculated `nextBirthdayAtUtc`

Instead of calculating birthdays on-the-fly, we pre-calculate and store the next birthday timestamp (at 9 AM local time) in UTC. This approach:

- **Enables efficient querying**: Simple range queries instead of complex timezone calculations
- **Supports indexing**: The `nextBirthdayAtUtc` field can be indexed for fast lookups
- **Handles timezone changes**: Automatically recalculated when user updates their timezone

```typescript
// Example: User in Nepal (UTC+05:45) with birthday on May 15
// Local 9 AM = 03:15 UTC
nextBirthdayAtUtc = '2025-05-15T03:15:00.000Z';
```

### 2. 15-Minute Cron Interval

The scheduler run every 1 hour and worker run every 15 minutes to handle non-standard timezone offsets:

- Nepal: UTC+05:45
- India: UTC+05:30
- Iran: UTC+03:30
- Myanmar: UTC+06:30

Running at `:00`, `:15`, `:30`, `:45` ensures all timezones are covered within their 15-minute window.

### 3. Atomic Job Claiming with `FOR UPDATE SKIP LOCKED`

To prevent race conditions when multiple workers process jobs:

```sql
UPDATE "MessageJob"
SET status = 'PROCESSING', "updatedAt" = NOW()
WHERE id IN (
  SELECT id FROM "MessageJob"
  WHERE status = 'PENDING'
    AND "scheduledAt" <= NOW()
  ORDER BY "scheduledAt"
  LIMIT 100
  FOR UPDATE SKIP LOCKED
)
RETURNING *
```

This ensures:

- **No duplicate processing**: Each job is claimed by exactly one worker
- **No blocking**: Workers skip locked rows instead of waiting
- **Scalability**: Multiple workers can run in parallel

### 4. Recovery System

The system automatically recovers from downtime:

1. **Scheduler** creates jobs for missed birthdays (within 24-hour recovery window)
2. **Worker** processes all pending jobs with `scheduledAt <= now()`
3. **User's `nextBirthdayAtUtc`** is updated to next year after successful delivery

### 5. Job Status State Machine

```
PENDING → PROCESSING → DONE
              ↓
           FAILED (after max attempts)
              ↓
           PENDING (retry if attempts < maxAttempts)
```

## Scalability Considerations

### Handling Thousands of Birthdays Daily

1. **Batch Processing**: Jobs are processed in batches (default: 100 per cycle)
2. **Cursor-based Pagination**: Efficient pagination for large job queues
3. **Indexed Queries**: `scheduledAt` and `userId` indexes for fast lookups
4. **Stateless Workers**: Multiple workers can run in parallel

### Future Improvements

1. **Horizontal Scaling**: Deploy multiple instances behind a load balancer
2. **Queue System**: Replace cron with Redis/Bull for real-time job processing
3. **Partitioning**: Partition `MessageJob` table by `scheduledAt` date
4. **Read Replicas**: Use read replicas for user queries

## Project Structure

```
birthday-app/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── migrations/            # Database migrations
├── src/
│   ├── filters/
│   │   └── prisma-exception-filter.ts  # Prisma error handling
│   ├── mail/
│   │   ├── mail.module.ts
│   │   └── mail.service.ts    # Email sending service
│   ├── message-job/
│   │   ├── message-job.module.ts
│   │   ├── message-job.scheduler.ts   # Job creation cron
│   │   └── message-job.worker.ts      # Job processing cron
│   ├── prisma/
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts  # Prisma client wrapper
│   ├── user/
│   │   ├── user.controller.ts # REST API endpoints
│   │   ├── user.dto.ts        # Request/Response DTOs
│   │   ├── user.module.ts
│   │   └── user.service.ts    # User business logic
│   ├── utils/
│   │   ├── calculate-nextbirthday.ts  # Birthday calculation
│   │   └── iana-validator.ts  # Timezone validation
│   ├── app.module.ts
│   └── main.ts
├── docker-compose.yml         # PostgreSQL container
├── .env                       # Environment variables
└── package.json
```

## Testing

```bash
# Unit tests
npm run test

# e2e tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Troubleshooting

### Common Issues

1. **Database connection failed**
   - Ensure PostgreSQL is running: `docker-compose up -d`
   - Check `DATABASE_URL` in `.env`

2. **Prisma client not found**
   - Run `npx prisma generate`

3. **Migrations out of sync**
   - Run `npx prisma migrate dev`

4. **Jobs not being processed**
   - Check worker logs for errors
   - Verify `scheduledAt` is in the past
   - Check job status is `PENDING`

### Viewing Database

```bash
# Open Prisma Studio
npx prisma studio
```

## License

MIT
