import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const registerSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(6).optional(),
  role: z.enum([
    "SUPER_ADMIN",
    "ADMIN",
    "ACCOUNTANT",
    "PROCUREMENT_OFFICER",
    "SALES_OFFICER",
    "WAREHOUSE_OFFICER",
    "EXPORT_OFFICER",
    "MANAGER",
    "AUDITOR",
  ]).optional(),
});

export const produceSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  unitOfMeasureId: z.string(),
  grade: z.enum(["A", "B", "C", "EXPORT_GRADE", "LOCAL_GRADE"]).optional(),
  buyingPrice: z.number().min(0),
  sellingPrice: z.number().min(0),
  exportPrice: z.number().min(0).optional(),
  shelfLifeDays: z.number().optional(),
  storageRequirements: z.string().optional(),
  packagingType: z.string().optional(),
  minimumStockLevel: z.number().min(0).optional(),
});

export const supplierSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  location: z.string().optional(),
  supplierType: z.enum(["FARMER", "COOPERATIVE", "AGENT", "COMPANY"]).optional(),
  produceSupplied: z.string().optional(),
  paymentTerms: z.number().optional(),
  bankDetails: z.string().optional(),
  mobileMoney: z.string().optional(),
  taxId: z.string().optional(),
});

export const customerSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  customerType: z
    .enum([
      "LOCAL_BUYER",
      "SUPERMARKET",
      "HOTEL",
      "WHOLESALER",
      "EXPORTER_IMPORTER",
      "DISTRIBUTOR",
    ])
    .optional(),
  country: z.string().optional(),
  currencyId: z.string().optional(),
  paymentTerms: z.number().optional(),
  creditLimit: z.number().optional(),
  taxId: z.string().optional(),
});

export const purchaseItemSchema = z.object({
  produceId: z.string(),
  grade: z.enum(["A", "B", "C", "EXPORT_GRADE", "LOCAL_GRADE"]).optional(),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  acceptedQuantity: z.number().min(0).optional(),
  rejectedQuantity: z.number().min(0).optional(),
  rejectionReason: z.string().optional(),
  moistureLevel: z.number().optional(),
});

export const purchaseSchema = z.object({
  supplierId: z.string(),
  purchaseDate: z.string().optional(),
  transportCost: z.number().min(0).optional(),
  loadingCost: z.number().min(0).optional(),
  notes: z.string().optional(),
  items: z.array(purchaseItemSchema).min(1),
});

export const saleItemSchema = z.object({
  produceId: z.string(),
  grade: z.enum(["A", "B", "C", "EXPORT_GRADE", "LOCAL_GRADE"]).optional(),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
});

export const saleSchema = z.object({
  customerId: z.string(),
  saleDate: z.string().optional(),
  discount: z.number().min(0).optional(),
  taxAmount: z.number().min(0).optional(),
  deliveryCost: z.number().min(0).optional(),
  paymentMethod: z
    .enum(["CASH", "BANK_TRANSFER", "MOBILE_MONEY", "CHEQUE", "CARD"])
    .optional(),
  items: z.array(saleItemSchema).min(1),
});

export const expenseSchema = z.object({
  categoryId: z.string(),
  supplierId: z.string().optional(),
  date: z.string().optional(),
  amount: z.number().positive(),
  currency: z.enum(["UGX", "USD", "EUR", "GBP", "KES"]).optional(),
  exchangeRate: z.number().positive().optional(),
  paymentMethod: z
    .enum(["CASH", "BANK_TRANSFER", "MOBILE_MONEY", "CHEQUE", "CARD"])
    .optional(),
  produceId: z.string().optional(),
  shipmentId: z.string().optional(),
  department: z.string().optional(),
  description: z.string().optional(),
});

export const paymentSchema = z.object({
  amount: z.number().positive(),
  currency: z.enum(["UGX", "USD", "EUR", "GBP", "KES"]).optional(),
  exchangeRate: z.number().positive().optional(),
  paymentMethod: z
    .enum(["CASH", "BANK_TRANSFER", "MOBILE_MONEY", "CHEQUE", "CARD"])
    .optional(),
  payableId: z.string().optional(),
  receivableId: z.string().optional(),
  bankAccountId: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  allocations: z
    .array(
      z.object({
        payableId: z.string().optional(),
        receivableId: z.string().optional(),
        amount: z.number().positive(),
      })
    )
    .optional(),
});

export const approvalSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  comments: z.string().optional(),
});

export const journalSchema = z.object({
  description: z.string().min(1),
  reference: z.string().optional(),
  date: z.string().optional(),
  lines: z
    .array(
      z.object({
        debitAccountCode: z.string(),
        creditAccountCode: z.string(),
        amount: z.number().positive(),
        description: z.string().optional(),
      })
    )
    .min(1),
});

export const stockMovementSchema = z.object({
  produceId: z.string(),
  grade: z.enum(["A", "B", "C", "EXPORT_GRADE", "LOCAL_GRADE"]).optional(),
  fromLocationId: z.string().optional(),
  toLocationId: z.string().optional(),
  quantity: z.number().positive(),
  movementType: z.enum([
    "PURCHASE_RECEIPT",
    "SALE_DISPATCH",
    "EXPORT_ALLOCATION",
    "TRANSFER",
    "DAMAGE",
    "REJECTION",
    "ADJUSTMENT",
    "RETURN",
    "OPENING_STOCK",
  ]),
  reason: z.string().optional(),
  referenceDoc: z.string().optional(),
});

export const exportSaleSchema = z.object({
  customerId: z.string(),
  produceId: z.string(),
  grade: z.enum(["A", "B", "C", "EXPORT_GRADE", "LOCAL_GRADE"]).optional(),
  quantity: z.number().positive(),
  currency: z.enum(["UGX", "USD", "EUR", "GBP", "KES"]).optional(),
  exchangeRate: z.number().positive(),
  unitExportPrice: z.number().positive(),
  paymentTerms: z.number().optional(),
  expectedPaymentDate: z.string().optional(),
  shipmentId: z.string().optional(),
});

export const shipmentSchema = z.object({
  customerId: z.string(),
  produceId: z.string(),
  grade: z.enum(["A", "B", "C", "EXPORT_GRADE", "LOCAL_GRADE"]).optional(),
  quantity: z.number().positive(),
  destinationCountry: z.string(),
  destinationCity: z.string().optional(),
  freightMethod: z.enum(["AIR", "SEA", "ROAD"]).optional(),
  packagingDetails: z.string().optional(),
  numberOfPackages: z.number().optional(),
  containerNumber: z.string().optional(),
  billOfLading: z.string().optional(),
  shipmentDate: z.string().optional(),
  expectedArrivalDate: z.string().optional(),
  notes: z.string().optional(),
});

export const departmentSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  managerId: z.string().optional(),
});

export const employeeSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
  departmentId: z.string().optional(),
  userId: z.string().optional(),
  hireDate: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  address: z.string().optional(),
  nationalId: z.string().optional(),
  tin: z.string().optional(),
  nssfNumber: z.string().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
  baseSalary: z.number().min(0).optional(),
  allowances: z.number().min(0).optional(),
  status: z.enum(["ACTIVE", "ON_LEAVE", "PROBATION", "TERMINATED"]).optional(),
  probationEnd: z.string().optional(),
  terminationDate: z.string().optional(),
  terminationReason: z.string().optional(),
});

export const leaveRequestSchema = z.object({
  employeeId: z.string().min(1),
  leaveType: z.enum([
    "ANNUAL",
    "SICK",
    "UNPAID",
    "MATERNITY",
    "PATERNITY",
    "COMPASSIONATE",
    "OTHER",
  ]),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().optional(),
});

export const payRunSchema = z.object({
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  notes: z.string().optional(),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "MOBILE_MONEY", "CHEQUE", "CARD"]).optional(),
  employeeIds: z.array(z.string()).optional(),
});

export const attendanceSchema = z.object({
  employeeId: z.string().min(1),
  date: z.string().min(1),
  status: z.enum(["PRESENT", "ABSENT", "HALF_DAY", "LATE", "ON_LEAVE", "HOLIDAY"]),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  notes: z.string().optional(),
});

export const bulkAttendanceSchema = z.object({
  date: z.string().min(1),
  status: z.enum(["PRESENT", "ABSENT", "HALF_DAY", "LATE", "ON_LEAVE", "HOLIDAY"]),
  employeeIds: z.array(z.string()).optional(),
});

export const employeeDocumentSchema = z.object({
  title: z.string().min(1),
  category: z.string().optional(),
  fileName: z.string().optional(),
  fileUrl: z.string().optional(),
  notes: z.string().optional(),
});
