import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { AIGenerator } from '../lib/ai-generator';
import { extractTextFromFile, splitTextIntoChunks } from '../lib/text-extractor';
import prisma from '../lib/prisma';
import fs from 'fs/promises';
import path from 'path';

const router = Router();

router.post('/extract-text', authenticateToken, async (req: any, res: any) => {
    try {
        console.log('Extracting text from files...');
        const { lectureId, fileIds } = req.body;

        if (!lectureId || !fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
            return res.status(400).json({ error: 'Missing lectureId or fileIds' });
        }

        // Fetch only the files that match the specified lecture and fileIds
        const files = await prisma.file.findMany({
            where: {
                lectureId,
                id: { in: fileIds }
            }
        });

        if (files.length === 0) {
            return res.status(404).json({ error: 'No matching files found for the given lecture and fileIds' });
        }

        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
        ];

        const results = [];

        for (const fileRecord of files) {
            // Determine file type from originalName extension
            const fileType = path.extname(fileRecord.originalName).substring(1).toLowerCase();

            // Read file from disk
            const fileBuffer = await fs.readFile(fileRecord.path);

            // Validate MIME type
            if (!allowedTypes.includes(fileRecord.mimeType)) {
                throw new Error(`Invalid file type: ${fileRecord.originalName}`);
            }

            // Validate file size
            if (fileRecord.size > 10 * 1024 * 1024) {
                throw new Error(`File size exceeds 10MB limit: ${fileRecord.originalName}`);
            }

            const text = await extractTextFromFile(fileBuffer, fileType);
            results.push({ fileName: fileRecord.originalName, text });
        }

        // Combine all extracted text
        const combinedText = results.map(r => r.text).join('\n\n');
        const chunks = splitTextIntoChunks(combinedText);

        res.json({ chunks, totalChunks: chunks.length });
    } catch (error: any) {
        console.error('Error extracting text:', error);
        res.status(500).json({ error: error.message || 'Failed to extract text' });
    }
});

// Generate flashcards from chunks
router.post('/generate/flashcards', authenticateToken, async (req: any, res: any) => {
    try {
        const { chunks, apiKey, lectureId, title } = req.body;

        if (!chunks || !apiKey || !lectureId || !title) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const generator = new AIGenerator(apiKey);
        const flashcards = [];

        // Process each chunk
        for (const chunk of chunks) {
            try {
                const generatedContent = await generator.generateFlashcards(chunk);
                flashcards.push(...generatedContent);
            } catch (error) {
                console.error('Error processing chunk:', error);
            }
        }

        if (flashcards.length === 0) {
            return res.status(500).json({ error: 'Failed to generate any valid flashcards' });
        }

        // Create flashcard set with generated flashcards
        const flashcardSet = await prisma.flashcardSet.create({
            data: {
                title,
                lectureId,
                flashcards: {
                    create: flashcards.map((card: any) => ({
                        front: card.front,
                        back: card.back,
                    })),
                },
            },
            include: {
                lecture: true,
                flashcards: true,
            },
        });

        res.json(flashcardSet);
    } catch (error) {
        console.error('Error generating flashcards:', error);
        res.status(500).json({ error: 'Failed to generate flashcards' });
    }
});


// Generate quiz from chunks
router.post('/generate/quiz', authenticateToken, async (req: any, res: any) => {
    try {
        const { chunks, apiKey, lectureId, title } = req.body;

        if (!chunks || !apiKey || !lectureId || !title) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const generator = new AIGenerator(apiKey);
        const questions = [];

        // Process each chunk
        for (const chunk of chunks) {
            try {
                const generatedContent = await generator.generateQuizzes(chunk);
                questions.push(...generatedContent);
            } catch (error) {
                console.error('Error processing chunk:', error);
            }
        }

        if (questions.length === 0) {
            return res.status(500).json({ error: 'Failed to generate any valid questions' });
        }




        // Transform questions for Prisma
        const transformedQuestions = questions.map((question: any) => ({
            question: question.question,
            answer: question.correctAnswer,
            explanation: question.explanation,
            options: {
                create: question.options.map((option: string) => ({
                    value: option,
                })),
            },
        }));


        // Create quiz with generated questions
        const quiz = await prisma.quiz.create({
            data: {
                title,
                lectureId,
                questions: {
                    create: transformedQuestions,
                },
            },
            include: {
                lecture: true,
                questions: true,
            },
        });

        res.json(quiz);
    } catch (error) {
        console.error('Error generating quiz:', error);
        res.status(500).json({ error: 'Failed to generate quiz' });
    }
});

export default router;
