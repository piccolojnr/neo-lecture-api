import { Router } from "express";
import prisma from "../lib/prisma";
import { authenticateToken } from "../middleware/auth";
import quizAttemptsRouter from "./quizAttempts";
import { unknown } from "zod";

const router = Router();

// Get all quizzes

// Create a new quiz
router.post("/", authenticateToken, async (req: any, res: any) => {
  try {
    const { title, lectureId, questions } = req.body;


    // Validate input
    if (!title || !lectureId || !questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: "Invalid input data" });
    }

    // Create quiz with questions
    const quiz = await prisma.quiz.create({

      data: {
        title,
        lectureId,
        questions: {
          create: questions.map(q => ({
            question: q.question,
            answer: q.answer,
            explanation: q.explanation,
            options: {
              create: q.options.map((o: any) => (o)),
            },
          })),
        },
      },

      include: {
        questions: {
          include: {
            options: true
          }
        }
      }
    });


    res.json(quiz);
  } catch (error) {
    console.error("Error creating quiz:", error);
    res.status(500).json({ error: "Failed to create quiz" });
  }
});

// Get a specific quiz
router.get("/:id", authenticateToken, async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const quiz = await prisma.quiz.findUnique({
      where: { id },
      include: {
        questions: {
          include: { options: true }
        }, lecture: true
      },
    });

    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    res.json(quiz);
  } catch (error) {
    console.error("Error fetching quiz:", error);
    res.status(500).json({ error: "Failed to fetch quiz" });
  }
});

// Update a quiz
router.put("/:id", authenticateToken, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { title, questions } = req.body;

    // Validate input
    if (!title || !questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: "Invalid input data" });
    }

    // Update quiz
    const quiz = await prisma.quiz.update({
      where: { id },
      data: {
        title,
        questions: {
          deleteMany: {}, // Clear old questions
          create: questions.map(q => ({
            question: q.question,
            answer: q.answer,
            options: {
              create: q.options.map((o: any) => (o)),
            },
          })),
        },
      },
      include: {
        questions: {
          include: {
            options: true
          }
        }
      }
    });


    res.json(quiz);
  } catch (error) {
    console.error("Error updating quiz:", error);
    res.status(500).json({ error: "Failed to update quiz" });
  }
});

// Delete a quiz
router.delete("/:id", authenticateToken, async (req: any, res: any) => {
  try {
    const { id } = req.params;

    await prisma.quiz.delete({
      where: { id },
    });

    res.json({ message: "Quiz deleted successfully" });
  } catch (error) {
    console.error("Error deleting quiz:", error);
    res.status(500).json({ error: "Failed to delete quiz" });
  }
});

router.use("/", quizAttemptsRouter);


export default router;
