-- Add FlashcardReview table
CREATE TABLE "FlashcardReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "flashcardId" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "nextReview" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
    FOREIGN KEY ("flashcardId") REFERENCES "Flashcard"("id") ON DELETE CASCADE
);
