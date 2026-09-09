-- AlterTable
ALTER TABLE "PersonProfile" ADD COLUMN "embeddingJson" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AppSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "trackerRankingStrategy" TEXT NOT NULL DEFAULT 'priorityFitTiebreak',
    "trackerExtraColumnsPolicy" TEXT NOT NULL DEFAULT 'keepUnanalyzed',
    "trackerLastPath" TEXT,
    "trackerLastMappingJson" TEXT,
    "staleThresholdDays" INTEGER NOT NULL DEFAULT 30,
    "vectorMapEnabled" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_AppSettings" ("id", "staleThresholdDays", "trackerExtraColumnsPolicy", "trackerLastMappingJson", "trackerLastPath", "trackerRankingStrategy") SELECT "id", "staleThresholdDays", "trackerExtraColumnsPolicy", "trackerLastMappingJson", "trackerLastPath", "trackerRankingStrategy" FROM "AppSettings";
DROP TABLE "AppSettings";
ALTER TABLE "new_AppSettings" RENAME TO "AppSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
