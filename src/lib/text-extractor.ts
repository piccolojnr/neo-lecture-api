import mammoth from 'mammoth';
import { decode, encode } from "gpt-tokenizer";
import pdfParse from 'pdf-parse';


export const CHUNK_SIZE = 1800;

export async function extractTextFromFile(buffer: Buffer, fileType: string): Promise<string> {
    // Use legacy build for Node

    let extractedText = '';

    switch (fileType.toLowerCase()) {
        case 'pdf':
            const uint8Array = new Uint8Array(buffer);
            const dataBuffer = Buffer.from(uint8Array);
            const data = await pdfParse(dataBuffer);

            extractedText = data.text;
            break;
        case 'docx':
            const result = await mammoth.extractRawText({ buffer: buffer });
            extractedText = result.value;
            break;

        case 'txt':
            extractedText = buffer.toString('utf-8');
            break;

        default:
            throw new Error('Unsupported file type');
    }

    return extractedText;
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
