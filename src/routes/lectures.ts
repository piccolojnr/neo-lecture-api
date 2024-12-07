import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken } from '../middleware/auth';
import prisma from '../lib/prisma';
import { z } from 'zod';

const router = express.Router();

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, TXT, DOC, and DOCX files are allowed.'));
    }
  }
});

const createLectureSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
});

// Get all lectures for the authenticated user
router.get('/', authenticateToken, async (req: any, res: any) => {
  try {
    const lectures = await prisma.lecture.findMany({
      where: {
        userId: req.user!.userId,
      },
      include: {
        files: true,
        flashcardSets: {
          include: {
            flashcards: true
          }
        },
        quizzes: {
          include: {
            questions: true
          }
        },
        _count: {
          select: { flashcardSets: true, quizzes: true, files: true }
        }
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(lectures);
  } catch (error) {
    console.error('Error fetching lectures:', error);
    res.status(500).json({ message: 'Error fetching lectures' });
  }
});

// Get a specific lecture
router.get('/:id', authenticateToken, async (req: any, res: any) => {
  try {
    const lecture = await prisma.lecture.findUnique({
      where: {
        id: req.params.id,
      },
      include: {
        files: true,
        flashcardSets: {
          include: {
            flashcards: true,
          }
        },
        quizzes: {
          include: {
            questions: true,
          }
        },
        _count: {
          select: {
            files: true,
            flashcardSets: true,
            quizzes: true
          }
        }
      },
    });

    if (!lecture) {
      return res.status(404).json({ message: 'Lecture not found' });
    }

    if (lecture.userId !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to view this lecture' });
    }

    res.json(lecture);
  } catch (error) {
    console.error('Get lecture error:', error);
    res.status(500).json({ message: 'Error getting lecture' });
  }
});

// Create a new lecture
router.post('/', authenticateToken, upload.array('files', 5), async (req: any, res: any) => {
  try {
    const { title, description } = createLectureSchema.parse(req.body);
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const lecture = await prisma.lecture.create({
      data: {
        title,
        description,
        userId: req.user!.userId,
        files: {
          create: files.map(file => ({
            filename: file.filename,
            originalName: file.originalname,
            path: file.path,
            mimeType: file.mimetype,
            size: file.size,
          }))
        }
      },
      include: {
        files: true,
      }
    });

    res.status(201).json(lecture);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid input', errors: error.errors });
    }
    console.error('Error creating lecture:', error);
    res.status(500).json({ message: 'Error creating lecture' });
  }
});

// Update a lecture
router.put('/:id', authenticateToken, upload.array('files', 5), async (req: any, res: any) => {
  try {
    const { title, description } = createLectureSchema.parse(req.body);
    const files = req.files as Express.Multer.File[];

    const existingLecture = await prisma.lecture.findUnique({
      where: { id: req.params.id },
      include: { files: true }
    });

    if (!existingLecture) {
      return res.status(404).json({ message: 'Lecture not found' });
    }

    if (existingLecture.userId !== req.user!.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Create new files if any were uploaded
    const fileCreates = files?.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      path: file.path,
      mimeType: file.mimetype,
      size: file.size,
    })) || [];

    const updatedLecture = await prisma.lecture.update({
      where: { id: req.params.id },
      data: {
        title,
        description,
        files: {
          create: fileCreates
        }
      },
      include: {
        files: true
      }
    });

    res.json(updatedLecture);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid input', errors: error.errors });
    }
    console.error('Error updating lecture:', error);
    res.status(500).json({ message: 'Error updating lecture' });
  }
});

// Add files to existing lecture
router.post('/:id/files', authenticateToken, upload.array('files', 5), async (req: any, res: any) => {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const lecture = await prisma.lecture.findUnique({
      where: { id: req.params.id },
      include: { files: true }
    });

    if (!lecture) {
      return res.status(404).json({ message: 'Lecture not found' });
    }

    if (lecture.userId !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to modify this lecture' });
    }

    const updatedLecture = await prisma.lecture.update({
      where: { id: req.params.id },
      data: {
        files: {
          create: files.map(file => ({
            filename: file.filename,
            originalName: file.originalname,
            path: file.path,
            mimeType: file.mimetype,
            size: file.size,
          }))
        }
      },
      include: {
        files: true,
        flashcardSets: {
          include: {
            flashcards: true,
          }
        },
        quizzes: {
          include: {
            questions: true,
          }
        },
        _count: {
          select: {
            files: true,
            flashcardSets: true,
            quizzes: true
          }
        }
      }
    });

    res.json(updatedLecture);
  } catch (error) {
    console.error('Add files error:', error);
    res.status(500).json({ message: 'Error adding files' });
  }
});

// Delete a file from a lecture
router.delete('/:lectureId/files/:fileId', authenticateToken, async (req: any, res: any) => {
  try {
    const { lectureId, fileId } = req.params;

    const lecture = await prisma.lecture.findUnique({
      where: { id: lectureId },
      include: { files: true }
    });

    if (!lecture) {
      return res.status(404).json({ message: 'Lecture not found' });
    }

    if (lecture.userId !== req.user!.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const file = lecture.files.find(f => f.id === fileId);
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Delete file from filesystem
    try {
      fs.unlinkSync(file.path);
    } catch (err) {
      console.error('Error deleting file from filesystem:', err);
    }

    // Delete file from database
    await prisma.file.delete({
      where: { id: fileId }
    });

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ message: 'Error deleting file' });
  }
});

// Delete a lecture
router.delete('/:id', authenticateToken, async (req: any, res: any) => {
  try {
    const lecture = await prisma.lecture.findUnique({
      where: { id: req.params.id },
      include: { files: true }
    });

    if (!lecture) {
      return res.status(404).json({ message: 'Lecture not found' });
    }

    if (lecture.userId !== req.user!.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Delete associated files from filesystem
    for (const file of lecture.files) {
      try {
        fs.unlinkSync(file.path);
      } catch (err) {
        console.error('Error deleting file from filesystem:', err);
      }
    }

    // Delete lecture (this will cascade delete files from database)
    await prisma.lecture.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Lecture deleted successfully' });
  } catch (error) {
    console.error('Error deleting lecture:', error);
    res.status(500).json({ message: 'Error deleting lecture' });
  }
});

export default router;
