-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AnalysisRun" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "personCountAtRun" INTEGER NOT NULL,
    "overallVerdict" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "overallSummary" TEXT NOT NULL,
    "confidenceNote" TEXT NOT NULL DEFAULT '',
    "suggestedQuestionsJson" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "AnalysisRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AnalysisRun" ("companyId", "createdAt", "id", "overallScore", "overallSummary", "overallVerdict", "personCountAtRun") SELECT "companyId", "createdAt", "id", "overallScore", "overallSummary", "overallVerdict", "personCountAtRun" FROM "AnalysisRun";
DROP TABLE "AnalysisRun";
ALTER TABLE "new_AnalysisRun" RENAME TO "AnalysisRun";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
