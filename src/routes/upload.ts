import express, { ErrorRequestHandler } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [
    'application/pdf',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, TXT, and Word documents are allowed.'));
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
});

// Handle file upload
router.post('/', authenticateToken, upload.single('file'), async (req: any, res: any) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Create a new lecture entry
    const lecture = {
      id: Date.now().toString(),
      title: req.file.originalname,
      filePath: req.file.path,
      userId: req.user.id,
      createdAt: new Date().toISOString(),
      _count: {
        flashcardSets: 0,
        Quizzes: 0,
      },
    };

    // Store lecture in your database
    // For now, we'll use the lectures Map from the lectures route
    const lectures = req.app.locals.lectures || new Map();
    lectures.set(lecture.id, lecture);
    req.app.locals.lectures = lectures;

    // Process the file content (you can add your own processing logic here)
    // For example, extract text from PDF, parse Word documents, etc.

    res.status(201).json({
      id: lecture.id,
      title: lecture.title,
      createdAt: lecture.createdAt,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({
      message: error.message || 'Error processing file upload',
    });
  }
});

const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ message: 'File is too large. Maximum size is 10MB' });
      return;
    }
    res.status(400).json({ message: err.message });
    return;
  }

  if (err) {
    res.status(400).json({ message: err.message });
    return;
  }

  next();
};


router.use(errorHandler);

export default router;
