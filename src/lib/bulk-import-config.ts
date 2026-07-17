import type { Module } from "@/lib/permissions";

export type BulkEntityId =
  | "produce"
  | "suppliers"
  | "customers"
  | "expenses"
  | "purchases"
  | "local_sales"
  | "export_sales"
  | "export_shipments"
  | "purchase_orders"
  | "tax"
  | "fixed_assets"
  | "recurring"
  | "bank_transactions"
  | "users";

export interface BulkColumn {
  key: string;
  label: string;
  required?: boolean;
  hint?: string;
}

export interface BulkEntityConfig {
  id: BulkEntityId;
  label: string;
  description: string;
  module: Module;
  columns: BulkColumn[];
  sampleRow: Record<string, string | number>;
  groupBy?: string;
}

export const BULK_ENTITIES: BulkEntityConfig[] = [
  {
    id: "produce",
    label: "Produce",
    description: "Agricultural produce master data",
    module: "produce",
    columns: [
      { key: "code", label: "Code", required: true },
      { key: "name", label: "Name", required: true },
      { key: "category", label: "Category", required: true },
      { key: "unitCode", label: "Unit Code", required: true, hint: "KG, TONNE, CRATE" },
      { key: "grade", label: "Grade", hint: "A, B, C, EXPORT_GRADE, LOCAL_GRADE" },
      { key: "buyingPrice", label: "Buying Price", required: true },
      { key: "sellingPrice", label: "Selling Price", required: true },
      { key: "exportPrice", label: "Export Price" },
      { key: "minimumStockLevel", label: "Min Stock Level" },
    ],
    sampleRow: {
      code: "PRD-010",
      name: "Passion Fruit",
      category: "Fruits",
      unitCode: "KG",
      grade: "A",
      buyingPrice: 3000,
      sellingPrice: 4500,
      exportPrice: 2.5,
      minimumStockLevel: 100,
    },
  },
  {
    id: "suppliers",
    label: "Suppliers",
    description: "Farmers, cooperatives, and supply companies",
    module: "suppliers",
    columns: [
      { key: "code", label: "Code", required: true },
      { key: "name", label: "Name", required: true },
      { key: "contactPerson", label: "Contact Person" },
      { key: "phone", label: "Phone" },
      { key: "email", label: "Email" },
      { key: "location", label: "Location" },
      { key: "supplierType", label: "Type", hint: "FARMER, COOPERATIVE, AGENT, COMPANY" },
      { key: "paymentTerms", label: "Payment Terms (days)" },
    ],
    sampleRow: {
      code: "SUP-010",
      name: "Mbarara Farmers Co-op",
      contactPerson: "John Okello",
      phone: "+256700000000",
      location: "Mbarara",
      supplierType: "COOPERATIVE",
      paymentTerms: 14,
    },
  },
  {
    id: "customers",
    label: "Customers",
    description: "Local buyers and export customers",
    module: "customers",
    columns: [
      { key: "code", label: "Code", required: true },
      { key: "name", label: "Name", required: true },
      { key: "contactPerson", label: "Contact Person" },
      { key: "phone", label: "Phone" },
      { key: "email", label: "Email" },
      { key: "country", label: "Country" },
      { key: "customerType", label: "Type", hint: "LOCAL_BUYER, SUPERMARKET, EXPORTER_IMPORTER" },
      { key: "creditLimit", label: "Credit Limit" },
      { key: "paymentTerms", label: "Payment Terms (days)" },
    ],
    sampleRow: {
      code: "CUS-010",
      name: "Kampala Fresh Market",
      contactPerson: "Sarah N.",
      phone: "+256700000001",
      country: "Uganda",
      customerType: "LOCAL_BUYER",
      creditLimit: 5000000,
      paymentTerms: 30,
    },
  },
  {
    id: "expenses",
    label: "Expenses",
    description: "Operating expenses by category",
    module: "expenses",
    columns: [
      { key: "categoryCode", label: "Category Code", required: true, hint: "TRANSPORT, FUEL, OFFICE" },
      { key: "amount", label: "Amount", required: true },
      { key: "date", label: "Date", hint: "YYYY-MM-DD" },
      { key: "description", label: "Description" },
      { key: "supplierCode", label: "Supplier Code" },
      { key: "currency", label: "Currency", hint: "UGX, USD" },
      { key: "paymentMethod", label: "Payment Method", hint: "CASH, BANK_TRANSFER" },
    ],
    sampleRow: {
      categoryCode: "TRANSPORT",
      amount: 150000,
      date: "2026-01-15",
      description: "Delivery to warehouse",
      currency: "UGX",
      paymentMethod: "BANK_TRANSFER",
    },
  },
  {
    id: "purchases",
    label: "Purchases",
    description: "Purchase orders grouped by supplier code (one purchase per supplier)",
    module: "purchases",
    groupBy: "supplierCode",
    columns: [
      { key: "supplierCode", label: "Supplier Code", required: true },
      { key: "produceCode", label: "Produce Code", required: true },
      { key: "quantity", label: "Quantity", required: true },
      { key: "unitPrice", label: "Unit Price", required: true },
      { key: "purchaseDate", label: "Purchase Date", hint: "YYYY-MM-DD" },
      { key: "grade", label: "Grade" },
    ],
    sampleRow: {
      supplierCode: "SUP-001",
      produceCode: "PRD-001",
      quantity: 500,
      unitPrice: 8500,
      purchaseDate: "2026-01-15",
      grade: "A",
    },
  },
  {
    id: "local_sales",
    label: "Local Sales",
    description: "Sales grouped by customer code (one sale per customer)",
    module: "local_sales",
    groupBy: "customerCode",
    columns: [
      { key: "customerCode", label: "Customer Code", required: true },
      { key: "produceCode", label: "Produce Code", required: true },
      { key: "quantity", label: "Quantity", required: true },
      { key: "unitPrice", label: "Unit Price", required: true },
      { key: "saleDate", label: "Sale Date", hint: "YYYY-MM-DD" },
      { key: "grade", label: "Grade" },
      { key: "paymentMethod", label: "Payment Method", hint: "CASH, BANK_TRANSFER" },
    ],
    sampleRow: {
      customerCode: "CUS-001",
      produceCode: "PRD-001",
      quantity: 100,
      unitPrice: 12000,
      saleDate: "2026-01-15",
      grade: "A",
      paymentMethod: "CASH",
    },
  },
  {
    id: "export_sales",
    label: "Export Sales",
    description: "International export sales (draft status)",
    module: "export_sales",
    columns: [
      { key: "customerCode", label: "Customer Code", required: true },
      { key: "produceCode", label: "Produce Code", required: true },
      { key: "quantity", label: "Quantity", required: true },
      { key: "currency", label: "Currency", required: true, hint: "USD, EUR, GBP" },
      { key: "exchangeRate", label: "Exchange Rate", required: true },
      { key: "unitExportPrice", label: "Unit Export Price", required: true },
      { key: "paymentTerms", label: "Payment Terms (days)" },
    ],
    sampleRow: {
      customerCode: "CUS-005",
      produceCode: "PRD-001",
      quantity: 1000,
      currency: "USD",
      exchangeRate: 3800,
      unitExportPrice: 4.5,
      paymentTerms: 30,
    },
  },
  {
    id: "export_shipments",
    label: "Export Shipments",
    description: "Export shipment tracking records",
    module: "export_shipments",
    columns: [
      { key: "customerCode", label: "Customer Code", required: true },
      { key: "produceCode", label: "Produce Code", required: true },
      { key: "quantity", label: "Quantity", required: true },
      { key: "destinationCountry", label: "Destination Country", required: true },
      { key: "destinationCity", label: "Destination City" },
      { key: "freightMethod", label: "Freight Method", hint: "SEA, AIR, ROAD" },
      { key: "expectedRevenue", label: "Expected Revenue (UGX)" },
      { key: "costFreight", label: "Freight Cost" },
    ],
    sampleRow: {
      customerCode: "CUS-005",
      produceCode: "PRD-001",
      quantity: 500,
      destinationCountry: "UK",
      destinationCity: "London",
      freightMethod: "SEA",
      expectedRevenue: 25000000,
      costFreight: 3500000,
    },
  },
  {
    id: "purchase_orders",
    label: "Purchase Orders",
    description: "POs grouped by supplier code",
    module: "purchase_orders",
    groupBy: "supplierCode",
    columns: [
      { key: "supplierCode", label: "Supplier Code", required: true },
      { key: "description", label: "Line Description", required: true },
      { key: "quantity", label: "Quantity", required: true },
      { key: "unitPrice", label: "Unit Price", required: true },
      { key: "expectedDate", label: "Expected Date", hint: "YYYY-MM-DD" },
    ],
    sampleRow: {
      supplierCode: "SUP-001",
      description: "Coffee Grade A",
      quantity: 200,
      unitPrice: 8500,
      expectedDate: "2026-02-01",
    },
  },
  {
    id: "tax",
    label: "Tax Codes",
    description: "VAT and tax rate codes",
    module: "tax",
    columns: [
      { key: "code", label: "Code", required: true },
      { key: "name", label: "Name", required: true },
      { key: "rate", label: "Rate %", required: true },
      { key: "description", label: "Description" },
    ],
    sampleRow: { code: "VAT18", name: "VAT 18%", rate: 18, description: "Standard VAT" },
  },
  {
    id: "fixed_assets",
    label: "Fixed Assets",
    description: "Asset register entries",
    module: "fixed_assets",
    columns: [
      { key: "name", label: "Name", required: true },
      { key: "category", label: "Category", required: true },
      { key: "purchaseDate", label: "Purchase Date", required: true },
      { key: "purchaseCost", label: "Purchase Cost", required: true },
      { key: "usefulLifeMonths", label: "Useful Life (months)", required: true },
      { key: "salvageValue", label: "Salvage Value" },
    ],
    sampleRow: {
      name: "Delivery Truck",
      category: "Vehicles",
      purchaseDate: "2025-06-01",
      purchaseCost: 85000000,
      usefulLifeMonths: 60,
      salvageValue: 5000000,
    },
  },
  {
    id: "recurring",
    label: "Recurring Templates",
    description: "Repeating invoices and bills",
    module: "recurring",
    columns: [
      { key: "name", label: "Name", required: true },
      { key: "type", label: "Type", required: true, hint: "INVOICE or BILL" },
      { key: "frequency", label: "Frequency", required: true, hint: "WEEKLY, MONTHLY, QUARTERLY, YEARLY" },
      { key: "nextRunDate", label: "Next Run Date", required: true },
      { key: "amount", label: "Amount", required: true },
      { key: "customerCode", label: "Customer Code", hint: "For INVOICE type" },
      { key: "supplierCode", label: "Supplier Code", hint: "For BILL type" },
      { key: "description", label: "Description" },
    ],
    sampleRow: {
      name: "Monthly Warehouse Rent",
      type: "BILL",
      frequency: "MONTHLY",
      nextRunDate: "2026-02-01",
      amount: 2500000,
      supplierCode: "SUP-003",
      description: "Warehouse rental",
    },
  },
  {
    id: "bank_transactions",
    label: "Bank Transactions",
    description: "Import bank statement lines grouped by bank account code",
    module: "bank",
    groupBy: "bankAccountCode",
    columns: [
      { key: "bankAccountCode", label: "Bank Account Code", required: true },
      { key: "date", label: "Date", required: true, hint: "YYYY-MM-DD" },
      { key: "description", label: "Description", required: true },
      { key: "amount", label: "Amount", required: true, hint: "Positive number" },
      { key: "type", label: "Type", required: true, hint: "DEPOSIT, WITHDRAWAL, FEE, PAYMENT, RECEIPT" },
      { key: "reference", label: "Reference" },
    ],
    sampleRow: {
      bankAccountCode: "BANK-UGX",
      date: "2026-01-15",
      description: "Customer payment",
      amount: 5000000,
      type: "DEPOSIT",
      reference: "REF-001",
    },
  },
  {
    id: "users",
    label: "Users",
    description: "System users (Admin/Manager only)",
    module: "users",
    columns: [
      { key: "fullName", label: "Full Name", required: true },
      { key: "email", label: "Email", required: true },
      { key: "role", label: "Role", required: true, hint: "ADMIN, ACCOUNTANT, SALES_OFFICER, etc." },
      { key: "phone", label: "Phone" },
      { key: "password", label: "Password", hint: "Defaults to Admin@123" },
    ],
    sampleRow: {
      fullName: "Jane Doe",
      email: "jane@agribooks.com",
      role: "SALES_OFFICER",
      phone: "+256700000002",
      password: "Admin@123",
    },
  },
];

export function getBulkEntity(id: string): BulkEntityConfig | undefined {
  return BULK_ENTITIES.find((e) => e.id === id);
}
