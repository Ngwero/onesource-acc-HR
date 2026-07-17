import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import {
  ensureLeavePolicies,
  ensureEmployeeLeaveBalances,
  listEmployees,
} from "../src/services/hr.service";

async function main() {
  await ensureLeavePolicies();
  const emps = await listEmployees();
  for (const e of emps) await ensureEmployeeLeaveBalances(e.id);
  console.log("policies", await prisma.leavePolicy.count());
  console.log("balances", await prisma.leaveBalance.count());
  console.log("employees", emps.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
