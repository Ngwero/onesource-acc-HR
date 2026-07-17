import "dotenv/config";
import { runScheduledJobs } from "../src/services/automation.service";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  console.log("Running scheduled jobs...");
  const result = await runScheduledJobs({ skipEmail: process.argv.includes("--skip-email") });
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
