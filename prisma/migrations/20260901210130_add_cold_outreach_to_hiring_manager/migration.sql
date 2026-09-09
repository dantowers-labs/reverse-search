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
    "coldOutreachToHiringManager" TEXT NOT NULL DEFAULT '',
    "personCountAtRun" INTEGER NOT NULL DEFAULT 0,
    "candidateProfileUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resumeEditsJson" TEXT NOT NULL DEFAULT '[]',
    "skillsToAcquireJson" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "JobPostingAnalysis_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_JobPostingAnalysis" ("candidateProfileUpdatedAt", "createdAt", "fitScore", "functionTypeAssessment", "id", "jobPostingId", "likelyRejectionReason", "outreachMessagesJson", "outreachTargetsJson", "personCountAtRun", "positioningGapsJson", "resumeEditsJson", "skillsToAcquireJson") SELECT "candidateProfileUpdatedAt", "createdAt", "fitScore", "functionTypeAssessment", "id", "jobPostingId", "likelyRejectionReason", "outreachMessagesJson", "outreachTargetsJson", "personCountAtRun", "positioningGapsJson", "resumeEditsJson", "skillsToAcquireJson" FROM "JobPostingAnalysis";
DROP TABLE "JobPostingAnalysis";
ALTER TABLE "new_JobPostingAnalysis" RENAME TO "JobPostingAnalysis";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
