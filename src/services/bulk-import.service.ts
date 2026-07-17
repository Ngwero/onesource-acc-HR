import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { generateDocumentNumber } from "@/lib/utils";
import {
  produceSchema,
  supplierSchema,
  customerSchema,
  expenseSchema,
  purchaseSchema,
  saleSchema,
} from "@/lib/validations";
import { createAuditLog } from "@/services/audit.service";
import { createPurchase } from "@/services/purchase.service";
import { createSale } from "@/services/sale.service";
import { createExportSale, createExportShipment } from "@/services/export.service";
import { importBankTransactions } from "@/services/bank.service";
import { getBulkEntity, type BulkEntityId } from "@/lib/bulk-import-config";
import { num, optNum, str } from "@/lib/bulk-import-parser";
import type { UserRole } from "@/generated/prisma/client";

export interface BulkImportRowResult {
  row: number;
  success: boolean;
  message: string;
  recordId?: string;
}

export interface BulkImportResult {
  entity: BulkEntityId;
  dryRun: boolean;
  total: number;
  succeeded: number;
  failed: number;
  rows: BulkImportRowResult[];
}

class LookupCache {
  private units = new Map<string, string>();
  private produce = new Map<string, string>();
  private suppliers = new Map<string, string>();
  private customers = new Map<string, string>();
  private categories = new Map<string, string>();
  private bankAccounts = new Map<string, string>();

  async unitId(code: string) {
    const key = code.toUpperCase();
    if (!this.units.has(key)) {
      const unit = await prisma.unitOfMeasure.findUnique({ where: { code: key } });
      if (!unit) throw new Error(`Unit not found: ${code}`);
      this.units.set(key, unit.id);
    }
    return this.units.get(key)!;
  }

  async produceId(code: string) {
    const key = code.toUpperCase();
    if (!this.produce.has(key)) {
      const item = await prisma.produce.findFirst({ where: { code: key, deletedAt: null } });
      if (!item) throw new Error(`Produce not found: ${code}`);
      this.produce.set(key, item.id);
    }
    return this.produce.get(key)!;
  }

  async supplierId(code: string) {
    const key = code.toUpperCase();
    if (!this.suppliers.has(key)) {
      const item = await prisma.supplier.findFirst({ where: { code: key, deletedAt: null } });
      if (!item) throw new Error(`Supplier not found: ${code}`);
      this.suppliers.set(key, item.id);
    }
    return this.suppliers.get(key)!;
  }

  async customerId(code: string) {
    const key = code.toUpperCase();
    if (!this.customers.has(key)) {
      const item = await prisma.customer.findFirst({ where: { code: key, deletedAt: null } });
      if (!item) throw new Error(`Customer not found: ${code}`);
      this.customers.set(key, item.id);
    }
    return this.customers.get(key)!;
  }

  async categoryId(code: string) {
    const key = code.toUpperCase();
    if (!this.categories.has(key)) {
      const item = await prisma.expenseCategory.findUnique({ where: { code: key } });
      if (!item) throw new Error(`Expense category not found: ${code}`);
      this.categories.set(key, item.id);
    }
    return this.categories.get(key)!;
  }

  async bankAccountId(code: string) {
    const key = code.toUpperCase();
    if (!this.bankAccounts.has(key)) {
      const item = await prisma.bankAccount.findFirst({ where: { code: key, isActive: true } });
      if (!item) throw new Error(`Bank account not found: ${code}`);
      this.bankAccounts.set(key, item.id);
    }
    return this.bankAccounts.get(key)!;
  }
}

function ok(row: number, message: string, recordId?: string): BulkImportRowResult {
  return { row, success: true, message, recordId };
}

function fail(row: number, message: string): BulkImportRowResult {
  return { row, success: false, message };
}

function groupRows(rows: Record<string, unknown>[], key: string) {
  const groups = new Map<string, { rowIndex: number; row: Record<string, unknown> }[]>();
  rows.forEach((row, index) => {
    const groupKey = str(row, key);
    if (!groupKey) return;
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey)!.push({ rowIndex: index + 2, row });
  });
  return groups;
}

export async function runBulkImport(
  entityId: BulkEntityId,
  rows: Record<string, unknown>[],
  userId: string,
  userRole: UserRole,
  dryRun = false
): Promise<BulkImportResult> {
  const config = getBulkEntity(entityId);
  if (!config) throw new Error("Unknown import entity");

  const cache = new LookupCache();
  const results: BulkImportRowResult[] = [];

  switch (entityId) {
    case "produce":
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;
        try {
          const unitOfMeasureId = await cache.unitId(str(row, "unitCode"));
          const parsed = produceSchema.safeParse({
            code: str(row, "code"),
            name: str(row, "name"),
            category: str(row, "category"),
            unitOfMeasureId,
            grade: str(row, "grade") || undefined,
            buyingPrice: num(row, "buyingPrice"),
            sellingPrice: num(row, "sellingPrice"),
            exportPrice: optNum(row, "exportPrice"),
            minimumStockLevel: optNum(row, "minimumStockLevel"),
          });
          if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Validation failed");
          if (dryRun) {
            results.push(ok(rowNum, "Valid"));
            continue;
          }
          const existing = await prisma.produce.findUnique({ where: { code: parsed.data.code } });
          if (existing) throw new Error(`Code already exists: ${parsed.data.code}`);
          const produce = await prisma.produce.create({ data: parsed.data });
          await createAuditLog({ userId, action: "CREATE", module: "produce", recordId: produce.id, newValue: produce });
          results.push(ok(rowNum, "Created", produce.id));
        } catch (e) {
          results.push(fail(rowNum, e instanceof Error ? e.message : "Import failed"));
        }
      }
      break;

    case "suppliers":
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;
        try {
          const parsed = supplierSchema.safeParse({
            code: str(row, "code"),
            name: str(row, "name"),
            contactPerson: str(row, "contactPerson") || undefined,
            phone: str(row, "phone") || undefined,
            email: str(row, "email") || undefined,
            location: str(row, "location") || undefined,
            supplierType: str(row, "supplierType") || undefined,
            paymentTerms: optNum(row, "paymentTerms"),
          });
          if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Validation failed");
          if (dryRun) { results.push(ok(rowNum, "Valid")); continue; }
          const supplier = await prisma.supplier.create({ data: { ...parsed.data, email: parsed.data.email || null } });
          await createAuditLog({ userId, action: "CREATE", module: "suppliers", recordId: supplier.id, newValue: supplier });
          results.push(ok(rowNum, "Created", supplier.id));
        } catch (e) {
          results.push(fail(rowNum, e instanceof Error ? e.message : "Import failed"));
        }
      }
      break;

    case "customers":
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;
        try {
          const parsed = customerSchema.safeParse({
            code: str(row, "code"),
            name: str(row, "name"),
            contactPerson: str(row, "contactPerson") || undefined,
            phone: str(row, "phone") || undefined,
            email: str(row, "email") || undefined,
            country: str(row, "country") || undefined,
            customerType: str(row, "customerType") || undefined,
            creditLimit: optNum(row, "creditLimit"),
            paymentTerms: optNum(row, "paymentTerms"),
          });
          if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Validation failed");
          if (dryRun) { results.push(ok(rowNum, "Valid")); continue; }
          const customer = await prisma.customer.create({ data: { ...parsed.data, email: parsed.data.email || null } });
          await createAuditLog({ userId, action: "CREATE", module: "customers", recordId: customer.id, newValue: customer });
          results.push(ok(rowNum, "Created", customer.id));
        } catch (e) {
          results.push(fail(rowNum, e instanceof Error ? e.message : "Import failed"));
        }
      }
      break;

    case "expenses":
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;
        try {
          const categoryId = await cache.categoryId(str(row, "categoryCode"));
          const supplierCode = str(row, "supplierCode");
          const supplierId = supplierCode ? await cache.supplierId(supplierCode) : undefined;
          const parsed = expenseSchema.safeParse({
            categoryId,
            supplierId,
            amount: num(row, "amount"),
            date: str(row, "date") || undefined,
            description: str(row, "description") || undefined,
            currency: str(row, "currency") || undefined,
            paymentMethod: str(row, "paymentMethod") || undefined,
          });
          if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Validation failed");
          if (dryRun) { results.push(ok(rowNum, "Valid")); continue; }
          const expenseNumber = await generateDocumentNumber("EXP", prisma);
          const rate = parsed.data.exchangeRate || 1;
          const expense = await prisma.expense.create({
            data: {
              expenseNumber,
              categoryId: parsed.data.categoryId,
              supplierId: parsed.data.supplierId,
              date: parsed.data.date ? new Date(parsed.data.date) : new Date(),
              amount: parsed.data.amount,
              currency: parsed.data.currency || "UGX",
              exchangeRate: rate,
              ugxEquivalent: parsed.data.amount * rate,
              paymentMethod: parsed.data.paymentMethod || "BANK_TRANSFER",
              description: parsed.data.description,
              createdById: userId,
            },
          });
          results.push(ok(rowNum, "Created", expense.id));
        } catch (e) {
          results.push(fail(rowNum, e instanceof Error ? e.message : "Import failed"));
        }
      }
      break;

    case "purchases": {
      const groups = groupRows(rows, "supplierCode");
      for (const [, entries] of groups) {
        try {
          const supplierId = await cache.supplierId(str(entries[0].row, "supplierCode"));
          const items = await Promise.all(
            entries.map(async ({ row }) => ({
              produceId: await cache.produceId(str(row, "produceCode")),
              quantity: num(row, "quantity"),
              unitPrice: num(row, "unitPrice"),
              grade: str(row, "grade") || undefined,
            }))
          );
          const purchaseDate = str(entries[0].row, "purchaseDate") || undefined;
          const parsed = purchaseSchema.safeParse({ supplierId, purchaseDate, items });
          if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Validation failed");
          if (dryRun) {
            entries.forEach(({ rowIndex }) => results.push(ok(rowIndex, "Valid")));
            continue;
          }
          const purchase = await createPurchase(parsed.data, userId);
          entries.forEach(({ rowIndex }) => results.push(ok(rowIndex, `Purchase ${purchase?.purchaseNumber} created`, purchase?.id)));
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Import failed";
          entries.forEach(({ rowIndex }) => results.push(fail(rowIndex, msg)));
        }
      }
      break;
    }

    case "local_sales": {
      const groups = groupRows(rows, "customerCode");
      for (const [, entries] of groups) {
        try {
          const customerId = await cache.customerId(str(entries[0].row, "customerCode"));
          const items = await Promise.all(
            entries.map(async ({ row }) => ({
              produceId: await cache.produceId(str(row, "produceCode")),
              quantity: num(row, "quantity"),
              unitPrice: num(row, "unitPrice"),
              grade: str(row, "grade") || undefined,
            }))
          );
          const saleDate = str(entries[0].row, "saleDate") || undefined;
          const paymentMethod = str(entries[0].row, "paymentMethod") || undefined;
          const parsed = saleSchema.safeParse({ customerId, saleDate, paymentMethod, items });
          if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Validation failed");
          if (dryRun) {
            entries.forEach(({ rowIndex }) => results.push(ok(rowIndex, "Valid")));
            continue;
          }
          const sale = await createSale(parsed.data, userId);
          entries.forEach(({ rowIndex }) => results.push(ok(rowIndex, `Sale ${sale.saleNumber} created`, sale.id)));
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Import failed";
          entries.forEach(({ rowIndex }) => results.push(fail(rowIndex, msg)));
        }
      }
      break;
    }

    case "export_sales":
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;
        try {
          const customerId = await cache.customerId(str(row, "customerCode"));
          const produceId = await cache.produceId(str(row, "produceCode"));
          const quantity = num(row, "quantity");
          const exchangeRate = num(row, "exchangeRate");
          const unitExportPrice = num(row, "unitExportPrice");
          if (!quantity || !exchangeRate || !unitExportPrice) throw new Error("quantity, exchangeRate, and unitExportPrice are required");
          if (dryRun) { results.push(ok(rowNum, "Valid")); continue; }
          const sale = await createExportSale({
            customerId,
            produceId,
            quantity,
            currency: str(row, "currency") || "USD",
            exchangeRate,
            unitExportPrice,
            paymentTerms: optNum(row, "paymentTerms"),
            userId,
          });
          results.push(ok(rowNum, `Export sale ${sale.exportSaleNumber} created`, sale.id));
        } catch (e) {
          results.push(fail(rowNum, e instanceof Error ? e.message : "Import failed"));
        }
      }
      break;

    case "export_shipments":
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;
        try {
          const customerId = await cache.customerId(str(row, "customerCode"));
          const produceId = await cache.produceId(str(row, "produceCode"));
          const destinationCountry = str(row, "destinationCountry");
          if (!destinationCountry) throw new Error("destinationCountry is required");
          if (dryRun) { results.push(ok(rowNum, "Valid")); continue; }
          const costs = [];
          const freight = optNum(row, "costFreight");
          if (freight) costs.push({ costType: "Freight", amount: freight });
          const shipment = await createExportShipment({
            customerId,
            produceId,
            quantity: num(row, "quantity"),
            destinationCountry,
            destinationCity: str(row, "destinationCity") || undefined,
            freightMethod: str(row, "freightMethod") || "SEA",
            expectedRevenue: optNum(row, "expectedRevenue") || 0,
            costs,
            userId,
          });
          results.push(ok(rowNum, `Shipment ${shipment.shipmentNumber} created`, shipment.id));
        } catch (e) {
          results.push(fail(rowNum, e instanceof Error ? e.message : "Import failed"));
        }
      }
      break;

    case "purchase_orders": {
      const groups = groupRows(rows, "supplierCode");
      for (const [, entries] of groups) {
        try {
          const supplierId = await cache.supplierId(str(entries[0].row, "supplierCode"));
          const items = entries.map(({ row }) => {
            const quantity = num(row, "quantity");
            const unitPrice = num(row, "unitPrice");
            return {
              description: str(row, "description"),
              quantity,
              unitPrice,
              total: quantity * unitPrice,
            };
          });
          const subtotal = items.reduce((s, i) => s + i.total, 0);
          if (dryRun) {
            entries.forEach(({ rowIndex }) => results.push(ok(rowIndex, "Valid")));
            continue;
          }
          const poNumber = await generateDocumentNumber("PO", prisma);
          const po = await prisma.purchaseOrder.create({
            data: {
              poNumber,
              supplierId,
              expectedDate: str(entries[0].row, "expectedDate") ? new Date(str(entries[0].row, "expectedDate")) : undefined,
              subtotal,
              total: subtotal,
              createdById: userId,
              items: { create: items },
            },
          });
          entries.forEach(({ rowIndex }) => results.push(ok(rowIndex, `PO ${po.poNumber} created`, po.id)));
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Import failed";
          entries.forEach(({ rowIndex }) => results.push(fail(rowIndex, msg)));
        }
      }
      break;
    }

    case "tax":
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;
        try {
          const code = str(row, "code");
          const name = str(row, "name");
          const rate = num(row, "rate");
          if (!code || !name) throw new Error("code and name are required");
          if (dryRun) { results.push(ok(rowNum, "Valid")); continue; }
          const tax = await prisma.taxCode.create({
            data: { code, name, rate, description: str(row, "description") || undefined },
          });
          results.push(ok(rowNum, "Created", tax.id));
        } catch (e) {
          results.push(fail(rowNum, e instanceof Error ? e.message : "Import failed"));
        }
      }
      break;

    case "fixed_assets":
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;
        try {
          const name = str(row, "name");
          const category = str(row, "category");
          const purchaseDate = str(row, "purchaseDate");
          const purchaseCost = num(row, "purchaseCost");
          const usefulLifeMonths = num(row, "usefulLifeMonths");
          if (!name || !category || !purchaseDate || !purchaseCost || !usefulLifeMonths) {
            throw new Error("name, category, purchaseDate, purchaseCost, usefulLifeMonths are required");
          }
          if (dryRun) { results.push(ok(rowNum, "Valid")); continue; }
          const assetNumber = await generateDocumentNumber("FA", prisma);
          const asset = await prisma.fixedAsset.create({
            data: {
              assetNumber,
              name,
              category,
              purchaseDate: new Date(purchaseDate),
              purchaseCost,
              salvageValue: optNum(row, "salvageValue") || 0,
              usefulLifeMonths,
              bookValue: purchaseCost,
            },
          });
          results.push(ok(rowNum, `Asset ${asset.assetNumber} created`, asset.id));
        } catch (e) {
          results.push(fail(rowNum, e instanceof Error ? e.message : "Import failed"));
        }
      }
      break;

    case "recurring":
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;
        try {
          const type = str(row, "type").toUpperCase();
          const customerCode = str(row, "customerCode");
          const supplierCode = str(row, "supplierCode");
          if (dryRun) { results.push(ok(rowNum, "Valid")); continue; }
          const template = await prisma.recurringTemplate.create({
            data: {
              name: str(row, "name"),
              type: type as "INVOICE" | "BILL",
              frequency: str(row, "frequency").toUpperCase() as "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY",
              nextRunDate: new Date(str(row, "nextRunDate")),
              amount: num(row, "amount"),
              customerId: customerCode ? await cache.customerId(customerCode) : undefined,
              supplierId: supplierCode ? await cache.supplierId(supplierCode) : undefined,
              description: str(row, "description") || undefined,
            },
          });
          results.push(ok(rowNum, "Created", template.id));
        } catch (e) {
          results.push(fail(rowNum, e instanceof Error ? e.message : "Import failed"));
        }
      }
      break;

    case "bank_transactions": {
      const groups = groupRows(rows, "bankAccountCode");
      for (const [, entries] of groups) {
        try {
          const bankAccountId = await cache.bankAccountId(str(entries[0].row, "bankAccountCode"));
          const transactions = entries.map(({ row }) => ({
            date: str(row, "date"),
            description: str(row, "description"),
            amount: num(row, "amount"),
            type: str(row, "type").toUpperCase() as "DEPOSIT" | "WITHDRAWAL" | "FEE" | "INTEREST" | "TRANSFER" | "PAYMENT" | "RECEIPT",
            reference: str(row, "reference") || undefined,
          }));
          if (dryRun) {
            entries.forEach(({ rowIndex }) => results.push(ok(rowIndex, "Valid")));
            continue;
          }
          const result = await importBankTransactions(bankAccountId, transactions);
          entries.forEach(({ rowIndex }) => results.push(ok(rowIndex, `Imported batch ${result.batch}`, bankAccountId)));
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Import failed";
          entries.forEach(({ rowIndex }) => results.push(fail(rowIndex, msg)));
        }
      }
      break;
    }

    case "users":
      if (userRole !== "SUPER_ADMIN" && userRole !== "ADMIN" && userRole !== "MANAGER") {
        throw new Error("Only Super Admin, Admin, or Manager can bulk import users");
      }
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;
        try {
          const email = str(row, "email");
          const fullName = str(row, "fullName");
          const role = str(row, "role").toUpperCase() as UserRole;
          if (!email || !fullName || !role) throw new Error("fullName, email, and role are required");
          if (dryRun) { results.push(ok(rowNum, "Valid")); continue; }
          const existing = await prisma.user.findUnique({ where: { email } });
          if (existing) throw new Error(`Email already exists: ${email}`);
          const passwordHash = await hashPassword(str(row, "password") || "Admin@123");
          const newUser = await prisma.user.create({
            data: {
              fullName,
              email,
              phone: str(row, "phone") || undefined,
              passwordHash,
              role,
              status: "ACTIVE",
            },
          });
          results.push(ok(rowNum, "User created", newUser.id));
        } catch (e) {
          results.push(fail(rowNum, e instanceof Error ? e.message : "Import failed"));
        }
      }
      break;
  }

  const succeeded = results.filter((r) => r.success).length;
  return {
    entity: entityId,
    dryRun,
    total: rows.length,
    succeeded,
    failed: results.length - succeeded,
    rows: results.sort((a, b) => a.row - b.row),
  };
}
