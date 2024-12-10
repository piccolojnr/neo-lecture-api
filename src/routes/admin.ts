import { Router } from 'express';
import { authenticateAdmin, adminLoginLimiter, verifyAdminKey, generateAdminToken, auditLog } from '../middleware/admin-auth';
import prisma from '../lib/prisma';

const router = Router();

// Admin login
router.post('/auth', adminLoginLimiter, async (req: any, res: any) => {
    try {
        const { secretKey } = req.body;

        if (!secretKey || !verifyAdminKey(secretKey)) {
            return res.status(401).json({ error: 'Invalid admin secret key' });
        }

        const token = generateAdminToken();
        res.json({ token });
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ error: 'Failed to process admin login' });
    }
});

// Get all users with their stats
router.get('/users', authenticateAdmin, auditLog, async (req: any, res: any) => {
    try {
        const users = await prisma.user.findMany({
            include: {
                _count: {
                    select: {
                        lectures: true,
                        quizAttempts: true,
                        flashcardReviews: true,
                    },
                },
                lectures: {
                    select: {
                        id: true,
                        title: true,
                        createdAt: true,
                    },
                },
                apiKeys: {
                    select: {
                        id: true,
                        name: true,
                        provider: true,
                        createdAt: true,
                    },
                },
            },
        });

        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Get system analytics
router.get('/analytics', authenticateAdmin, auditLog, async (req: any, res: any) => {
    try {
        const [
            userCount,
            lectureCount,
            quizCount,
            flashcardCount,
            quizAttemptCount,
            flashcardReviewCount,
        ] = await Promise.all([
            prisma.user.count(),
            prisma.lecture.count(),
            prisma.quiz.count(),
            prisma.flashcard.count(),
            prisma.quizAttempt.count(),
            prisma.flashcardReview.count(),
        ]);

        // Get daily active users for the last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const activeUsers = await prisma.user.count({
            where: {
                OR: [
                    {
                        quizAttempts: {
                            some: {
                                createdAt: {
                                    gte: thirtyDaysAgo,
                                },
                            },
                        },
                    },
                    {
                        flashcardReviews: {
                            some: {
                                createdAt: {
                                    gte: thirtyDaysAgo,
                                },
                            },
                        },
                    },
                ],
            },
        });

        res.json({
            totalUsers: userCount,
            totalLectures: lectureCount,
            totalQuizzes: quizCount,
            totalFlashcards: flashcardCount,
            totalQuizAttempts: quizAttemptCount,
            totalFlashcardReviews: flashcardReviewCount,
            activeUsersLast30Days: activeUsers,
        });
    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// Get all lectures with their stats
router.get('/lectures', authenticateAdmin, auditLog, async (req: any, res: any) => {
    try {
        const lectures = await prisma.lecture.findMany({
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                _count: {
                    select: {
                        quizzes: true,
                        flashcardSets: true,
                    },
                },
            },
        });

        res.json(lectures);
    } catch (error) {
        console.error('Error fetching lectures:', error);
        res.status(500).json({ error: 'Failed to fetch lectures' });
    }
});

// Delete user
router.delete('/users/:id', authenticateAdmin, auditLog, async (req: any, res: any) => {
    try {
        const { id } = req.params;

        await prisma.user.delete({
            where: { id },
        });

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Delete lecture
router.delete('/lectures/:id', authenticateAdmin, auditLog, async (req: any, res: any) => {
    try {
        const { id } = req.params;

        await prisma.lecture.delete({
            where: { id },
        });

        res.json({ message: 'Lecture deleted successfully' });
    } catch (error) {
        console.error('Error deleting lecture:', error);
        res.status(500).json({ error: 'Failed to delete lecture' });
    }
});

export default router;
