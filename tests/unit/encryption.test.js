const { encrypt, decrypt } = require('../../utils/encryption');

describe('Encryption Utility', () => {
    test('should encrypt and decrypt correctly', () => {
        const text = 'Hello World';
        const encrypted = encrypt(text);
        expect(encrypted).not.toBe(text);
        expect(encrypted).toContain(':'); // IV separator

        const decrypted = decrypt(encrypted);
        expect(decrypted).toBe(text);
    });

    test('should return null for empty input', () => {
        expect(encrypt(null)).toBeNull();
        expect(decrypt(null)).toBeNull();
    });

    test('should return original text if decryption fails (legacy support)', () => {
        const text = 'NotEncrypted';
        // The current implementation returns original text on error
        expect(decrypt(text)).toBe(text);
    });
});
