import { decode, encode } from "gpt-tokenizer";
import axios from 'axios';



const api_extraction_url = process.env.API_EXTRACTION_URL || 'http://127.0.0.1:8000';

export const CHUNK_SIZE = 1800;

export async function extractTextFromFile(buffer: Buffer, fileType: string): Promise<string> {
    const formData = new FormData();
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    formData.append('file', blob, `file.${fileType}`);
    formData.append('enable_ocr', 'true');

    const apiUrl = `${api_extraction_url}/extract`;

    try {
        const response = await axios.post(apiUrl, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });

        return response.data.extracted_text;
    } catch (error: any) {
        console.error('Error extracting text from FastAPI:', error.message);
        throw new Error('Failed to extract text from FastAPI');
    }
}


export function splitTextIntoChunks(text: string, maxTokens: number = CHUNK_SIZE): string[] {
    const tokens = encode(text);
    const chunks: string[] = [];
    let currentChunk: number[] = [];

    for (const token of tokens) {
        if (currentChunk.length >= maxTokens) {
            // Find a good break point (end of sentence or paragraph)
            let breakPoint = currentChunk.length;
            const chunkText = decode(currentChunk);
            const lastPeriod = chunkText.lastIndexOf('.');
            const lastNewline = chunkText.lastIndexOf('\\n');

            if (lastPeriod > chunkText.length * 0.7) { // Break at period if it's in the last 30%
                breakPoint = lastPeriod + 1;
            } else if (lastNewline > chunkText.length * 0.7) { // Break at newline if period not found
                breakPoint = lastNewline + 1;
            }

            chunks.push(decode(currentChunk.slice(0, breakPoint)).trim());
            currentChunk = currentChunk.slice(breakPoint);
        }
        currentChunk.push(token);
    }

    if (currentChunk.length > 0) {
        chunks.push(decode(currentChunk).trim());
    }

    return chunks;
}
