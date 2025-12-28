const request = require('supertest');
const app = require('../../server');
const { User, sequelize } = require('../../models');
const bcrypt = require('bcrypt');

describe('Auth Endpoints', () => {
    beforeAll(async () => {
        await sequelize.sync({ force: true }); // Reset DB for tests
    });

    afterAll(async () => {
        await sequelize.close();
    });

    test('POST /register should create a user', async () => {
        const res = await request(app)
            .post('/register')
            .type('form')
            .send({ username: 'newuser', password: 'password123' });

        // It redirects to / on success
        expect(res.statusCode).toEqual(302);
        expect(res.headers.location).toBe('/');

        const user = await User.findOne({ where: { username: 'newuser' } });
        expect(user).not.toBeNull();
        expect(await bcrypt.compare('password123', user.password)).toBe(true);
    });

    test('POST /login should log in existing user', async () => {
        const res = await request(app)
            .post('/login')
            .type('form')
            .send({ username: 'newuser', password: 'password123' });

        expect(res.statusCode).toEqual(302);
        expect(res.headers.location).toBe('/');
    });

    test('POST /login with wrong password should fail', async () => {
        const res = await request(app)
            .post('/login')
            .type('form')
            .send({ username: 'newuser', password: 'wrong' });

        expect(res.statusCode).toEqual(200); // Renders login page again
        // Ideally we check for error message content, but JSDOM wrapper or simple string check works
        expect(res.text).toContain('Invalid credentials');
    });
});
