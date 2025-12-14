const request = require('supertest');
const app = require('../../server');
const { sequelize } = require('../../models');

describe('Security Features', () => {

    beforeAll(async () => {
        // Just ensure DB is connected, though these tests might not hit DB heavily
        await sequelize.authenticate();
    });

    afterAll(async () => {
        await sequelize.close();
    });

    test('should have Helmet headers', async () => {
        const res = await request(app).get('/');
        // Helmet adds Content-Security-Policy
        expect(res.headers['content-security-policy']).toBeDefined();
        // Helmet removes X-Powered-By
        expect(res.headers['x-powered-by']).toBeUndefined();
    });

    test('Global Rate Limit headers should be present', async () => {
        const res = await request(app).get('/');
        // standardHeaders: true adds RateLimit-* headers
        expect(res.headers['ratelimit-limit']).toBeDefined();
        expect(res.headers['ratelimit-remaining']).toBeDefined();
    });
});
