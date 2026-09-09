import { runFullImport } from "../src/lib/importTracker";
import { prisma } from "../src/lib/prisma";

const CSV_PATH = process.argv[2];
if (!CSV_PATH) {
  console.error("Usage: npx tsx scripts/import-tracker.ts /path/to/your/tracker.csv");
  process.exit(1);
}

runFullImport(CSV_PATH)
  .then(({ rowsRead, companiesUpserted }) => {
    console.log(`Read ${rowsRead} tracker rows, upserted ${companiesUpserted} companies.`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
