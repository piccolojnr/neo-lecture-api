import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { rateLimit } from 'express-rate-limit';
import path from 'path';
import fs from 'fs';

// Routes
import authRoutes from './routes/auth';
import lectureRoutes from './routes/lectures';
import uploadRoutes from './routes/upload';
import flashcardRoutes from './routes/flashcards';
import quizRoutes from './routes/quizzes';
import userRoutes from './routes/users';
import aiGeneratorRoutes from './routes/ai-generator';

// Load environment variables
dotenv.config();

const app = express();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Initialize global storage for lectures (temporary solution)
app.locals.lectures = new Map();

// Routes
app.use('/auth', authRoutes);
app.use('/lectures', lectureRoutes);
app.use('/upload', uploadRoutes);
app.use('/flashcards', flashcardRoutes);
app.use('/quizzes', quizRoutes);
app.use('/users', userRoutes);
app.use('/ai', aiGeneratorRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something broke!', error: process.env.NODE_ENV === 'development' ? err.message : undefined });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
