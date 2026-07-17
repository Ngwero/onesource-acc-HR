import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { createPgPool } from "../src/lib/pg";
import { seedDefaultPermissions } from "../src/services/permission.service";
import { ensureFiscalPeriods } from "../src/services/period.service";

const pool = createPgPool(process.env.DIRECT_URL || process.env.DATABASE_URL);
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding AgriBooks database...");

  // Units of measure
  const units = await Promise.all(
    [
      { code: "KG", name: "Kilogram" },
      { code: "TONNE", name: "Tonne" },
      { code: "CRATE", name: "Crate" },
      { code: "BAG", name: "Bag" },
      { code: "BOX", name: "Box" },
      { code: "BUNCH", name: "Bunch" },
      { code: "PIECE", name: "Piece" },
    ].map((u) => prisma.unitOfMeasure.upsert({ where: { code: u.code }, create: u, update: u }))
  );
  const kgUnit = units[0];

  // Stock locations
  const locations = await Promise.all(
    [
      { code: "WH-MAIN", name: "Main Warehouse" },
      { code: "FARM-CP", name: "Farm Collection Point" },
      { code: "COLD-RM", name: "Cold Room" },
      { code: "PROC-CTR", name: "Processing Center" },
      { code: "IN-TRANSIT", name: "In Transit" },
      { code: "EXPORT-SHP", name: "Export Shipment" },
    ].map((l) => prisma.stockLocation.upsert({ where: { code: l.code }, create: l, update: l }))
  );
  const mainWarehouse = locations[0];

  // Currencies
  const currencies = await Promise.all(
    [
      { code: "UGX" as const, name: "Uganda Shilling", symbol: "UGX" },
      { code: "USD" as const, name: "US Dollar", symbol: "$" },
      { code: "EUR" as const, name: "Euro", symbol: "€" },
      { code: "GBP" as const, name: "British Pound", symbol: "£" },
      { code: "KES" as const, name: "Kenyan Shilling", symbol: "KES" },
    ].map((c) => prisma.currency.upsert({ where: { code: c.code }, create: c, update: c }))
  );

  // Exchange rates
  for (const c of currencies.filter((c) => c.code !== "UGX")) {
    const rates: Record<string, number> = { USD: 3800, EUR: 4100, GBP: 4800, KES: 29 };
    await prisma.exchangeRate.create({
      data: {
        currencyId: c.id,
        rate: rates[c.code] || 1,
      },
    });
  }

  // Expense categories — codes must match EXPENSE_ACCOUNT_MAP in expense/approval routes
  const expenseCategories = [
    { code: "TRANSPORT", name: "Transport" },
    { code: "FUEL", name: "Fuel" },
    { code: "PACKAGING", name: "Packaging" },
    { code: "LABOUR", name: "Labour" },
    { code: "WAREHOUSE", name: "Warehouse" },
    { code: "COLD_STORAGE", name: "Cold Storage" },
    { code: "CERTIFICATION", name: "Certification" },
    { code: "INSPECTION", name: "Inspection" },
    { code: "INSURANCE", name: "Insurance" },
    { code: "MARKETING", name: "Marketing" },
    { code: "OFFICE", name: "Office" },
    { code: "BANK", name: "Bank Charges" },
    { code: "MISC", name: "Miscellaneous" },
  ];
  for (const cat of expenseCategories) {
    await prisma.expenseCategory.upsert({
      where: { code: cat.code },
      create: cat,
      update: { name: cat.name },
    });
  }

  // Chart of accounts — full basic set used by posting services
  const accounts = [
    { code: "1100", name: "Cash", accountType: "ASSET" as const },
    { code: "1110", name: "Bank", accountType: "ASSET" as const },
    { code: "1200", name: "Inventory", accountType: "ASSET" as const },
    { code: "1210", name: "Accumulated Depreciation", accountType: "ASSET" as const },
    { code: "1300", name: "Accounts Receivable", accountType: "ASSET" as const },
    { code: "1400", name: "Prepaid Expenses", accountType: "ASSET" as const },
    { code: "1500", name: "Fixed Assets", accountType: "ASSET" as const },
    { code: "2100", name: "Accounts Payable", accountType: "LIABILITY" as const },
    { code: "2200", name: "Loans Payable", accountType: "LIABILITY" as const },
    { code: "2300", name: "Taxes Payable", accountType: "LIABILITY" as const },
    { code: "2400", name: "Customer Credits", accountType: "LIABILITY" as const },
    { code: "3100", name: "Owner Capital", accountType: "EQUITY" as const },
    { code: "3200", name: "Retained Earnings", accountType: "EQUITY" as const },
    { code: "4100", name: "Local Sales Revenue", accountType: "INCOME" as const },
    { code: "4200", name: "Export Sales Revenue", accountType: "INCOME" as const },
    { code: "4300", name: "Exchange Gain", accountType: "INCOME" as const },
    { code: "5100", name: "Cost of Goods Sold", accountType: "COGS" as const },
    { code: "5200", name: "Transport Expense", accountType: "EXPENSE" as const },
    { code: "5210", name: "Fuel Expense", accountType: "EXPENSE" as const },
    { code: "5220", name: "Packaging Expense", accountType: "EXPENSE" as const },
    { code: "5230", name: "Labour Expense", accountType: "EXPENSE" as const },
    { code: "5240", name: "Warehouse Expense", accountType: "EXPENSE" as const },
    { code: "5250", name: "Cold Storage Expense", accountType: "EXPENSE" as const },
    { code: "5260", name: "Certification Expense", accountType: "EXPENSE" as const },
    { code: "5270", name: "Inspection Expense", accountType: "EXPENSE" as const },
    { code: "5280", name: "Insurance Expense", accountType: "EXPENSE" as const },
    { code: "5290", name: "Marketing Expense", accountType: "EXPENSE" as const },
    { code: "5300", name: "Office Expense", accountType: "EXPENSE" as const },
    { code: "5310", name: "Depreciation Expense", accountType: "EXPENSE" as const },
    { code: "5320", name: "Bank Charges", accountType: "EXPENSE" as const },
    { code: "5900", name: "Miscellaneous Expense", accountType: "EXPENSE" as const },
  ];
  for (const a of accounts) {
    await prisma.chartOfAccount.upsert({
      where: { code: a.code },
      create: a,
      update: { name: a.name, accountType: a.accountType },
    });
  }

  // Company settings
  const existingSettings = await prisma.companySetting.findFirst();
  if (!existingSettings) {
    await prisma.companySetting.create({
      data: {
        companyName: "One Source",
        address: "Plot 45, Nakawa Industrial Area, Kampala, Uganda",
        phone: "+256 700 123456",
        email: "info@agribooks.com",
        website: "https://agribooks.com",
        taxId: "TIN-1000123456",
        bankDetails: "Stanbic Bank - Account: 0123456789",
      },
    });
  }

  // Users — single Super Admin
  const passwordHash = await bcrypt.hash("Admin@123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "engwero@gmail.com" },
    create: {
      fullName: "Emmanuel Ngwero",
      email: "engwero@gmail.com",
      role: "SUPER_ADMIN",
      passwordHash,
      phone: "+256 700 000000",
    },
    update: {
      fullName: "Emmanuel Ngwero",
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      deletedAt: null,
    },
  });

  await seedDefaultPermissions();
  console.log("Role permissions seeded");

  // Produce
  const produceList = [
    { code: "PRD-001", name: "Coffee", category: "Beverages", buyingPrice: 8500, sellingPrice: 12000, exportPrice: 4.5 },
    { code: "PRD-002", name: "Avocado", category: "Fruits", buyingPrice: 2500, sellingPrice: 4000, exportPrice: 2.8 },
    { code: "PRD-003", name: "Pineapple", category: "Fruits", buyingPrice: 1500, sellingPrice: 2800, exportPrice: 1.5 },
    { code: "PRD-004", name: "Mangoes", category: "Fruits", buyingPrice: 1200, sellingPrice: 2200, exportPrice: 1.2 },
    { code: "PRD-005", name: "Fresh Chilli", category: "Vegetables", buyingPrice: 3000, sellingPrice: 5000, exportPrice: 3.0 },
    { code: "PRD-006", name: "Ginger", category: "Spices", buyingPrice: 4000, sellingPrice: 6500, exportPrice: 3.5 },
    { code: "PRD-007", name: "Onions", category: "Vegetables", buyingPrice: 1800, sellingPrice: 3000, exportPrice: 1.8 },
    { code: "PRD-008", name: "Beans", category: "Grains", buyingPrice: 3500, sellingPrice: 5000, exportPrice: 2.5 },
    { code: "PRD-009", name: "Maize", category: "Grains", buyingPrice: 1200, sellingPrice: 1800, exportPrice: 0.8 },
    { code: "PRD-010", name: "Cassava", category: "Tubers", buyingPrice: 800, sellingPrice: 1500, exportPrice: 0.6 },
    { code: "PRD-011", name: "Sugarcane", category: "Industrial", buyingPrice: 500, sellingPrice: 900, exportPrice: 0.4 },
    { code: "PRD-012", name: "Broccoli", category: "Vegetables", buyingPrice: 3500, sellingPrice: 5500, exportPrice: 3.2 },
    { code: "PRD-013", name: "Courgettes", category: "Vegetables", buyingPrice: 2000, sellingPrice: 3500, exportPrice: 2.0 },
  ];

  const createdProduce = [];
  for (const p of produceList) {
    const prod = await prisma.produce.upsert({
      where: { code: p.code },
      create: {
        ...p,
        unitOfMeasureId: kgUnit.id,
        minimumStockLevel: 100,
        shelfLifeDays: 14,
      },
      update: { name: p.name, buyingPrice: p.buyingPrice, sellingPrice: p.sellingPrice },
    });
    createdProduce.push(prod);
  }

  // Suppliers
  const suppliers = [
    { code: "SUP-001", name: "Mukasa Farmers Group", supplierType: "COOPERATIVE" as const, location: "Mukono" },
    { code: "SUP-002", name: "Green Valley Cooperative", supplierType: "COOPERATIVE" as const, location: "Mbale" },
    { code: "SUP-003", name: "Eastern Fresh Produce Ltd", supplierType: "COMPANY" as const, location: "Jinja" },
    { code: "SUP-004", name: "Kato Farm Supplies", supplierType: "FARMER" as const, location: "Masaka" },
    { code: "SUP-005", name: "Nile Agro Agents", supplierType: "AGENT" as const, location: "Arua" },
  ];

  const createdSuppliers = [];
  for (const s of suppliers) {
    const sup = await prisma.supplier.upsert({
      where: { code: s.code },
      create: { ...s, contactPerson: "Contact Person", phone: "+256 700 111111", paymentTerms: 30 },
      update: { name: s.name },
    });
    createdSuppliers.push(sup);
  }

  // Customers
  const ugxCurrency = currencies.find((c) => c.code === "UGX")!;
  const customers = [
    { code: "CUS-001", name: "Kampala Fresh Market", customerType: "LOCAL_BUYER" as const, country: "Uganda" },
    { code: "CUS-002", name: "Quality Supermarket", customerType: "SUPERMARKET" as const, country: "Uganda" },
    { code: "CUS-003", name: "UAE Fresh Imports LLC", customerType: "EXPORTER_IMPORTER" as const, country: "UAE" },
    { code: "CUS-004", name: "Kenya Produce Distributors", customerType: "DISTRIBUTOR" as const, country: "Kenya" },
    { code: "CUS-005", name: "London Organic Foods Ltd", customerType: "EXPORTER_IMPORTER" as const, country: "UK" },
  ];

  const createdCustomers = [];
  for (const c of customers) {
    const cust = await prisma.customer.upsert({
      where: { code: c.code },
      create: {
        ...c,
        currencyId: ugxCurrency.id,
        creditLimit: 5000000,
        paymentTerms: 30,
        contactPerson: "Contact",
        phone: "+256 700 222222",
      },
      update: { name: c.name },
    });
    createdCustomers.push(cust);
  }

  // Sample inventory
  for (const prod of createdProduce.slice(0, 5)) {
    await prisma.inventoryBatch.upsert({
      where: {
        produceId_grade_locationId_batchNumber: {
          produceId: prod.id,
          grade: "A",
          locationId: mainWarehouse.id,
          batchNumber: `BATCH-${prod.code}`,
        },
      },
      create: {
        produceId: prod.id,
        grade: "A",
        locationId: mainWarehouse.id,
        batchNumber: `BATCH-${prod.code}`,
        quantity: 500,
        unitCost: prod.buyingPrice,
        purchaseSource: createdSuppliers[0].name,
      },
      update: { quantity: 500 },
    });
  }

  // Sample purchase
  const existingPurchase = await prisma.purchase.findFirst();
  if (!existingPurchase) {
    await prisma.purchase.create({
      data: {
        purchaseNumber: "PUR-2026-00001",
        supplierId: createdSuppliers[0].id,
        totalAmount: 850000,
        status: "CONFIRMED",
        paymentStatus: "UNPAID",
        createdById: admin.id,
        approvedById: admin.id,
        approvedAt: new Date(),
        items: {
          create: [{
            produceId: createdProduce[0].id,
            grade: "A",
            quantity: 100,
            unitPrice: 8500,
            totalAmount: 850000,
            acceptedQuantity: 100,
          }],
        },
      },
    });
  }

  // Xero-style seed data
  const cashAccount = await prisma.chartOfAccount.findUnique({ where: { code: "1100" } });
  const bankGlAccount = await prisma.chartOfAccount.findUnique({ where: { code: "1110" } });

  const taxCodes = [
    { code: "VAT-18", name: "VAT 18%", rate: 18 },
    { code: "VAT-0", name: "Zero Rated", rate: 0 },
    { code: "EXEMPT", name: "Exempt", rate: 0 },
  ];
  for (const t of taxCodes) {
    await prisma.taxCode.upsert({
      where: { code: t.code },
      create: t,
      update: { name: t.name, rate: t.rate },
    });
  }

  const bankAccounts = [
    { code: "BANK-001", name: "Stanbic Operating Account", bankName: "Stanbic Bank", accountNumber: "0123456789", currentBalance: 15000000, glAccountId: bankGlAccount?.id },
    { code: "BANK-002", name: "Cash on Hand", bankName: "Cash", accountNumber: "CASH-001", currentBalance: 2500000, glAccountId: cashAccount?.id },
  ];
  for (const b of bankAccounts) {
    await prisma.bankAccount.upsert({
      where: { code: b.code },
      create: b,
      update: { currentBalance: b.currentBalance },
    });
  }

  const stanbic = await prisma.bankAccount.findUnique({ where: { code: "BANK-001" } });
  if (stanbic) {
    const existingTx = await prisma.bankTransaction.count({ where: { bankAccountId: stanbic.id } });
    if (existingTx === 0) {
      await prisma.bankTransaction.createMany({
        data: [
          { bankAccountId: stanbic.id, description: "Customer payment - Kampala Fresh", amount: 500000, type: "RECEIPT", reference: "RCP-001" },
          { bankAccountId: stanbic.id, description: "Supplier payment - Mukasa Farmers", amount: 350000, type: "PAYMENT", reference: "PMT-001" },
          { bankAccountId: stanbic.id, description: "Bank charges", amount: 15000, type: "FEE", reference: "FEE-JAN" },
        ],
      });
    }
  }

  if (createdCustomers[0]) {
    const existingQuote = await prisma.quote.findFirst();
    if (!existingQuote) {
      const vat18 = await prisma.taxCode.findUnique({ where: { code: "VAT-18" } });
      await prisma.quote.create({
        data: {
          quoteNumber: "QUO-2026-00001",
          customerId: createdCustomers[0].id,
          expiryDate: new Date(Date.now() + 30 * 86400000),
          subtotal: 400000,
          taxCodeId: vat18?.id,
          taxAmount: 72000,
          total: 472000,
          status: "SENT",
          createdById: admin.id,
          items: {
            create: [
              { description: "Avocado - Grade A (100kg)", quantity: 100, unitPrice: 4000, total: 400000 },
            ],
          },
        },
      });
    }
  }

  const existingRecurring = await prisma.recurringTemplate.findFirst({ where: { name: "Warehouse Rent" } });
  if (!existingRecurring) {
    await prisma.recurringTemplate.create({
      data: {
        name: "Warehouse Rent",
        type: "EXPENSE",
        frequency: "MONTHLY",
        nextRunDate: new Date(Date.now() + 30 * 86400000),
        amount: 800000,
        description: "Monthly warehouse rent",
      },
    });
  }

  const existingAsset = await prisma.fixedAsset.findFirst();
  if (!existingAsset) {
    await prisma.fixedAsset.create({
      data: {
        assetNumber: "FA-2026-00001",
        name: "Cold Storage Unit",
        category: "Equipment",
        purchaseDate: new Date("2024-06-01"),
        purchaseCost: 45000000,
        salvageValue: 5000000,
        usefulLifeMonths: 120,
        accumulatedDepreciation: 7500000,
        bookValue: 37500000,
      },
    });
  }

  const deptOps = await prisma.department.upsert({
    where: { code: "DEPT-OPS" },
    create: { code: "DEPT-OPS", name: "Operations", description: "Warehouse, procurement, and logistics" },
    update: { name: "Operations" },
  });
  const deptFinance = await prisma.department.upsert({
    where: { code: "DEPT-FIN" },
    create: { code: "DEPT-FIN", name: "Finance", description: "Accounting, payroll, and compliance" },
    update: { name: "Finance" },
  });
  const deptSales = await prisma.department.upsert({
    where: { code: "DEPT-SALES" },
    create: { code: "DEPT-SALES", name: "Sales & Export", description: "Local and export sales teams" },
    update: { name: "Sales & Export" },
  });

  const hrEmployees = [
    {
      employeeNumber: "EMP-2026-00001",
      fullName: "Emmanuel Ngwero",
      email: admin.email,
      departmentId: deptFinance.id,
      jobTitle: "Super Admin",
      baseSalary: 8000000,
      userId: admin.id,
    },
    {
      employeeNumber: "EMP-2026-00002",
      fullName: "John Okello",
      email: "procurement@agribooks.com",
      departmentId: deptOps.id,
      jobTitle: "Procurement Officer",
      baseSalary: 2800000,
    },
    {
      employeeNumber: "EMP-2026-00003",
      fullName: "Peter Ssebunya",
      email: "sales@agribooks.com",
      departmentId: deptSales.id,
      jobTitle: "Sales Officer",
      baseSalary: 2500000,
    },
  ];

  for (const emp of hrEmployees) {
    await prisma.employee.upsert({
      where: { employeeNumber: emp.employeeNumber },
      create: {
        ...emp,
        hireDate: new Date("2023-01-15"),
        createdById: admin.id,
      },
      update: { fullName: emp.fullName, jobTitle: emp.jobTitle, baseSalary: emp.baseSalary },
    });
  }

  const { ensureLeavePolicies, ensureEmployeeLeaveBalances } = await import("../src/services/hr.service");
  await ensureLeavePolicies();
  const allEmployees = await prisma.employee.findMany({ where: { deletedAt: null } });
  for (const emp of allEmployees) {
    await ensureEmployeeLeaveBalances(emp.id);
  }
  console.log("HR departments, employees, leave policies & balances seeded");

  const currentYear = new Date().getFullYear();
  await ensureFiscalPeriods(currentYear);
  await ensureFiscalPeriods(currentYear + 1);
  console.log(`Fiscal periods seeded for ${currentYear}–${currentYear + 1}`);

  console.log("Seed completed successfully!");
  console.log("\n--- Login Credentials ---");
  console.log("Super Admin: engwero@gmail.com");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
