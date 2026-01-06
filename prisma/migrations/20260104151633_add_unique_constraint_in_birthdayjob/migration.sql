/*
  Warnings:

  - A unique constraint covering the columns `[userId,type,scheduledAt]` on the table `MessageJob` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "MessageJob_userId_type_scheduledAt_key" ON "MessageJob"("userId", "type", "scheduledAt");
