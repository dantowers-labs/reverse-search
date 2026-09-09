-- CreateTable
CREATE TABLE "Connection" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "position" TEXT,
    "url" TEXT,
    "email" TEXT,
    "connectedOn" DATETIME,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Connection_company_idx" ON "Connection"("company");
