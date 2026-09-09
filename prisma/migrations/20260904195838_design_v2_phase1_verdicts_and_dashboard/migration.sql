-- AlterTable
ALTER TABLE "Company" ADD COLUMN "dismissedAt" DATETIME;

-- AlterTable
ALTER TABLE "Suggestion" ADD COLUMN "verdict" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AppSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "trackerRankingStrategy" TEXT NOT NULL DEFAULT 'priorityFitTiebreak',
    "trackerExtraColumnsPolicy" TEXT NOT NULL DEFAULT 'keepUnanalyzed',
    "trackerLastPath" TEXT,
    "trackerLastMappingJson" TEXT,
    "staleThresholdDays" INTEGER NOT NULL DEFAULT 30
);
INSERT INTO "new_AppSettings" ("id", "trackerExtraColumnsPolicy", "trackerLastMappingJson", "trackerLastPath", "trackerRankingStrategy") SELECT "id", "trackerExtraColumnsPolicy", "trackerLastMappingJson", "trackerLastPath", "trackerRankingStrategy" FROM "AppSettings";
DROP TABLE "AppSettings";
ALTER TABLE "new_AppSettings" RENAME TO "AppSettings";
CREATE TABLE "new_JobPostingAnalysis" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jobPostingId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fitScore" INTEGER NOT NULL,
    "verdict" TEXT NOT NULL DEFAULT '',
    "functionTypeAssessment" TEXT NOT NULL,
    "associatedClusterId" INTEGER,
    "associatedClusterBasis" TEXT,
    "positioningGapsJson" TEXT NOT NULL,
    "likelyRejectionReason" TEXT NOT NULL,
    "outreachTargetsJson" TEXT NOT NULL,
    "outreachMessagesJson" TEXT NOT NULL,
    "coldOutreachToHiringManager" TEXT NOT NULL DEFAULT '',
    "personCountAtRun" INTEGER NOT NULL DEFAULT 0,
    "candidateProfileUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resumeEditsJson" TEXT NOT NULL DEFAULT '[]',
    "skillsToAcquireJson" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "JobPostingAnalysis_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JobPostingAnalysis_associatedClusterId_fkey" FOREIGN KEY ("associatedClusterId") REFERENCES "RoleCluster" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_JobPostingAnalysis" ("candidateProfileUpdatedAt", "coldOutreachToHiringManager", "createdAt", "fitScore", "functionTypeAssessment", "id", "jobPostingId", "likelyRejectionReason", "outreachMessagesJson", "outreachTargetsJson", "personCountAtRun", "positioningGapsJson", "resumeEditsJson", "skillsToAcquireJson") SELECT "candidateProfileUpdatedAt", "coldOutreachToHiringManager", "createdAt", "fitScore", "functionTypeAssessment", "id", "jobPostingId", "likelyRejectionReason", "outreachMessagesJson", "outreachTargetsJson", "personCountAtRun", "positioningGapsJson", "resumeEditsJson", "skillsToAcquireJson" FROM "JobPostingAnalysis";
DROP TABLE "JobPostingAnalysis";
ALTER TABLE "new_JobPostingAnalysis" RENAME TO "JobPostingAnalysis";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
