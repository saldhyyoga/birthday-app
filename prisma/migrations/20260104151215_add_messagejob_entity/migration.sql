-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('BIRTHDAY', 'ANNIVERSARY');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "MessageJob" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "MessageType" NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "errorMessage" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "MessageJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MessageJob_scheduledAt_idx" ON "MessageJob"("scheduledAt");

-- CreateIndex
CREATE INDEX "MessageJob_userId_idx" ON "MessageJob"("userId");

-- AddForeignKey
ALTER TABLE "MessageJob" ADD CONSTRAINT "MessageJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
