import { prisma } from "@/lib/prisma";
import { generateDocumentNumber } from "@/lib/utils";
import { createAuditLog } from "./audit.service";
import type {
  ApplicantStatus,
  ChecklistKind,
  ChecklistItemStatus,
  ContractStatus,
  ContractType,
  DisciplinaryType,
  JobOpeningStatus,
  ReviewStatus,
  TrainingStatus,
} from "@/generated/prisma/client";

const ONBOARDING_DEFAULTS = [
  "Issue employment contract",
  "Collect national ID / TIN / NSSF details",
  "Set up payroll & bank details",
  "Assign workstation / tools",
  "IT access & email account",
  "Orientation with department manager",
  "Explain leave & attendance policy",
];

const OFFBOARDING_DEFAULTS = [
  "Accept resignation / issue termination letter",
  "Recover company assets",
  "Revoke IT access",
  "Final payroll & clearance",
  "Exit interview",
  "Archive personnel file",
];

function serializeDecimals<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v))
  );
}

// ─── Holidays ───────────────────────────────────────────────

export async function listHolidays(year?: number) {
  const y = year || new Date().getFullYear();
  const from = new Date(y, 0, 1);
  const to = new Date(y, 11, 31);
  return prisma.companyHoliday.findMany({
    where: { date: { gte: from, lte: to } },
    orderBy: { date: "asc" },
  });
}

export async function createHoliday(data: {
  name: string;
  date: string;
  isRecurring?: boolean;
  notes?: string;
}) {
  return prisma.companyHoliday.create({
    data: {
      name: data.name,
      date: new Date(data.date),
      isRecurring: data.isRecurring ?? false,
      notes: data.notes,
    },
  });
}

export async function deleteHoliday(id: string) {
  await prisma.companyHoliday.delete({ where: { id } });
  return { id };
}

export async function ensureUgandaPublicHolidays(year = new Date().getFullYear()) {
  const defaults = [
    { name: "New Year's Day", date: `${year}-01-01` },
    { name: "Liberation Day", date: `${year}-01-26` },
    { name: "International Women's Day", date: `${year}-03-08` },
    { name: "Labour Day", date: `${year}-05-01` },
    { name: "Martyrs' Day", date: `${year}-06-03` },
    { name: "National Heroes Day", date: `${year}-06-09` },
    { name: "Independence Day", date: `${year}-10-09` },
    { name: "Christmas Day", date: `${year}-12-25` },
    { name: "Boxing Day", date: `${year}-12-26` },
  ];
  for (const h of defaults) {
    const existing = await prisma.companyHoliday.findFirst({
      where: { name: h.name, date: new Date(h.date) },
    });
    if (!existing) {
      await prisma.companyHoliday.create({
        data: { name: h.name, date: new Date(h.date), isRecurring: true },
      });
    }
  }
  return listHolidays(year);
}

// ─── Contracts ──────────────────────────────────────────────

export async function listContracts(options?: { employeeId?: string; status?: string }) {
  return prisma.employmentContract.findMany({
    where: {
      ...(options?.employeeId && { employeeId: options.employeeId }),
      ...(options?.status && { status: options.status as ContractStatus }),
    },
    include: {
      employee: { select: { id: true, fullName: true, employeeNumber: true, department: true } },
    },
    orderBy: { startDate: "desc" },
  });
}

export async function createContract(
  data: {
    employeeId: string;
    contractType?: ContractType;
    status?: ContractStatus;
    title?: string;
    startDate: string;
    endDate?: string;
    probationEnd?: string;
    salary?: number;
    notes?: string;
  },
  userId: string
) {
  const contractNumber = await generateDocumentNumber("CTR", prisma);
  const contract = await prisma.employmentContract.create({
    data: {
      contractNumber,
      employeeId: data.employeeId,
      contractType: data.contractType || "PERMANENT",
      status: data.status || "ACTIVE",
      title: data.title,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null,
      probationEnd: data.probationEnd ? new Date(data.probationEnd) : null,
      salary: data.salary,
      notes: data.notes,
      createdById: userId,
    },
    include: { employee: true },
  });
  await createAuditLog({
    userId,
    action: "CREATE",
    module: "employees",
    recordId: contract.id,
    newValue: { contractNumber },
  });
  return contract;
}

export async function updateContract(
  id: string,
  data: Partial<{
    status: ContractStatus;
    title: string;
    endDate: string | null;
    salary: number;
    notes: string;
  }>,
  userId: string
) {
  const contract = await prisma.employmentContract.update({
    where: { id },
    data: {
      ...(data.status && { status: data.status }),
      ...(data.title !== undefined && { title: data.title }),
      ...(data.endDate !== undefined && {
        endDate: data.endDate ? new Date(data.endDate) : null,
      }),
      ...(data.salary !== undefined && { salary: data.salary }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
  });
  await createAuditLog({
    userId,
    action: "UPDATE",
    module: "employees",
    recordId: id,
    newValue: data,
  });
  return contract;
}

export async function getExpiringContracts(withinDays = 60) {
  const now = new Date();
  const until = new Date();
  until.setDate(until.getDate() + withinDays);
  return prisma.employmentContract.findMany({
    where: {
      status: "ACTIVE",
      endDate: { gte: now, lte: until },
    },
    include: {
      employee: { select: { id: true, fullName: true, employeeNumber: true } },
    },
    orderBy: { endDate: "asc" },
  });
}

// ─── Recruitment ────────────────────────────────────────────

export async function listJobOpenings(status?: string) {
  return prisma.jobOpening.findMany({
    where: status ? { status: status as JobOpeningStatus } : undefined,
    include: {
      department: true,
      _count: { select: { applicants: true } },
    },
    orderBy: { postedAt: "desc" },
  });
}

export async function createJobOpening(
  data: {
    title: string;
    departmentId?: string;
    location?: string;
    employmentType?: ContractType;
    status?: JobOpeningStatus;
    openingsCount?: number;
    description?: string;
    requirements?: string;
    salaryMin?: number;
    salaryMax?: number;
    closesAt?: string;
  },
  userId: string
) {
  const openingNumber = await generateDocumentNumber("JOB", prisma);
  return prisma.jobOpening.create({
    data: {
      openingNumber,
      title: data.title,
      departmentId: data.departmentId || null,
      location: data.location,
      employmentType: data.employmentType || "PERMANENT",
      status: data.status || "OPEN",
      openingsCount: data.openingsCount || 1,
      description: data.description,
      requirements: data.requirements,
      salaryMin: data.salaryMin,
      salaryMax: data.salaryMax,
      closesAt: data.closesAt ? new Date(data.closesAt) : null,
      createdById: userId,
    },
    include: { department: true, _count: { select: { applicants: true } } },
  });
}

export async function updateJobOpening(
  id: string,
  data: Partial<{
    title: string;
    status: JobOpeningStatus;
    description: string;
    requirements: string;
    closesAt: string | null;
  }>
) {
  return prisma.jobOpening.update({
    where: { id },
    data: {
      ...(data.title && { title: data.title }),
      ...(data.status && { status: data.status }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.requirements !== undefined && { requirements: data.requirements }),
      ...(data.closesAt !== undefined && {
        closesAt: data.closesAt ? new Date(data.closesAt) : null,
      }),
    },
    include: { department: true, _count: { select: { applicants: true } } },
  });
}

export async function listApplicants(options?: { jobOpeningId?: string; status?: string }) {
  return prisma.applicant.findMany({
    where: {
      ...(options?.jobOpeningId && { jobOpeningId: options.jobOpeningId }),
      ...(options?.status && { status: options.status as ApplicantStatus }),
    },
    include: {
      jobOpening: { select: { id: true, title: true, openingNumber: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createApplicant(data: {
  jobOpeningId: string;
  fullName: string;
  email?: string;
  phone?: string;
  source?: string;
  notes?: string;
}) {
  const applicantNumber = await generateDocumentNumber("APL", prisma);
  return prisma.applicant.create({
    data: {
      applicantNumber,
      jobOpeningId: data.jobOpeningId,
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      source: data.source,
      notes: data.notes,
    },
    include: { jobOpening: true },
  });
}

export async function updateApplicant(
  id: string,
  data: Partial<{
    status: ApplicantStatus;
    notes: string;
    interviewAt: string | null;
  }>
) {
  return prisma.applicant.update({
    where: { id },
    data: {
      ...(data.status && { status: data.status }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.interviewAt !== undefined && {
        interviewAt: data.interviewAt ? new Date(data.interviewAt) : null,
      }),
    },
    include: { jobOpening: true },
  });
}

// ─── Performance ────────────────────────────────────────────

export async function listPerformanceReviews(options?: {
  employeeId?: string;
  status?: string;
}) {
  return prisma.performanceReview.findMany({
    where: {
      ...(options?.employeeId && { employeeId: options.employeeId }),
      ...(options?.status && { status: options.status as ReviewStatus }),
    },
    include: {
      employee: { select: { id: true, fullName: true, employeeNumber: true, department: true } },
      reviewer: { select: { id: true, fullName: true } },
    },
    orderBy: { periodEnd: "desc" },
  });
}

export async function createPerformanceReview(
  data: {
    employeeId: string;
    periodStart: string;
    periodEnd: string;
    overallRating?: number;
    strengths?: string;
    improvements?: string;
    goals?: string;
    comments?: string;
    status?: ReviewStatus;
  },
  reviewerId: string
) {
  const reviewNumber = await generateDocumentNumber("REV", prisma);
  const status = data.status || "DRAFT";
  return prisma.performanceReview.create({
    data: {
      reviewNumber,
      employeeId: data.employeeId,
      reviewerId,
      periodStart: new Date(data.periodStart),
      periodEnd: new Date(data.periodEnd),
      overallRating: data.overallRating,
      strengths: data.strengths,
      improvements: data.improvements,
      goals: data.goals,
      comments: data.comments,
      status,
      submittedAt: status === "SUBMITTED" ? new Date() : null,
    },
    include: {
      employee: { select: { id: true, fullName: true, employeeNumber: true } },
      reviewer: { select: { id: true, fullName: true } },
    },
  });
}

export async function updatePerformanceReview(
  id: string,
  data: Partial<{
    status: ReviewStatus;
    overallRating: number;
    strengths: string;
    improvements: string;
    goals: string;
    comments: string;
  }>
) {
  return prisma.performanceReview.update({
    where: { id },
    data: {
      ...(data.status && {
        status: data.status,
        ...(data.status === "SUBMITTED" && { submittedAt: new Date() }),
      }),
      ...(data.overallRating !== undefined && { overallRating: data.overallRating }),
      ...(data.strengths !== undefined && { strengths: data.strengths }),
      ...(data.improvements !== undefined && { improvements: data.improvements }),
      ...(data.goals !== undefined && { goals: data.goals }),
      ...(data.comments !== undefined && { comments: data.comments }),
    },
    include: {
      employee: { select: { id: true, fullName: true } },
      reviewer: { select: { id: true, fullName: true } },
    },
  });
}

// ─── Training ───────────────────────────────────────────────

export async function listTrainingPrograms() {
  return prisma.trainingProgram.findMany({
    where: { isActive: true },
    include: { _count: { select: { enrollments: true } } },
    orderBy: { title: "asc" },
  });
}

export async function createTrainingProgram(
  data: {
    title: string;
    code?: string;
    provider?: string;
    description?: string;
    durationHours?: number;
  },
  userId: string
) {
  const code = data.code || (await generateDocumentNumber("TRN", prisma));
  return prisma.trainingProgram.create({
    data: {
      code,
      title: data.title,
      provider: data.provider,
      description: data.description,
      durationHours: data.durationHours,
      createdById: userId,
    },
  });
}

export async function listEmployeeTrainings(options?: {
  employeeId?: string;
  status?: string;
}) {
  return prisma.employeeTraining.findMany({
    where: {
      ...(options?.employeeId && { employeeId: options.employeeId }),
      ...(options?.status && { status: options.status as TrainingStatus }),
    },
    include: {
      employee: { select: { id: true, fullName: true, employeeNumber: true } },
      program: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function enrollEmployeeTraining(data: {
  employeeId: string;
  programId: string;
  startDate?: string;
  endDate?: string;
  status?: TrainingStatus;
  notes?: string;
}) {
  return prisma.employeeTraining.create({
    data: {
      employeeId: data.employeeId,
      programId: data.programId,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      status: data.status || "PLANNED",
      notes: data.notes,
    },
    include: { employee: true, program: true },
  });
}

export async function updateEmployeeTraining(
  id: string,
  data: Partial<{
    status: TrainingStatus;
    score: number;
    certificate: string;
    endDate: string;
    notes: string;
  }>
) {
  return prisma.employeeTraining.update({
    where: { id },
    data: {
      ...(data.status && { status: data.status }),
      ...(data.score !== undefined && { score: data.score }),
      ...(data.certificate !== undefined && { certificate: data.certificate }),
      ...(data.endDate && { endDate: new Date(data.endDate) }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
    include: { employee: true, program: true },
  });
}

// ─── Disciplinary ───────────────────────────────────────────

export async function listDisciplinary(options?: { employeeId?: string }) {
  return prisma.disciplinaryAction.findMany({
    where: options?.employeeId ? { employeeId: options.employeeId } : undefined,
    include: {
      employee: { select: { id: true, fullName: true, employeeNumber: true, department: true } },
      createdBy: { select: { id: true, fullName: true } },
    },
    orderBy: { actionDate: "desc" },
  });
}

export async function createDisciplinary(
  data: {
    employeeId: string;
    actionType: DisciplinaryType;
    title: string;
    description?: string;
    actionDate?: string;
    effectiveUntil?: string;
  },
  userId: string
) {
  const actionNumber = await generateDocumentNumber("DIS", prisma);
  const record = await prisma.disciplinaryAction.create({
    data: {
      actionNumber,
      employeeId: data.employeeId,
      actionType: data.actionType,
      title: data.title,
      description: data.description,
      actionDate: data.actionDate ? new Date(data.actionDate) : new Date(),
      effectiveUntil: data.effectiveUntil ? new Date(data.effectiveUntil) : null,
      createdById: userId,
    },
    include: {
      employee: { select: { id: true, fullName: true } },
    },
  });
  await createAuditLog({
    userId,
    action: "CREATE",
    module: "employees",
    recordId: record.id,
    newValue: { actionNumber, actionType: data.actionType },
  });
  return record;
}

// ─── Checklists ─────────────────────────────────────────────

export async function ensureEmployeeChecklist(employeeId: string, kind: ChecklistKind) {
  const existing = await prisma.employeeChecklistItem.count({
    where: { employeeId, kind },
  });
  if (existing > 0) {
    return prisma.employeeChecklistItem.findMany({
      where: { employeeId, kind },
      orderBy: { sortOrder: "asc" },
    });
  }
  const titles = kind === "ONBOARDING" ? ONBOARDING_DEFAULTS : OFFBOARDING_DEFAULTS;
  await prisma.employeeChecklistItem.createMany({
    data: titles.map((title, i) => ({
      employeeId,
      kind,
      title,
      sortOrder: i,
    })),
  });
  return prisma.employeeChecklistItem.findMany({
    where: { employeeId, kind },
    orderBy: { sortOrder: "asc" },
  });
}

export async function updateChecklistItem(
  id: string,
  data: { status: ChecklistItemStatus; notes?: string }
) {
  return prisma.employeeChecklistItem.update({
    where: { id },
    data: {
      status: data.status,
      notes: data.notes,
      completedAt: data.status === "DONE" ? new Date() : null,
    },
  });
}

// ─── Org chart ──────────────────────────────────────────────

export async function getOrgChart() {
  const [departments, employees] = await Promise.all([
    prisma.department.findMany({
      where: { isActive: true },
      include: {
        manager: { select: { id: true, fullName: true, jobTitle: true } },
        _count: { select: { employees: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.employee.findMany({
      where: { deletedAt: null, status: { in: ["ACTIVE", "PROBATION", "ON_LEAVE"] } },
      select: {
        id: true,
        fullName: true,
        jobTitle: true,
        employeeNumber: true,
        status: true,
        departmentId: true,
        reportsToId: true,
        department: { select: { id: true, name: true } },
      },
      orderBy: { fullName: "asc" },
    }),
  ]);
  return { departments, employees };
}

export async function setEmployeeManager(employeeId: string, reportsToId: string | null, userId: string) {
  if (reportsToId === employeeId) throw new Error("Employee cannot report to themselves");
  const updated = await prisma.employee.update({
    where: { id: employeeId },
    data: { reportsToId },
    include: {
      reportsTo: { select: { id: true, fullName: true } },
      department: true,
    },
  });
  await createAuditLog({
    userId,
    action: "UPDATE",
    module: "employees",
    recordId: employeeId,
    newValue: { reportsToId },
  });
  return updated;
}

// ─── Reports ────────────────────────────────────────────────

export async function getHrReports() {
  const year = new Date().getFullYear();
  const yearStart = new Date(year, 0, 1);
  const monthStart = new Date(year, new Date().getMonth(), 1);

  const [
    headcountByStatus,
    headcountByDept,
    hiresThisYear,
    terminationsThisYear,
    leaveByType,
    attendanceMonth,
    openJobs,
    applicantsPipeline,
    expiringContracts,
    pendingReviews,
    activeTrainings,
    disciplinaryYtd,
  ] = await Promise.all([
    prisma.employee.groupBy({
      by: ["status"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    prisma.employee.groupBy({
      by: ["departmentId"],
      where: { deletedAt: null, status: { in: ["ACTIVE", "PROBATION", "ON_LEAVE"] } },
      _count: { _all: true },
    }),
    prisma.employee.count({
      where: { deletedAt: null, hireDate: { gte: yearStart } },
    }),
    prisma.employee.count({
      where: { status: "TERMINATED", terminationDate: { gte: yearStart } },
    }),
    prisma.leaveRequest.groupBy({
      by: ["leaveType", "status"],
      where: { startDate: { gte: yearStart } },
      _sum: { days: true },
      _count: { _all: true },
    }),
    prisma.attendanceRecord.groupBy({
      by: ["status"],
      where: { date: { gte: monthStart } },
      _count: { _all: true },
    }),
    prisma.jobOpening.count({ where: { status: "OPEN" } }),
    prisma.applicant.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    getExpiringContracts(60),
    prisma.performanceReview.count({ where: { status: { in: ["DRAFT", "SUBMITTED"] } } }),
    prisma.employeeTraining.count({
      where: { status: { in: ["PLANNED", "IN_PROGRESS"] } },
    }),
    prisma.disciplinaryAction.count({ where: { actionDate: { gte: yearStart } } }),
  ]);

  const depts = await prisma.department.findMany({
    select: { id: true, name: true },
  });
  const deptMap = Object.fromEntries(depts.map((d) => [d.id, d.name]));

  return serializeDecimals({
    headcountByStatus: headcountByStatus.map((r) => ({
      status: r.status,
      count: r._count._all,
    })),
    headcountByDepartment: headcountByDept.map((r) => ({
      departmentId: r.departmentId,
      department: r.departmentId ? deptMap[r.departmentId] || "Unknown" : "Unassigned",
      count: r._count._all,
    })),
    hiresThisYear,
    terminationsThisYear,
    turnoverRate:
      hiresThisYear + terminationsThisYear > 0
        ? Number(
            (
              (terminationsThisYear /
                Math.max(1, hiresThisYear + terminationsThisYear)) *
              100
            ).toFixed(1)
          )
        : 0,
    leaveByType,
    attendanceMonth: attendanceMonth.map((r) => ({
      status: r.status,
      count: r._count._all,
    })),
    openJobs,
    applicantsPipeline: applicantsPipeline.map((r) => ({
      status: r.status,
      count: r._count._all,
    })),
    expiringContracts,
    pendingReviews,
    activeTrainings,
    disciplinaryYtd,
  });
}

export async function getExtendedHrSummary() {
  const [
    openJobs,
    applicants,
    expiringContracts,
    pendingReviews,
    activeTrainings,
    holidaysThisMonth,
  ] = await Promise.all([
    prisma.jobOpening.count({ where: { status: "OPEN" } }),
    prisma.applicant.count({
      where: { status: { in: ["APPLIED", "SCREENING", "INTERVIEW", "OFFER"] } },
    }),
    getExpiringContracts(30).then((c) => c.length),
    prisma.performanceReview.count({ where: { status: { in: ["DRAFT", "SUBMITTED"] } } }),
    prisma.employeeTraining.count({
      where: { status: { in: ["PLANNED", "IN_PROGRESS"] } },
    }),
    prisma.companyHoliday.count({
      where: {
        date: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          lte: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
        },
      },
    }),
  ]);

  return {
    openJobs,
    applicants,
    expiringContracts,
    pendingReviews,
    activeTrainings,
    holidaysThisMonth,
  };
}
