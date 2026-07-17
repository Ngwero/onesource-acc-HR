import pg from "pg";

export function createPgPool(connectionString?: string) {
  const url = connectionString || process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  const needsSsl =
    /supabase\.(co|com)/i.test(url) ||
    /\.railway\.(app|internal)/i.test(url) ||
    /sslmode=require/i.test(url) ||
    process.env.PGSSLMODE === "require";

  // Strip sslmode from URL so pg Pool ssl config takes effect
  const cleanUrl = needsSsl
    ? url.replace(/[?&]sslmode=[^&]*/gi, "").replace(/\?$/, "").replace(/&$/, "")
    : url;

  return new pg.Pool({
    connectionString: cleanUrl,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    max: 5,
    connectionTimeoutMillis: 15_000,
  });
}
