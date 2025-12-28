const request = require('supertest');
const app = require('../../server'); // This already sets up the app
const { User, sequelize } = require('../../models');
const bcrypt = require('bcrypt');

describe('App Routes', () => {
    let agent;

    beforeAll(async () => {
        await sequelize.sync({ force: true });
        const hashedPassword = await bcrypt.hash('password123', 10);
        await User.create({ username: 'testuser', password: hashedPassword });

        agent = request.agent(app);
    });

    afterAll(async () => {
        await sequelize.close();
    });

    test('GET / should redirect to login if not authenticated', async () => {
        const res = await request(app).get('/');
        expect(res.statusCode).toEqual(302);
        expect(res.headers.location).toBe('/login');
    });

    test('GET /settings should redirect to login if not authenticated', async () => {
        const res = await request(app).get('/settings');
        expect(res.statusCode).toEqual(302);
        expect(res.headers.location).toBe('/login');
    });

    test('Login flow and access protected route', async () => {
        // Login first using the agent
        await agent
            .post('/login')
            .type('form')
            .send({ username: 'testuser', password: 'password123' })
            .expect(302)
            .expect('Location', '/');

        // Now access /settings
        const res = await agent.get('/settings');
        expect(res.statusCode).toEqual(200);
        expect(res.text).toContain('Settings'); // Assuming title or content
    });

    test('GET /legal should be public', async () => {
        const res = await request(app).get('/legal');
        expect(res.statusCode).toEqual(200);
    });
});
