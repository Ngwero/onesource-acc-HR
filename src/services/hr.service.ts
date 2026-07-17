import { prisma } from "@/lib/prisma";
import { generateDocumentNumber } from "@/lib/utils";
import { createAuditLog } from "./audit.service";
import { postPayrollJournal } from "./accounting.service";
import {
  computeUgandaPayroll,
  countLeaveDays,
  todayDateOnly,
} from "@/lib/payroll";
import type {
  LeaveType,
  EmploymentStatus,
  AttendanceStatus,
  PaymentMethod,
} from "@/generated/prisma/client";

const DEFAULT_LEAVE_POLICIES: Array<{
  leaveType: LeaveType;
  annualDays: number;
  carryOverMax: number;
  isPaid: boolean;
  description: string;
}> = [
  { leaveType: "ANNUAL", annualDays: 21, carryOverMax: 5, isPaid: true, description: "Paid annual leave" },
  { leaveType: "SICK", annualDays: 14, carryOverMax: 0, isPaid: true, description: "Sick leave" },
  { leaveType: "UNPAID", annualDays: 30, carryOverMax: 0, isPaid: false, description: "Unpaid leave" },
  { leaveType: "MATERNITY", annualDays: 60, carryOverMax: 0, isPaid: true, description: "Maternity leave" },
  { leaveType: "PATERNITY", annualDays: 4, carryOverMax: 0, isPaid: true, description: "Paternity leave" },
  { leaveType: "COMPASSIONATE", annualDays: 5, carryOverMax: 0, isPaid: true, description: "Compassionate leave" },
  { leaveType: "OTHER", annualDays: 5, carryOverMax: 0, isPaid: false, description: "Other leave" },
];

export async function ensureLeavePolicies() {
  for (const p of DEFAULT_LEAVE_POLICIES) {
    await prisma.leavePolicy.upsert({
      where: { leaveType: p.leaveType },
      create: p,
      update: {
        annualDays: p.annualDays,
        carryOverMax: p.carryOverMax,
        isPaid: p.isPaid,
        description: p.description,
      },
    });
  }
  return prisma.leavePolicy.findMany({ orderBy: { leaveType: "asc" } });
}

export async function ensureEmployeeLeaveBalances(employeeId: string, year = new Date().getFullYear()) {
  await ensureLeavePolicies();
  const policies = await prisma.leavePolicy.findMany();
  for (const policy of policies) {
    await prisma.leaveBalance.upsert({
      where: {
        employeeId_leaveType_year: {
          employeeId,
          leaveType: policy.leaveType,
          year,
        },
      },
      create: {
        employeeId,
        leaveType: policy.leaveType,
        year,
        entitled: Number(policy.annualDays),
        used: 0,
        pending: 0,
      },
      update: {},
    });
  }
  return prisma.leaveBalance.findMany({
    where: { employeeId, year },
    orderBy: { leaveType: "asc" },
  });
}

/** Restore employees whose approved leave window has ended. */
export async function syncEmployeeLeaveStatus() {
  const today = todayDateOnly();
  const onLeave = await prisma.employee.findMany({
    where: { status: "ON_LEAVE", deletedAt: null },
    select: { id: true },
  });

  for (const emp of onLeave) {
    const active = await prisma.leaveRequest.findFirst({
      where: {
        employeeId: emp.id,
        status: "APPROVED",
        startDate: { lte: today },
        endDate: { gte: today },
      },
    });
    if (!active) {
      await prisma.employee.update({
        where: { id: emp.id },
        data: { status: "ACTIVE" },
      });
    }
  }
}

export async function listDepartments() {
  return prisma.department.findMany({
    where: { isActive: true },
    include: {
      manager: { select: { id: true, fullName: true, employeeNumber: true } },
      _count: { select: { employees: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function createDepartment(
  data: { code: string; name: string; description?: string; managerId?: string },
  userId: string
) {
  const dept = await prisma.department.create({ data });
  await createAuditLog({
    userId,
    action: "CREATE",
    module: "employees",
    recordId: dept.id,
    newValue: dept,
  });
  return dept;
}

export async function updateDepartment(
  id: string,
  data: Partial<{ code: string; name: string; description: string; managerId: string | null; isActive: boolean }>,
  userId: string
) {
  const dept = await prisma.department.update({ where: { id }, data });
  await createAuditLog({ userId, action: "UPDATE", module: "employees", recordId: id, newValue: data });
  return dept;
}

export async function listEmployees(options?: {
  departmentId?: string;
  status?: EmploymentStatus;
  search?: string;
}) {
  await syncEmployeeLeaveStatus();
  return prisma.employee.findMany({
    where: {
      deletedAt: null,
      ...(options?.departmentId && { departmentId: options.departmentId }),
      ...(options?.status && { status: options.status }),
      ...(options?.search && {
        OR: [
          { fullName: { contains: options.search, mode: "insensitive" } },
          { employeeNumber: { contains: options.search, mode: "insensitive" } },
          { email: { contains: options.search, mode: "insensitive" } },
          { jobTitle: { contains: options.search, mode: "insensitive" } },
        ],
      }),
    },
    include: {
      department: true,
      user: { select: { id: true, email: true, role: true } },
      leaveBalances: {
        where: { year: new Date().getFullYear() },
      },
    },
    orderBy: { fullName: "asc" },
  });
}

export async function getEmployee(id: string) {
  await syncEmployeeLeaveStatus();
  const employee = await prisma.employee.findFirst({
    where: { id, deletedAt: null },
    include: {
      department: true,
      reportsTo: { select: { id: true, fullName: true, jobTitle: true } },
      directReports: { select: { id: true, fullName: true, jobTitle: true, status: true } },
      user: { select: { id: true, email: true, role: true, fullName: true } },
      leaveBalances: { where: { year: new Date().getFullYear() }, orderBy: { leaveType: "asc" } },
      leaveRequests: { orderBy: { createdAt: "desc" }, take: 20 },
      attendanceRecords: { orderBy: { date: "desc" }, take: 30 },
      documents: { orderBy: { createdAt: "desc" } },
      contracts: { orderBy: { startDate: "desc" }, take: 10 },
      reviewsReceived: {
        include: { reviewer: { select: { id: true, fullName: true } } },
        orderBy: { periodEnd: "desc" },
        take: 10,
      },
      trainings: {
        include: { program: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      disciplinaryActions: { orderBy: { actionDate: "desc" }, take: 10 },
      checklistItems: { orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] },
      payRunItems: {
        include: { payRun: true },
        orderBy: { payRun: { periodEnd: "desc" } },
        take: 12,
      },
    },
  });
  if (!employee) throw new Error("Employee not found");
  return employee;
}

type EmployeeInput = {
  fullName: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  departmentId?: string;
  reportsToId?: string | null;
  userId?: string;
  hireDate?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  nationalId?: string;
  tin?: string;
  nssfNumber?: string;
  bankName?: string;
  bankAccount?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  baseSalary?: number;
  allowances?: number;
  status?: EmploymentStatus;
  probationEnd?: string;
};

export async function createEmployee(data: EmployeeInput, userId: string) {
  const employeeNumber = await generateDocumentNumber("EMP", prisma);
  const status = data.status || (data.probationEnd ? "PROBATION" : "ACTIVE");

  const employee = await prisma.employee.create({
    data: {
      employeeNumber,
      fullName: data.fullName,
      email: data.email || null,
      phone: data.phone,
      jobTitle: data.jobTitle,
      departmentId: data.departmentId || null,
      userId: data.userId || null,
      hireDate: data.hireDate ? new Date(data.hireDate) : new Date(),
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      gender: data.gender,
      address: data.address,
      nationalId: data.nationalId,
      tin: data.tin,
      nssfNumber: data.nssfNumber,
      bankName: data.bankName,
      bankAccount: data.bankAccount,
      emergencyContact: data.emergencyContact,
      emergencyPhone: data.emergencyPhone,
      baseSalary: data.baseSalary || 0,
      allowances: data.allowances || 0,
      status,
      probationEnd: data.probationEnd ? new Date(data.probationEnd) : null,
      createdById: userId,
    },
    include: { department: true },
  });

  await ensureEmployeeLeaveBalances(employee.id);

  const { ensureEmployeeChecklist } = await import("./hr-extended.service");
  await ensureEmployeeChecklist(employee.id, "ONBOARDING");

  await createAuditLog({
    userId,
    action: "CREATE",
    module: "employees",
    recordId: employee.id,
    newValue: { employeeNumber, fullName: data.fullName },
  });

  return employee;
}

export async function updateEmployee(
  id: string,
  data: Partial<EmployeeInput> & {
    terminationDate?: string;
    terminationReason?: string;
  },
  userId: string
) {
  const updated = await prisma.employee.update({
    where: { id },
    data: {
      ...(data.fullName !== undefined && { fullName: data.fullName }),
      ...(data.email !== undefined && { email: data.email || null }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.jobTitle !== undefined && { jobTitle: data.jobTitle }),
      ...(data.departmentId !== undefined && { departmentId: data.departmentId || null }),
      ...(data.reportsToId !== undefined && { reportsToId: data.reportsToId || null }),
      ...(data.userId !== undefined && { userId: data.userId || null }),
      ...(data.baseSalary !== undefined && { baseSalary: data.baseSalary }),
      ...(data.allowances !== undefined && { allowances: data.allowances }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.gender !== undefined && { gender: data.gender }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.nationalId !== undefined && { nationalId: data.nationalId }),
      ...(data.tin !== undefined && { tin: data.tin }),
      ...(data.nssfNumber !== undefined && { nssfNumber: data.nssfNumber }),
      ...(data.bankName !== undefined && { bankName: data.bankName }),
      ...(data.bankAccount !== undefined && { bankAccount: data.bankAccount }),
      ...(data.emergencyContact !== undefined && { emergencyContact: data.emergencyContact }),
      ...(data.emergencyPhone !== undefined && { emergencyPhone: data.emergencyPhone }),
      ...(data.hireDate !== undefined && {
        hireDate: data.hireDate ? new Date(data.hireDate) : null,
      }),
      ...(data.dateOfBirth !== undefined && {
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      }),
      ...(data.probationEnd !== undefined && {
        probationEnd: data.probationEnd ? new Date(data.probationEnd) : null,
      }),
      ...(data.terminationDate !== undefined && {
        terminationDate: data.terminationDate ? new Date(data.terminationDate) : null,
      }),
      ...(data.terminationReason !== undefined && {
        terminationReason: data.terminationReason,
      }),
    },
    include: { department: true },
  });

  await createAuditLog({
    userId,
    action: "UPDATE",
    module: "employees",
    recordId: id,
    newValue: data,
  });

  return updated;
}

export async function terminateEmployee(
  id: string,
  userId: string,
  reason?: string
) {
  const updated = await prisma.employee.update({
    where: { id },
    data: {
      status: "TERMINATED",
      terminationDate: new Date(),
      terminationReason: reason || "Terminated",
      deletedAt: new Date(),
    },
  });

  const { ensureEmployeeChecklist } = await import("./hr-extended.service");
  await ensureEmployeeChecklist(id, "OFFBOARDING");

  await createAuditLog({
    userId,
    action: "TERMINATE",
    module: "employees",
    recordId: id,
    reason,
  });
  return updated;
}

export async function deactivateEmployee(id: string, userId: string) {
  return terminateEmployee(id, userId, "Deactivated");
}

export async function listLeaveRequests(status?: string) {
  return prisma.leaveRequest.findMany({
    where: status ? { status: status as "PENDING" | "APPROVED" | "REJECTED" } : undefined,
    include: {
      employee: { include: { department: true } },
      createdBy: { select: { fullName: true } },
      approvedBy: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function createLeaveRequest(
  data: {
    employeeId: string;
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    reason?: string;
  },
  userId: string
) {
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  if (end < start) throw new Error("End date must be on or after start date");

  const days = countLeaveDays(start, end);
  const year = start.getFullYear();
  await ensureEmployeeLeaveBalances(data.employeeId, year);

  const overlap = await prisma.leaveRequest.findFirst({
    where: {
      employeeId: data.employeeId,
      status: { in: ["PENDING", "APPROVED"] },
      startDate: { lte: end },
      endDate: { gte: start },
    },
  });
  if (overlap) throw new Error("Overlapping leave request already exists for this period");

  if (data.leaveType !== "UNPAID") {
    const balance = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveType_year: {
          employeeId: data.employeeId,
          leaveType: data.leaveType,
          year,
        },
      },
    });
    if (!balance) throw new Error("Leave balance not found");
    const available =
      Number(balance.entitled) - Number(balance.used) - Number(balance.pending);
    if (days > available) {
      throw new Error(
        `Insufficient ${data.leaveType.toLowerCase()} leave balance (${available} days left)`
      );
    }
  }

  const leaveNumber = await generateDocumentNumber("LV", prisma);

  const leave = await prisma.$transaction(async (tx) => {
    const created = await tx.leaveRequest.create({
      data: {
        leaveNumber,
        employeeId: data.employeeId,
        leaveType: data.leaveType,
        startDate: start,
        endDate: end,
        days,
        reason: data.reason,
        createdById: userId,
      },
      include: { employee: true },
    });

    if (data.leaveType !== "UNPAID") {
      await tx.leaveBalance.update({
        where: {
          employeeId_leaveType_year: {
            employeeId: data.employeeId,
            leaveType: data.leaveType,
            year,
          },
        },
        data: { pending: { increment: days } },
      });
    }

    return created;
  });

  await createAuditLog({
    userId,
    action: "CREATE",
    module: "leave",
    recordId: leave.id,
    newValue: { leaveNumber, days },
  });

  return leave;
}

export async function reviewLeaveRequest(
  id: string,
  action: "approve" | "reject",
  userId: string,
  comments?: string
) {
  const leave = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!leave) throw new Error("Leave request not found");
  if (leave.status !== "PENDING") throw new Error("Leave request already processed");

  const status = action === "approve" ? "APPROVED" : "REJECTED";
  const year = leave.startDate.getFullYear();
  const days = Number(leave.days);
  const today = todayDateOnly();

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.leaveRequest.update({
      where: { id },
      data: {
        status,
        approvedById: userId,
        approvedAt: new Date(),
        reason: comments
          ? `${leave.reason || ""}\n[Review] ${comments}`.trim()
          : leave.reason,
      },
      include: { employee: true },
    });

    if (leave.leaveType !== "UNPAID") {
      const balance = await tx.leaveBalance.findUnique({
        where: {
          employeeId_leaveType_year: {
            employeeId: leave.employeeId,
            leaveType: leave.leaveType,
            year,
          },
        },
      });
      if (balance) {
        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: {
            pending: { decrement: days },
            ...(action === "approve" ? { used: { increment: days } } : {}),
          },
        });
      }
    }

    if (action === "approve") {
      const coversToday =
        leave.startDate <= today && leave.endDate >= today;
      if (coversToday) {
        await tx.employee.update({
          where: { id: leave.employeeId },
          data: { status: "ON_LEAVE" },
        });
      }
    }

    return result;
  });

  await createAuditLog({
    userId,
    action: status,
    module: "leave",
    recordId: id,
    reason: comments,
  });

  return updated;
}

export async function listAttendance(options?: {
  from?: string;
  to?: string;
  employeeId?: string;
}) {
  const from = options?.from
    ? new Date(options.from)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const to = options?.to ? new Date(options.to) : todayDateOnly();

  return prisma.attendanceRecord.findMany({
    where: {
      date: { gte: from, lte: to },
      ...(options?.employeeId && { employeeId: options.employeeId }),
    },
    include: {
      employee: { include: { department: true } },
    },
    orderBy: [{ date: "desc" }, { employee: { fullName: "asc" } }],
    take: 500,
  });
}

export async function upsertAttendance(
  data: {
    employeeId: string;
    date: string;
    status: AttendanceStatus;
    checkIn?: string;
    checkOut?: string;
    notes?: string;
  },
  userId: string
) {
  const date = new Date(data.date);
  const record = await prisma.attendanceRecord.upsert({
    where: {
      employeeId_date: { employeeId: data.employeeId, date },
    },
    create: {
      employeeId: data.employeeId,
      date,
      status: data.status,
      checkIn: data.checkIn ? new Date(data.checkIn) : null,
      checkOut: data.checkOut ? new Date(data.checkOut) : null,
      notes: data.notes,
      createdById: userId,
    },
    update: {
      status: data.status,
      checkIn: data.checkIn ? new Date(data.checkIn) : null,
      checkOut: data.checkOut ? new Date(data.checkOut) : null,
      notes: data.notes,
    },
    include: { employee: true },
  });

  await createAuditLog({
    userId,
    action: "UPSERT",
    module: "employees",
    recordId: record.id,
    newValue: { employeeId: data.employeeId, date: data.date, status: data.status },
  });

  return record;
}

export async function markBulkAttendance(
  data: {
    date: string;
    status: AttendanceStatus;
    employeeIds?: string[];
  },
  userId: string
) {
  const employees = await prisma.employee.findMany({
    where: {
      status: { in: ["ACTIVE", "PROBATION", "ON_LEAVE"] },
      deletedAt: null,
      ...(data.employeeIds?.length ? { id: { in: data.employeeIds } } : {}),
    },
    select: { id: true },
  });

  const results = [];
  for (const emp of employees) {
    results.push(
      await upsertAttendance(
        { employeeId: emp.id, date: data.date, status: data.status },
        userId
      )
    );
  }
  return { count: results.length, date: data.date, status: data.status };
}

export async function addEmployeeDocument(
  data: {
    employeeId: string;
    title: string;
    category?: string;
    fileName?: string;
    fileUrl?: string;
    notes?: string;
  },
  userId: string
) {
  return prisma.employeeDocument.create({
    data: {
      employeeId: data.employeeId,
      title: data.title,
      category: data.category || "GENERAL",
      fileName: data.fileName,
      fileUrl: data.fileUrl,
      notes: data.notes,
      uploadedById: userId,
    },
  });
}

export async function listPayRuns() {
  return prisma.payRun.findMany({
    include: {
      items: { include: { employee: { include: { department: true } } } },
      createdBy: { select: { fullName: true } },
      approvedBy: { select: { fullName: true } },
    },
    orderBy: { periodEnd: "desc" },
    take: 50,
  });
}

export async function getPayRun(id: string) {
  const payRun = await prisma.payRun.findUnique({
    where: { id },
    include: {
      items: { include: { employee: { include: { department: true } } } },
      createdBy: { select: { fullName: true } },
      approvedBy: { select: { fullName: true } },
    },
  });
  if (!payRun) throw new Error("Pay run not found");
  return payRun;
}

export async function createPayRun(
  data: {
    periodStart: string;
    periodEnd: string;
    notes?: string;
    paymentMethod?: string;
    employeeIds?: string[];
  },
  userId: string
) {
  const payRunNumber = await generateDocumentNumber("PR", prisma);

  const employees = await prisma.employee.findMany({
    where: {
      status: { in: ["ACTIVE", "PROBATION", "ON_LEAVE"] },
      deletedAt: null,
      ...(data.employeeIds?.length ? { id: { in: data.employeeIds } } : {}),
    },
  });

  if (employees.length === 0) throw new Error("No active employees for payroll");

  const items = employees.map((emp) => {
    const calc = computeUgandaPayroll(
      Number(emp.baseSalary),
      Number(emp.allowances || 0)
    );
    return {
      employeeId: emp.id,
      basicPay: calc.basicPay,
      allowances: calc.allowances,
      grossPay: calc.grossPay,
      paye: calc.paye,
      nssfEmployee: calc.nssfEmployee,
      nssfEmployer: calc.nssfEmployer,
      otherDeductions: calc.otherDeductions,
      deductions: calc.deductions,
      netPay: calc.netPay,
    };
  });

  const totalGross = items.reduce((s, i) => s + i.grossPay, 0);
  const totalDeductions = items.reduce((s, i) => s + i.deductions, 0);
  const totalNet = items.reduce((s, i) => s + i.netPay, 0);
  const totalPaye = items.reduce((s, i) => s + i.paye, 0);
  const totalNssfEmployee = items.reduce((s, i) => s + i.nssfEmployee, 0);
  const totalNssfEmployer = items.reduce((s, i) => s + i.nssfEmployer, 0);

  const payRun = await prisma.payRun.create({
    data: {
      payRunNumber,
      periodStart: new Date(data.periodStart),
      periodEnd: new Date(data.periodEnd),
      totalGross,
      totalDeductions,
      totalNet,
      totalPaye,
      totalNssfEmployee,
      totalNssfEmployer,
      notes: data.notes,
      paymentMethod: (data.paymentMethod as PaymentMethod) || "BANK_TRANSFER",
      createdById: userId,
      items: { create: items },
    },
    include: { items: { include: { employee: true } } },
  });

  await createAuditLog({
    userId,
    action: "CREATE",
    module: "payroll",
    recordId: payRun.id,
    newValue: { payRunNumber, totalNet, employeeCount: items.length },
  });

  return payRun;
}

export async function approvePayRun(id: string, userId: string) {
  const payRun = await prisma.payRun.findUnique({ where: { id } });
  if (!payRun) throw new Error("Pay run not found");
  if (payRun.status !== "DRAFT") throw new Error("Only draft pay runs can be approved");

  return prisma.payRun.update({
    where: { id },
    data: { status: "APPROVED", approvedById: userId, approvedAt: new Date() },
    include: { items: { include: { employee: true } } },
  });
}

export async function cancelPayRun(id: string, userId: string) {
  const payRun = await prisma.payRun.findUnique({ where: { id } });
  if (!payRun) throw new Error("Pay run not found");
  if (payRun.status === "PAID") throw new Error("Paid pay runs cannot be cancelled");

  const updated = await prisma.payRun.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
  await createAuditLog({ userId, action: "CANCEL", module: "payroll", recordId: id });
  return updated;
}

export async function payPayRun(id: string, userId: string) {
  const payRun = await prisma.payRun.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!payRun) throw new Error("Pay run not found");
  if (payRun.status !== "APPROVED") throw new Error("Pay run must be approved before payment");

  const totalNet = Number(payRun.totalNet);
  const isBank = payRun.paymentMethod === "BANK_TRANSFER";

  await postPayrollJournal(totalNet, isBank, userId, payRun.payRunNumber);

  const updated = await prisma.payRun.update({
    where: { id },
    data: { status: "PAID", paidAt: new Date() },
    include: { items: { include: { employee: true } } },
  });

  await createAuditLog({
    userId,
    action: "PAY",
    module: "payroll",
    recordId: id,
    newValue: { payRunNumber: payRun.payRunNumber, totalNet },
  });

  return updated;
}

export async function getHrSummary() {
  await syncEmployeeLeaveStatus();
  const year = new Date().getFullYear();
  const monthStart = new Date(year, new Date().getMonth(), 1);

  const [
    activeEmployees,
    onLeave,
    probation,
    pendingLeave,
    draftPayRuns,
    departments,
    presentToday,
    absentToday,
  ] = await Promise.all([
    prisma.employee.count({ where: { status: "ACTIVE", deletedAt: null } }),
    prisma.employee.count({ where: { status: "ON_LEAVE", deletedAt: null } }),
    prisma.employee.count({ where: { status: "PROBATION", deletedAt: null } }),
    prisma.leaveRequest.count({ where: { status: "PENDING" } }),
    prisma.payRun.count({ where: { status: "DRAFT" } }),
    prisma.department.count({ where: { isActive: true } }),
    prisma.attendanceRecord.count({
      where: { date: todayDateOnly(), status: { in: ["PRESENT", "LATE", "HALF_DAY"] } },
    }),
    prisma.attendanceRecord.count({
      where: { date: todayDateOnly(), status: "ABSENT" },
    }),
  ]);

  const latestPay = await prisma.payRun.findFirst({
    where: { status: { in: ["APPROVED", "PAID"] }, periodStart: { gte: monthStart } },
    orderBy: { periodEnd: "desc" },
  });

  const { getExtendedHrSummary } = await import("./hr-extended.service");
  const extended = await getExtendedHrSummary();

  return {
    activeEmployees,
    onLeave,
    probation,
    pendingLeave,
    draftPayRuns,
    departments,
    presentToday,
    absentToday,
    monthPayrollNet: latestPay ? Number(latestPay.totalNet) : 0,
    ...extended,
  };
}
