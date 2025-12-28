const request = require('supertest');
const { app } = require('../../app'); // Import app directly now
const { sequelize } = require('../../models');

describe('Health Check', () => {
    beforeAll(async () => {
        // Just ensure DB connection or skip if not needed for health
        try {
            await sequelize.authenticate();
        } catch (e) {}
    });

    afterAll(async () => {
        await sequelize.close();
    });

    test('GET /health should return 200 OK', async () => {
        const res = await request(app).get('/health');
        expect(res.statusCode).toEqual(200);
        expect(res.body.status).toBe('ok');
    });
});
