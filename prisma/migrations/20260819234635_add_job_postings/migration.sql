-- CreateTable
CREATE TABLE "JobPosting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "seniority" TEXT NOT NULL,
    "functionType" TEXT NOT NULL,
    "keyResponsibilitiesJson" TEXT NOT NULL,
    "requiredExperienceJson" TEXT NOT NULL,
    "compensationRange" TEXT,
    "applicationStatus" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobPosting_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JobPostingAnalysis" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jobPostingId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fitScore" INTEGER NOT NULL,
    "functionTypeAssessment" TEXT NOT NULL,
    "positioningGapsJson" TEXT NOT NULL,
    "likelyRejectionReason" TEXT NOT NULL,
    "outreachTargetsJson" TEXT NOT NULL,
    "outreachMessagesJson" TEXT NOT NULL,
    CONSTRAINT "JobPostingAnalysis_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
