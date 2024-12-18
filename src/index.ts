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
import apiKeyRoutes from './routes/api-keys';
import adminRoutes from './routes/admin';
import axios from 'axios';

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
  origin: ['http://localhost:3000', 'https://neo-lecture.vercel.app'], // Allow requests from the frontend
  credentials: true, // Allow cookies and credentials
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Allowed methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Allow Authorization header
}));
// Handle preflight requests
app.options('*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ['http://localhost:3000', 'https://neo-lecture.vercel.app']);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(200);
});
app.use(express.json());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
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


// health check
app.get('/health', (req, res) => {
  res.send('ok');
});

// Routes
app.use('/auth', authRoutes);
app.use('/lectures', lectureRoutes);
app.use('/upload', uploadRoutes);
app.use('/flashcards', flashcardRoutes);
app.use('/quizzes', quizRoutes);
app.use('/users', userRoutes);
app.use('/ai', aiGeneratorRoutes);
app.use('/api-keys', apiKeyRoutes);
app.use('/admin', adminRoutes);

// make a proxy endpoint for this http://54.237.184.84:8000/generate-pptx/
app.use('/generate-pptx', (req: any, res: any) => {
  // get flashcards from the request body
  const flashcards = req.body.flashcards;
  // check if flashcards are present
  if (!flashcards) {
    return res.status(400).json({ message: 'Flashcards are required' });
  }
  // check if flashcards are an array
  if (!Array.isArray(flashcards)) {
    return res.status(400).json({ message: 'Flashcards must be an array' });
  }

  // make a request to generate the pptx

  const response = axios.post('http://54.237.184.84:8000/generate-pptx/', { flashcards });
  response.then((response) => {
    res.send(response.data);
  }).catch((error) => {
    res.status
  });
}
);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something broke!', error: process.env.NODE_ENV === 'development' ? err.message : undefined });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
