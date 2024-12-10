import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';

const JWT_ADMIN_SECRET = process.env.JWT_ADMIN_SECRET || 'your-admin-jwt-secret-key';
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'your-admin-secret-key';

// Rate limiter for admin login
export const adminLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: 'Too many login attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});

// Generate admin token
export function generateAdminToken(): string {
    return jwt.sign({ isAdmin: true }, JWT_ADMIN_SECRET, { expiresIn: '1h' });
}

// Verify admin secret key
export function verifyAdminKey(key: string): boolean {
    return key === ADMIN_SECRET_KEY;
}

// Admin authentication middleware
export const authenticateAdmin = (req: Request, res: Response, next: NextFunction): void => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            res.status(401).json({ error: 'No token provided' });
            return;
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            res.status(401).json({ error: 'Invalid token format' });
            return;
        }

        // Verify admin token
        const decoded = jwt.verify(token, JWT_ADMIN_SECRET) as { isAdmin: boolean };
        if (!decoded.isAdmin) {
            res.status(403).json({ error: 'Not authorized as admin' });
            return;
        }

        next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            res.status(401).json({ error: 'Token expired' });
            return;
        }
        res.status(403).json({ error: 'Invalid token' });
        return;
    }
}

// Audit logging middleware
export function auditLog(req: Request, res: Response, next: NextFunction) {
    const timestamp = new Date().toISOString();
    const method = req.method;
    const url = req.originalUrl;
    const ip = req.ip;

    console.log(`[ADMIN AUDIT] ${timestamp} - ${method} ${url} - IP: ${ip}`);
    next();
}
