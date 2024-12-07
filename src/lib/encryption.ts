import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-fallback-encryption-key-min-32-chars!!';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const ENCRYPTION_KEY_LENGTH = 32;
const ITERATIONS = 100000;

function getEncryptionKey(salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, ITERATIONS, ENCRYPTION_KEY_LENGTH, 'sha256');
}

export function encrypt(text: string): string {
    // Generate salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);

    // Generate key
    const key = getEncryptionKey(salt);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt the text
    const encrypted = Buffer.concat([
        cipher.update(text, 'utf8'),
        cipher.final()
    ]);

    // Get auth tag
    const tag = cipher.getAuthTag();

    // Combine all parts
    const result = Buffer.concat([
        salt,
        iv,
        tag,
        encrypted
    ]);

    return result.toString('base64');
}

export function decrypt(encryptedText: string): string {
    // Convert from base64
    const buffer = Buffer.from(encryptedText, 'base64');

    // Extract the parts
    const salt = buffer.subarray(0, SALT_LENGTH);
    const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = buffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

    // Generate key
    const key = getEncryptionKey(salt);

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    // Decrypt the text
    const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
    ]);

    return decrypted.toString('utf8');
}
