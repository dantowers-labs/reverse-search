-- CreateTable
CREATE TABLE "CandidateProfile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "headline" TEXT,
    "dataJson" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CandidateDocument" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fileType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "extractedJson" TEXT NOT NULL,
    "ingestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Company" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sector" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TrackerCompany" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "sector" TEXT,
    "role" TEXT,
    "status" TEXT,
    "notes" TEXT,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PersonProfile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyId" INTEGER NOT NULL,
    "mergedTitle" TEXT,
    "mergedHeadline" TEXT,
    "mergedAbout" TEXT,
    "mergedSkillsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PersonProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScreenshotImage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "personProfileId" INTEGER NOT NULL,
    "imagePath" TEXT NOT NULL,
    "rawExtractionJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScreenshotImage_personProfileId_fkey" FOREIGN KEY ("personProfileId") REFERENCES "PersonProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnalysisRun" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "personCountAtRun" INTEGER NOT NULL,
    "overallVerdict" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "overallSummary" TEXT NOT NULL,
    CONSTRAINT "AnalysisRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoleCluster" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "analysisRunId" INTEGER NOT NULL,
    "clusterLabel" TEXT NOT NULL,
    "memberPersonProfileIdsJson" TEXT NOT NULL,
    "aggregateSummary" TEXT NOT NULL,
    "fitScore" INTEGER NOT NULL,
    "fitVerdict" TEXT NOT NULL,
    "fitReasoning" TEXT NOT NULL,
    CONSTRAINT "RoleCluster_analysisRunId_fkey" FOREIGN KEY ("analysisRunId") REFERENCES "AnalysisRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyId" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Suggestion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "trackerCompanyId" INTEGER NOT NULL,
    "reasoning" TEXT NOT NULL,
    "basedOnPattern" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Suggestion_trackerCompanyId_fkey" FOREIGN KEY ("trackerCompanyId") REFERENCES "TrackerCompany" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "TrackerCompany_name_key" ON "TrackerCompany"("name");
