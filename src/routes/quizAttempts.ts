import { Router } from "express";
import prisma from "../lib/prisma";
import { authenticateToken } from "../middleware/auth";

const router = Router();

// Submit a quiz attempt
router.post("/:quizId/attempts", authenticateToken, async (req: any, res: any) => {
  try {
    const { quizId } = req.params;
    const { answers, score } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Validate quiz exists
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: { questions: true }
    });

    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    const attemptAnswers = answers.map((a: any) => {
      const question = quiz.questions[a.questionIndex];
      if (!question) {
        throw new Error(`Invalid question index: ${a.questionIndex}`);
      }
      return {
        questionId: question.id,
        answer: a.selectedAnswer
      };
    });

    // Create quiz attempt
    const quizAttempt = await prisma.quizAttempt.create({
      data: {
        quizId,
        userId,
        score,
        answers: {
          create: attemptAnswers
        }
      },
      include: {
        answers: true
      }
    });


    res.json(quizAttempt);
  } catch (error) {
    console.error("Error submitting quiz attempt:", error);
    res.status(500).json({ error: "Failed to submit quiz attempt" });
  }
});

// Get quiz attempts for a quiz
router.get("/:quizId/attempts", authenticateToken, async (req: any, res: any) => {
  try {
    const { quizId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const attempts = await prisma.quizAttempt.findMany({
      where: {
        quizId,
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(attempts);
  } catch (error) {
    console.error("Error fetching quiz attempts:", error);
    res.status(500).json({ error: "Failed to fetch quiz attempts" });
  }
});


export default router;
