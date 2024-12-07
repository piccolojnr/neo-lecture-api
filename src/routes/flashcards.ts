import express from 'express';
import  prisma  from '../lib/prisma';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Create a flashcard set
router.post('/', authenticateToken, async (req: any, res: any) => {
  try {
    const { title, lectureId, flashcards } = req.body;

    const lecture = await prisma.lecture.findUnique({
      where: { id: lectureId },
    });

    if (!lecture) {
      return res.status(404).json({ message: 'Lecture not found' });
    }

    if (lecture.userId !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to modify this lecture' });
    }

    const flashcardSet = await prisma.flashcardSet.create({
      data: {
        title,
        lectureId,
        flashcards: {
          create: flashcards.map((card: { front: string; back: string }) => ({
            front: card.front,
            back: card.back,
          })),
        },
      },
      include: {
        flashcards: true,
      },
    });

    res.json(flashcardSet);
  } catch (error) {
    console.error('Create flashcard set error:', error);
    res.status(500).json({ message: 'Error creating flashcard set' });
  }
});

// Get a flashcard set
router.get('/:id', authenticateToken, async (req: any, res: any) => {
  try {
    const flashcardSet = await prisma.flashcardSet.findUnique({
      where: { id: req.params.id },
      include: {
        flashcards: true,
        lecture: true,
      },
    });

    if (!flashcardSet) {
      return res.status(404).json({ message: 'Flashcard set not found' });
    }

    if (flashcardSet.lecture.userId !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to view this flashcard set' });
    }

    res.json(flashcardSet);
  } catch (error) {
    console.error('Get flashcard set error:', error);
    res.status(500).json({ message: 'Error getting flashcard set' });
  }
});

// Update a flashcard set
router.put('/:id', authenticateToken, async (req: any, res: any) => {
  try {
    const { title, flashcards } = req.body;

    const existingSet = await prisma.flashcardSet.findUnique({
      where: { id: req.params.id },
      include: { lecture: true },
    });

    if (!existingSet) {
      return res.status(404).json({ message: 'Flashcard set not found' });
    }

    if (existingSet.lecture.userId !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to modify this flashcard set' });
    }

    // Delete existing flashcards
    await prisma.flashcard.deleteMany({
      where: { flashcardSetId: req.params.id },
    });

    // Update the set and create new flashcards
    const updatedSet = await prisma.flashcardSet.update({
      where: { id: req.params.id },
      data: {
        title,
        flashcards: {
          create: flashcards.map((card: { front: string; back: string }) => ({
            front: card.front,
            back: card.back,
          })),
        },
      },
      include: {
        flashcards: true,
      },
    });

    res.json(updatedSet);
  } catch (error) {
    console.error('Update flashcard set error:', error);
    res.status(500).json({ message: 'Error updating flashcard set' });
  }
});

// Delete a flashcard set
router.delete('/:id', authenticateToken, async (req: any, res: any) => {
  try {
    const flashcardSet = await prisma.flashcardSet.findUnique({
      where: { id: req.params.id },
      include: { lecture: true },
    });

    if (!flashcardSet) {
      return res.status(404).json({ message: 'Flashcard set not found' });
    }

    if (flashcardSet.lecture.userId !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to delete this flashcard set' });
    }

    await prisma.flashcardSet.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Flashcard set deleted successfully' });
  } catch (error) {
    console.error('Delete flashcard set error:', error);
    res.status(500).json({ message: 'Error deleting flashcard set' });
  }
});

export default router;
