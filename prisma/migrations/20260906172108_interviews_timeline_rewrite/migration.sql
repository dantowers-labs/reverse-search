/*
  Warnings:

  - You are about to drop the `InterviewOpportunity` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `interviewOpportunityId` on the `InterviewRound` table. All the data in the column will be lost.
  - Added the required column `interviewId` to the `InterviewRound` table without a default value. This is not possible if the table is not empty.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "InterviewOpportunity";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Interview" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyId" INTEGER NOT NULL,
    "jobPostingId" INTEGER,
    "label" TEXT,
    "disposition" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Interview_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Interview_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OpportunityEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "interviewId" INTEGER NOT NULL,
    "roundId" INTEGER,
    "type" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OpportunityEvent_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OpportunityEvent_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "InterviewRound" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InterviewRound" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "interviewId" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "stage" TEXT NOT NULL,
    "date" DATETIME,
    "state" TEXT,
    "interviewerName" TEXT NOT NULL,
    "interviewerPersonId" INTEGER,
    "guideJson" TEXT,
    "guideGeneratedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InterviewRound_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InterviewRound_interviewerPersonId_fkey" FOREIGN KEY ("interviewerPersonId") REFERENCES "PersonProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_InterviewRound" ("createdAt", "guideGeneratedAt", "guideJson", "id", "interviewerName", "interviewerPersonId", "notes", "sequence", "stage") SELECT "createdAt", "guideGeneratedAt", "guideJson", "id", "interviewerName", "interviewerPersonId", "notes", "sequence", "stage" FROM "InterviewRound";
DROP TABLE "InterviewRound";
ALTER TABLE "new_InterviewRound" RENAME TO "InterviewRound";
CREATE INDEX "InterviewRound_interviewId_idx" ON "InterviewRound"("interviewId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "OpportunityEvent_interviewId_idx" ON "OpportunityEvent"("interviewId");
