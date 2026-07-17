-- CreateTable
CREATE TABLE "Entity" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentEntityId" TEXT,
    "defaultCurrency" "CurrencyCode" NOT NULL DEFAULT 'UGX',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entity_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "CompanySetting" ADD COLUMN "entityId" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "creditBalance" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "Customer" ADD COLUMN "creditBalance" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "Purchase" ADD COLUMN "purchaseOrderId" TEXT;
ALTER TABLE "Purchase" ADD COLUMN "entityId" TEXT;
ALTER TABLE "Sale" ADD COLUMN "entityId" TEXT;
ALTER TABLE "Payable" ADD COLUMN "entityId" TEXT;
ALTER TABLE "Receivable" ADD COLUMN "entityId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "unallocatedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "JournalEntry" ADD COLUMN "entityId" TEXT;
ALTER TABLE "BankAccount" ADD COLUMN "entityId" TEXT;
ALTER TABLE "BankTransaction" ADD COLUMN "parentTransactionId" TEXT;
ALTER TABLE "BankTransaction" ADD COLUMN "isSplit" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PurchaseOrderItem" ADD COLUMN "quantityReceived" DECIMAL(18,3) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Entity_code_key" ON "Entity"("code");
CREATE INDEX "Entity_isActive_idx" ON "Entity"("isActive");
CREATE INDEX "Entity_isDefault_idx" ON "Entity"("isDefault");
CREATE UNIQUE INDEX "CompanySetting_entityId_key" ON "CompanySetting"("entityId");
CREATE INDEX "Purchase_purchaseOrderId_idx" ON "Purchase"("purchaseOrderId");
CREATE INDEX "Purchase_entityId_idx" ON "Purchase"("entityId");
CREATE INDEX "Sale_entityId_idx" ON "Sale"("entityId");
CREATE INDEX "Payable_entityId_idx" ON "Payable"("entityId");
CREATE INDEX "Receivable_entityId_idx" ON "Receivable"("entityId");
CREATE INDEX "JournalEntry_entityId_idx" ON "JournalEntry"("entityId");
CREATE INDEX "BankAccount_entityId_idx" ON "BankAccount"("entityId");
CREATE INDEX "BankTransaction_parentTransactionId_idx" ON "BankTransaction"("parentTransactionId");

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_parentEntityId_fkey" FOREIGN KEY ("parentEntityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompanySetting" ADD CONSTRAINT "CompanySetting_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payable" ADD CONSTRAINT "Payable_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_parentTransactionId_fkey" FOREIGN KEY ("parentTransactionId") REFERENCES "BankTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default entity
INSERT INTO "Entity" ("id", "code", "name", "defaultCurrency", "isActive", "isDefault", "updatedAt")
VALUES ('entity-main-default', 'MAIN', 'OneSource Main Entity', 'UGX', true, true, CURRENT_TIMESTAMP);

UPDATE "CompanySetting" SET "entityId" = 'entity-main-default' WHERE "entityId" IS NULL;
UPDATE "JournalEntry" SET "entityId" = 'entity-main-default' WHERE "entityId" IS NULL;
UPDATE "BankAccount" SET "entityId" = 'entity-main-default' WHERE "entityId" IS NULL;
UPDATE "Purchase" SET "entityId" = 'entity-main-default' WHERE "entityId" IS NULL;
UPDATE "Sale" SET "entityId" = 'entity-main-default' WHERE "entityId" IS NULL;
UPDATE "Payable" SET "entityId" = 'entity-main-default' WHERE "entityId" IS NULL;
UPDATE "Receivable" SET "entityId" = 'entity-main-default' WHERE "entityId" IS NULL;
