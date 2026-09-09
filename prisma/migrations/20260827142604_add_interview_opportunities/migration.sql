-- CreateTable
CREATE TABLE "InterviewOpportunity" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyId" INTEGER NOT NULL,
    "jobPostingId" INTEGER,
    "label" TEXT,
    "disposition" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InterviewOpportunity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InterviewOpportunity_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InterviewRound" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "interviewOpportunityId" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "stage" TEXT NOT NULL,
    "interviewerName" TEXT NOT NULL,
    "interviewerPersonId" INTEGER,
    "guideJson" TEXT,
    "guideGeneratedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InterviewRound_interviewOpportunityId_fkey" FOREIGN KEY ("interviewOpportunityId") REFERENCES "InterviewOpportunity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InterviewRound_interviewerPersonId_fkey" FOREIGN KEY ("interviewerPersonId") REFERENCES "PersonProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "InterviewRound_interviewOpportunityId_idx" ON "InterviewRound"("interviewOpportunityId");
