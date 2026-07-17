/**
 * Ensures SUPER_ADMIN exists in the PostgreSQL UserRole enum.
 * Run after pulling schema changes: npm run db:fix-enums
 */
import "dotenv/config";
import { createPgPool } from "../src/lib/pg";

async function main() {
  const pool = createPgPool(process.env.DIRECT_URL || process.env.DATABASE_URL);

  await pool.query(`ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN'`);

  await pool.query(`
    UPDATE "User"
    SET role = 'SUPER_ADMIN'
    WHERE email = 'admin@agribooks.com'
      AND role = 'ADMIN'
  `);

  const enums = await pool.query(`
    SELECT enumlabel FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'UserRole'
    ORDER BY enumsortorder
  `);

  console.log("UserRole values:", enums.rows.map((r) => r.enumlabel).join(", "));
  await pool.end();
  console.log("Done. Restart dev server: npm run dev:clean");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
