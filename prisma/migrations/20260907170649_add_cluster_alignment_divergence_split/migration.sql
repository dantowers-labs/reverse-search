-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RoleCluster" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "analysisRunId" INTEGER NOT NULL,
    "clusterLabel" TEXT NOT NULL,
    "memberPersonProfileIdsJson" TEXT NOT NULL,
    "aggregateSummary" TEXT NOT NULL,
    "fitScore" INTEGER NOT NULL,
    "fitVerdict" TEXT NOT NULL,
    "fitReasoning" TEXT,
    "alignmentReasoning" TEXT,
    "divergenceReasoning" TEXT,
    CONSTRAINT "RoleCluster_analysisRunId_fkey" FOREIGN KEY ("analysisRunId") REFERENCES "AnalysisRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RoleCluster" ("aggregateSummary", "analysisRunId", "clusterLabel", "fitReasoning", "fitScore", "fitVerdict", "id", "memberPersonProfileIdsJson") SELECT "aggregateSummary", "analysisRunId", "clusterLabel", "fitReasoning", "fitScore", "fitVerdict", "id", "memberPersonProfileIdsJson" FROM "RoleCluster";
DROP TABLE "RoleCluster";
ALTER TABLE "new_RoleCluster" RENAME TO "RoleCluster";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
