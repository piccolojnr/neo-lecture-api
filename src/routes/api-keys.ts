import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import prisma from '../lib/prisma';
import { encrypt, decrypt } from '../lib/encryption';

const router = Router();

// Get all API keys for user
router.get('/', authenticateToken, async (req: any, res: any) => {
    try {
        const apiKeys = await prisma.aPIKey.findMany({
            where: {
                userId: req.user.userId
            },
            select: {
                id: true,
                name: true,
                provider: true,
                createdAt: true,
                updatedAt: true
            }
        });

        res.json(apiKeys);
    } catch (error) {
        console.error('Error fetching API keys:', error);
        res.status(500).json({ error: 'Failed to fetch API keys' });
    }
});

// Create new API key
router.post('/', authenticateToken, async (req: any, res: any) => {
    try {
        const { name, key, provider } = req.body;

        if (!name || !key || !provider) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Check if user already has a key for this provider
        const existingKey = await prisma.aPIKey.findFirst({
            where: {
                userId: req.user.userId,
                provider
            }
        });

        if (existingKey) {
            return res.status(400).json({ error: `You already have a ${provider} API key` });
        }

        // Encrypt the API key
        const encryptedKey = encrypt(key);

        const apiKey = await prisma.aPIKey.create({
            data: {
                name,
                key: encryptedKey,
                provider,
                userId: req.user.userId
            },
            select: {
                id: true,
                name: true,
                provider: true,
                createdAt: true,
                updatedAt: true
            }
        });

        res.json(apiKey);
    } catch (error) {
        console.error('Error creating API key:', error);
        res.status(500).json({ error: 'Failed to create API key' });
    }
});

// Update API key
router.put('/:id', authenticateToken, async (req: any, res: any) => {
    try {
        const { id } = req.params;
        const { name, key } = req.body;

        if (!name && !key) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        // Check if key exists and belongs to user
        const existingKey = await prisma.aPIKey.findFirst({
            where: {
                id,
                userId: req.user.userId
            }
        });

        if (!existingKey) {
            return res.status(404).json({ error: 'API key not found' });
        }

        const updateData: any = { name };
        if (key) {
            updateData.key = encrypt(key);
        }

        const apiKey = await prisma.aPIKey.update({
            where: { id },
            data: updateData,
            select: {
                id: true,
                name: true,
                provider: true,
                createdAt: true,
                updatedAt: true
            }
        });

        res.json(apiKey);
    } catch (error) {
        console.error('Error updating API key:', error);
        res.status(500).json({ error: 'Failed to update API key' });
    }
});

// Delete API key
router.delete('/:id', authenticateToken, async (req: any, res: any) => {
    try {
        const { id } = req.params;

        // Check if key exists and belongs to user
        const existingKey = await prisma.aPIKey.findFirst({
            where: {
                id,
                userId: req.user.userId
            }
        });

        if (!existingKey) {
            return res.status(404).json({ error: 'API key not found' });
        }

        await prisma.aPIKey.delete({
            where: { id }
        });

        res.json({ message: 'API key deleted successfully' });
    } catch (error) {
        console.error('Error deleting API key:', error);
        res.status(500).json({ error: 'Failed to delete API key' });
    }
});

// Get API key for specific provider
router.get('/provider/:provider', authenticateToken, async (req: any, res: any) => {
    try {
        const { provider } = req.params;

        const apiKey = await prisma.aPIKey.findFirst({
            where: {
                userId: req.user.userId,
                provider
            }
        });

        if (!apiKey) {
            return res.status(404).json({ error: 'API key not found' });
        }

        // Decrypt the key before sending
        const decryptedKey = decrypt(apiKey.key);

        res.json({
            ...apiKey,
            key: decryptedKey
        });
    } catch (error) {
        console.error('Error fetching API key:', error);
        res.status(500).json({ error: 'Failed to fetch API key' });
    }
});

export default router;
