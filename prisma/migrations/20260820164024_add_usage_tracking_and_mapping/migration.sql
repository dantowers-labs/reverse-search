-- AlterTable
ALTER TABLE "Suggestion" ADD COLUMN "confidenceScore" INTEGER;

-- CreateTable
CREATE TABLE "ApiCall" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activity" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "companyId" INTEGER,
    "jobPostingId" INTEGER,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheCreationTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" REAL NOT NULL,
    "isRerun" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ApiCall_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "trackerRankingStrategy" TEXT NOT NULL DEFAULT 'priorityFitTiebreak',
    "trackerExtraColumnsPolicy" TEXT NOT NULL DEFAULT 'keepUnanalyzed'
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_JobPostingAnalysis" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jobPostingId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fitScore" INTEGER NOT NULL,
    "functionTypeAssessment" TEXT NOT NULL,
    "positioningGapsJson" TEXT NOT NULL,
    "likelyRejectionReason" TEXT NOT NULL,
    "outreachTargetsJson" TEXT NOT NULL,
    "outreachMessagesJson" TEXT NOT NULL,
    "personCountAtRun" INTEGER NOT NULL DEFAULT 0,
    "candidateProfileUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resumeEditsJson" TEXT NOT NULL DEFAULT '[]',
    "skillsToAcquireJson" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "JobPostingAnalysis_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_JobPostingAnalysis" ("createdAt", "fitScore", "functionTypeAssessment", "id", "jobPostingId", "likelyRejectionReason", "outreachMessagesJson", "outreachTargetsJson", "positioningGapsJson") SELECT "createdAt", "fitScore", "functionTypeAssessment", "id", "jobPostingId", "likelyRejectionReason", "outreachMessagesJson", "outreachTargetsJson", "positioningGapsJson" FROM "JobPostingAnalysis";
DROP TABLE "JobPostingAnalysis";
ALTER TABLE "new_JobPostingAnalysis" RENAME TO "JobPostingAnalysis";
CREATE TABLE "new_TrackerCompany" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "sector" TEXT,
    "role" TEXT,
    "status" TEXT,
    "notes" TEXT,
    "priority" INTEGER,
    "extraFieldsJson" TEXT NOT NULL DEFAULT '{}',
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_TrackerCompany" ("id", "lastSeenAt", "name", "notes", "role", "sector", "status") SELECT "id", "lastSeenAt", "name", "notes", "role", "sector", "status" FROM "TrackerCompany";
DROP TABLE "TrackerCompany";
ALTER TABLE "new_TrackerCompany" RENAME TO "TrackerCompany";
CREATE UNIQUE INDEX "TrackerCompany_name_key" ON "TrackerCompany"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ApiCall_createdAt_idx" ON "ApiCall"("createdAt");

-- CreateIndex
CREATE INDEX "ApiCall_companyId_idx" ON "ApiCall"("companyId");
