import OpenAI, { type APIError } from 'openai';
import { z } from 'zod';
import fs from 'fs/promises';
import Logger from './logger';

export const CHUNK_SIZE = 1800;
export const RETRY_CONFIG = {
    MAX_RETRIES: 3,
    BASE_DELAY: 1000,
    MAX_DELAY: 10000,
    JITTER: 0.1
} as const;

// Validation schemas
const quizSchema = z.array(z.object({
    question: z.string().min(1, "Question must be at least 1 characters long"),
    options: z.array(z.string().min(1, "Option must not be empty")).length(4, "Must have exactly 4 options"),
    correctAnswer: z.string().refine(val => val.length > 0, "Correct answer must not be empty"),
    explanation: z.string().max(500, "Explanation must not exceed 500 characters").optional(),
}));

const flashcardSchema = z.array(z.object({
    front: z.string().min(1, "Front must be at least 1 characters long"),
    back: z.string().min(1, "Back must be at least 1 characters long"),
}));

// Prompts
const quizPrompt = (chunk: string) => `
Convert the following text into a set of quiz questions in JSON format using the structure strictly as specified below. 
You must not deviate from the format. Make sure to include all relevant information from the provided text that pertains 
to the lecture (e.g., key points, concepts, examples, and mathematical equations).

The quiz format is as follows:

[
  {
    "question": "<Quiz question>",
    "options": ["<Option 1>", "<Option 2>", "<Option 3>", "<Option 4>"],
    "correctAnswer": "<Correct option>",
    "explanation": "<Optional explanation>"
  }
]

Instructions for Quiz Generation:
1. Each quiz question should be phrased clearly and relate to key concepts, examples, or mathematical problems from the lecture.
2. Provide four answer options for each question, one of which should be the correct answer.
3. The correctAnswer field should indicate the correct option.
5. Explanation is optional but recommended for complex topics or math problems.
6. If mathematical content is included, format equations properly using markdown.
7. Strictly use the given format without deviating from it.
8. Explanation must not exceed 500 characters.
10. Try to cover every thing in the chunk if possible and meet the requirements.

Text Chunk:

${chunk}`;

const flashcardPrompt = (chunk: string) => `
Convert the following text into a set of flashcards in JSON format using the structure strictly as specified below. 
You must not deviate from the format. Make sure to include all relevant information from the provided text that pertains 
to the lecture (e.g., key points, concepts, examples, and mathematical equations).

The flashcard format is as follows:

[
  {
    "front": "<Flashcard front>",
    "back": "<Flashcard back>",
  }
]

Instructions for Flashcard Generation:
1. Each flashcard should contain a clear question/concept on the front and comprehensive answer/explanation on the back.
2. format the chunk first and then break it down into flashcards.
3. source the information from the chunk and make sure to include all relevant details.
3. if the information in the chunk is wrong correct it before breaking it down into flashcards.
4. the chunks might is a part of a bigger chunk that was broken down into smaller chunks, so the information might be incomplete, if so, correct it.
5. Break down complex topics or math problems into multiple flashcards for clarity.
6. Strictly use the given format without deviating from it.
7. If mathematical content is included, format equations properly using markdown.
8. Try to keep the back concise and to the point.
9. Try to cover every thing in the chunk if possible and meet the requirements.

Text Chunk:

${chunk}`;

export class AIGenerator {
    private openai: OpenAI;
    private maxRetries: number;
    private logger: Logger;

    constructor(apiKey: string, provider: string, maxRetries: number = RETRY_CONFIG.MAX_RETRIES, logFilePath: string = 'error.log') {
        this.openai = new OpenAI({
            apiKey,
            baseURL: provider === "groq" ? "https://api.groq.com/openai/v1" : null,
        });
        this.maxRetries = maxRetries;
        this.logger = new Logger(logFilePath);
    }

    private async processWithRetry(prompt: string, attempt: number = 0): Promise<any> {
        try {
            const completion = await this.openai.chat.completions.create({
                model: 'llama-3.1-70b-versatile',
                messages: [
                    {
                        role: "system",
                        content: "You are a helpful assistant that generates educational content in JSON format.",
                    },
                    {
                        role: "user",
                        content: prompt,
                    },
                ],
                response_format: { type: "json_object" },
            });

            const content = completion.choices[0]?.message?.content;
            if (!content) {
                throw new Error("No content generated");
            }

            return JSON.parse(content);
        } catch (error: APIError | any) {
            const context = { prompt, attempt };
            await this.logger.logError(error, context);

            if (attempt >= this.maxRetries) {
                if (error?.error?.failed_generation) {
                    try {
                        const failedData = JSON.parse('[' + error.error.failed_generation + ']');
                        return failedData;
                    } catch (parseError) {
                        console.error("Failed to parse failed_generation: ", parseError);
                        throw new Error("Failed to parse failed generation data");
                    }
                }
            }

            const delay = this.calculateRetryDelay(attempt);
            await new Promise((resolve) => setTimeout(resolve, delay));
            return this.processWithRetry(prompt, attempt + 1);
        }
    }

    private calculateRetryDelay(attempt: number): number {
        const exponentialDelay = Math.min(
            RETRY_CONFIG.BASE_DELAY * Math.pow(2, attempt),
            RETRY_CONFIG.MAX_DELAY
        );
        const jitter = exponentialDelay * RETRY_CONFIG.JITTER * Math.random();
        return exponentialDelay + jitter;
    }
    private parseResults(results: any, type: 'quiz' | 'flashcard'): any[] {
        // result might be an object or an array
        if (Array.isArray(results)) {
            return results;
        } else {
            const key = Object.keys(results);

            for (const k of key) {
                if (Array.isArray(results[k])) {
                    return results[k];
                }
                if (results[k] instanceof Object) {
                    return this.parseResults(results[k], type);
                }
            }
        }

        return [];
    }
    private validateContent(content: any, type: 'quiz' | 'flashcard'): boolean {
        try {
            const schema = type === 'quiz' ? quizSchema : flashcardSchema;
            schema.parse(content);
            return true;
        } catch (error: any) {
            console.error("Content :", content);

            console.error("Content validation error:", error);
            return false;
        }
    }
    public async generateQuizzes(text: string): Promise<any> {
        try {
            const result = await this.processWithRetry(quizPrompt(text));
            const parsedResults = this.parseResults(result, 'quiz');
            if (!this.validateContent(parsedResults, 'quiz')) {
                await this.logger.logError(
                    new Error("Validation failed for quiz content"),
                    { parsedResults }
                );
                throw new Error("Generated quiz content failed validation");
            }
            return parsedResults;
        } catch (error) {
            await this.logger.logError(error, { text });
            throw error;
        }
    }

    public async generateFlashcards(text: string): Promise<any> {
        try {
            const result = await this.processWithRetry(flashcardPrompt(text));
            const parsedResults = this.parseResults(result, 'flashcard');
            if (!this.validateContent(parsedResults, 'flashcard')) {
                await this.logger.logError(
                    new Error("Validation failed for flashcard content"),
                    { parsedResults }
                );
                throw new Error("Generated flashcard content failed validation");
            }
            return parsedResults;
        } catch (error) {
            await this.logger.logError(error, { text });
            throw error;
        }
    }
}
