-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FlashcardReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "flashcardId" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "nextReview" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FlashcardReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FlashcardReview_flashcardId_fkey" FOREIGN KEY ("flashcardId") REFERENCES "Flashcard" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_FlashcardReview" ("confidence", "createdAt", "flashcardId", "id", "nextReview", "userId") SELECT "confidence", "createdAt", "flashcardId", "id", "nextReview", "userId" FROM "FlashcardReview";
DROP TABLE "FlashcardReview";
ALTER TABLE "new_FlashcardReview" RENAME TO "FlashcardReview";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
