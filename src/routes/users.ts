import { Router } from "express";
import prisma from "../lib/prisma";
import { authenticateToken } from "../middleware/auth";

const router = Router();

// Get all quiz attempts for a user
router.get("/quiz/attempts", authenticateToken, async (req: any, res: any) => {
    try {
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ error: "User not authenticated" });
        }

        const attempts = await prisma.quizAttempt.findMany({
            where: {
                userId,
            },
            include: {
                quiz: {
                    include: {
                        lecture: {
                            select: {
                                id: true,
                                title: true,
                            },
                        },
                    },
                },
                answers: true,
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        res.json(attempts);
    } catch (error) {
        console.error("Error fetching user quiz attempts:", error);
        res.status(500).json({ error: "Failed to fetch user quiz attempts" });
    }
});

// Get all flashcard progress for a user
router.get("/flashcard/progress", authenticateToken, async (req: any, res: any) => {
    try {
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ error: "User not authenticated" });
        }

        const reviews = await prisma.flashcardReview.findMany({
            where: {
                userId,
            },
            include: {
                flashcard: {
                    include: {
                        flashcardSet: {
                            include: {
                                lecture: {
                                    select: {
                                        id: true,
                                        title: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        // Group reviews by flashcard set
        const groupedReviews = reviews.reduce((acc: any, review: any) => {
            const setId = review.flashcard.flashcardSet.id;
            if (!acc[setId]) {
                acc[setId] = {
                    setId,
                    title: review.flashcard.flashcardSet.title,
                    lecture: review.flashcard.flashcardSet.lecture,
                    reviews: [],
                };
            }
            acc[setId].reviews.push(review);
            return acc;
        }, {});

        res.json(Object.values(groupedReviews));
    } catch (error) {
        console.error("Error fetching flashcard progress:", error);
        res.status(500).json({ error: "Failed to fetch flashcard progress" });
    }
});

// Submit a flashcard review
router.post("/flashcard/:id/review", authenticateToken, async (req: any, res: any) => {
    try {
        const userId = req.user?.userId;
        const flashcardId = req.params.id;
        const { confidence } = req.body;

        if (!userId) {
            return res.status(401).json({ error: "User not authenticated" });
        }

        // Validate confidence score (1-5)
        if (confidence < 1 || confidence > 5) {
            return res.status(400).json({ error: "Confidence score must be between 1 and 5" });
        }

        // Calculate next review date based on confidence
        // Using a simple spaced repetition algorithm
        const now = new Date();
        let nextReview: Date;
        switch (confidence) {
            case 1: // Again - 10 minutes
                nextReview = new Date(now.getTime() + 10 * 60000);
                break;
            case 2: // Hard - 1 day
                nextReview = new Date(now.setDate(now.getDate() + 1));
                break;
            case 3: // Good - 3 days
                nextReview = new Date(now.setDate(now.getDate() + 3));
                break;
            case 4: // Easy - 7 days
                nextReview = new Date(now.setDate(now.getDate() + 7));
                break;
            case 5: // Very Easy - 14 days
                nextReview = new Date(now.setDate(now.getDate() + 14));
                break;
            default:
                nextReview = new Date(now.setDate(now.getDate() + 3));
        }

        const review = await prisma.flashcardReview.create({
            data: {
                userId,
                flashcardId,
                confidence,
                nextReview,
            },
            include: {
                flashcard: {
                    include: {
                        flashcardSet: true,
                    },
                },
            },
        });

        res.json(review);
    } catch (error) {
        console.error("Error submitting flashcard review:", error);
        res.status(500).json({ error: "Failed to submit flashcard review" });
    }
});

export default router;
