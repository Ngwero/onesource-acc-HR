import pg from "pg";

export function createPgPool(connectionString?: string) {
  const url = connectionString || process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  const isSupabase = url.includes("supabase.co");

  // Strip sslmode from URL so pg Pool ssl config takes effect
  const cleanUrl = isSupabase
    ? url.replace(/[?&]sslmode=[^&]*/g, "").replace(/\?$/, "")
    : url;

  return new pg.Pool({
    connectionString: cleanUrl,
    ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
  });
}
