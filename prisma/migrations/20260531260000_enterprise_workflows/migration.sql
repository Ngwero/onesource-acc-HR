-- AlterTable
ALTER TABLE "CreditNote" ADD COLUMN "linkedReceivableId" TEXT;
ALTER TABLE "CreditNote" ADD COLUMN "linkedPayableId" TEXT;
ALTER TABLE "CreditNote" ADD COLUMN "appliedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;
