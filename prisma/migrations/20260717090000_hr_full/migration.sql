-- AlterEnum
ALTER TYPE "EmploymentStatus" ADD VALUE IF NOT EXISTS 'PROBATION';
ALTER TYPE "LeaveType" ADD VALUE IF NOT EXISTS 'PATERNITY';
ALTER TYPE "LeaveType" ADD VALUE IF NOT EXISTS 'COMPASSIONATE';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'HALF_DAY', 'LATE', 'ON_LEAVE', 'HOLIDAY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable Employee
ALTER TABLE "Employee"
  ADD COLUMN IF NOT EXISTS "dateOfBirth" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "gender" TEXT,
  ADD COLUMN IF NOT EXISTS "address" TEXT,
  ADD COLUMN IF NOT EXISTS "nationalId" TEXT,
  ADD COLUMN IF NOT EXISTS "tin" TEXT,
  ADD COLUMN IF NOT EXISTS "nssfNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "bankName" TEXT,
  ADD COLUMN IF NOT EXISTS "bankAccount" TEXT,
  ADD COLUMN IF NOT EXISTS "emergencyContact" TEXT,
  ADD COLUMN IF NOT EXISTS "emergencyPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "allowances" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "probationEnd" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "terminationDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "terminationReason" TEXT;

-- AlterTable PayRun
ALTER TABLE "PayRun"
  ADD COLUMN IF NOT EXISTS "totalDeductions" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "totalPaye" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "totalNssfEmployee" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "totalNssfEmployer" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- AlterTable PayRunItem
ALTER TABLE "PayRunItem"
  ADD COLUMN IF NOT EXISTS "basicPay" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "allowances" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "paye" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "nssfEmployee" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "nssfEmployer" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "otherDeductions" DECIMAL(18,2) NOT NULL DEFAULT 0;

UPDATE "PayRunItem" SET "basicPay" = "grossPay" WHERE "basicPay" = 0;

-- CreateTable LeavePolicy
CREATE TABLE IF NOT EXISTS "LeavePolicy" (
  "id" TEXT NOT NULL,
  "leaveType" "LeaveType" NOT NULL,
  "annualDays" DECIMAL(5,1) NOT NULL,
  "carryOverMax" DECIMAL(5,1) NOT NULL DEFAULT 0,
  "isPaid" BOOLEAN NOT NULL DEFAULT true,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeavePolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LeavePolicy_leaveType_key" ON "LeavePolicy"("leaveType");

-- CreateTable LeaveBalance
CREATE TABLE IF NOT EXISTS "LeaveBalance" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "leaveType" "LeaveType" NOT NULL,
  "year" INTEGER NOT NULL,
  "entitled" DECIMAL(5,1) NOT NULL,
  "used" DECIMAL(5,1) NOT NULL DEFAULT 0,
  "pending" DECIMAL(5,1) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeaveBalance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LeaveBalance_employeeId_leaveType_year_key" ON "LeaveBalance"("employeeId", "leaveType", "year");
CREATE INDEX IF NOT EXISTS "LeaveBalance_employeeId_year_idx" ON "LeaveBalance"("employeeId", "year");

-- CreateTable AttendanceRecord
CREATE TABLE IF NOT EXISTS "AttendanceRecord" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
  "checkIn" TIMESTAMP(3),
  "checkOut" TIMESTAMP(3),
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AttendanceRecord_employeeId_date_key" ON "AttendanceRecord"("employeeId", "date");
CREATE INDEX IF NOT EXISTS "AttendanceRecord_date_idx" ON "AttendanceRecord"("date");
CREATE INDEX IF NOT EXISTS "AttendanceRecord_status_idx" ON "AttendanceRecord"("status");

-- CreateTable EmployeeDocument
CREATE TABLE IF NOT EXISTS "EmployeeDocument" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'GENERAL',
  "fileName" TEXT,
  "fileUrl" TEXT,
  "notes" TEXT,
  "uploadedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployeeDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EmployeeDocument_employeeId_idx" ON "EmployeeDocument"("employeeId");

-- FKs
DO $$ BEGIN
  ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "EmployeeDocument" ADD CONSTRAINT "EmployeeDocument_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
