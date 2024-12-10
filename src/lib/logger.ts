import fs from 'fs/promises';

class Logger {
    private logFilePath: string;

    constructor(logFilePath: string = 'error.log') {
        this.logFilePath = logFilePath;
    }

    async logError(error: any, context: any = {}): Promise<void> {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            error: this.formatError(error),
            context,
        };

        const logContent = `${JSON.stringify(logEntry, null, 2)}\n`;
        await fs.appendFile(this.logFilePath, logContent);
    }

    private formatError(error: any): any {
        if (error instanceof Error) {
            return {
                name: error.name,
                message: error.message,
                stack: error.stack,
            };
        }
        return error;
    }
}


export default Logger;