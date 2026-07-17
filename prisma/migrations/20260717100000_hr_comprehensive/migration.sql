-- AlterEnum
CREATE TYPE "JobOpeningStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'FILLED', 'CANCELLED');
CREATE TYPE "ApplicantStatus" AS ENUM ('APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN');
CREATE TYPE "ReviewStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ACKNOWLEDGED', 'CANCELLED');
CREATE TYPE "TrainingStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "DisciplinaryType" AS ENUM ('VERBAL_WARNING', 'WRITTEN_WARNING', 'FINAL_WARNING', 'SUSPENSION', 'TERMINATION', 'OTHER');
CREATE TYPE "ContractType" AS ENUM ('PERMANENT', 'FIXED_TERM', 'PROBATION', 'CONSULTANT', 'INTERN');
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED', 'RENEWED');
CREATE TYPE "ChecklistKind" AS ENUM ('ONBOARDING', 'OFFBOARDING');
CREATE TYPE "ChecklistItemStatus" AS ENUM ('PENDING', 'DONE', 'SKIPPED');

-- AlterTable Employee
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "reportsToId" TEXT;
CREATE INDEX IF NOT EXISTS "Employee_reportsToId_idx" ON "Employee"("reportsToId");
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_reportsToId_fkey" FOREIGN KEY ("reportsToId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable CompanyHoliday
CREATE TABLE IF NOT EXISTS "CompanyHoliday" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompanyHoliday_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CompanyHoliday_date_name_key" ON "CompanyHoliday"("date", "name");
CREATE INDEX IF NOT EXISTS "CompanyHoliday_date_idx" ON "CompanyHoliday"("date");

-- Remaining HR tables created via prisma db push; this file documents the comprehensive HR expansion.
