const request = require('supertest');
const { app } = require('../../app');
const { User, Post, sequelize } = require('../../models');
const bcrypt = require('bcrypt');

describe('New Features', () => {
    let user;

    beforeAll(async () => {
        await sequelize.sync({ force: true });

        // Create User
        const hashed = await bcrypt.hash('password123', 10);
        user = await User.create({ username: 'feature_user', password: hashed });

        // Create Post
        await Post.create({
            userId: user.id,
            slug: 'test-slug',
            title: 'Test Title',
            prompt: 'Test Prompt',
            content: '<p>Content</p>',
            rawContent: '# Content'
        });
    });

    // Mock Login Cookie
    // Since we use redis-session, mocking is harder without a real redis.
    // However, our `requireLogin` middleware checks `req.session.userId`.
    // We can mock the middleware OR just bypass it by setting the session store to MemoryStore for tests (ideal),
    // OR just use `supertest-session` or similar.
    // Given the constraints, I'll mock the middleware in the test using `jest.spyOn`?
    // No, `requireLogin` is a module export.

    // Actually, I can just write a test that hits the endpoints.
    // But authorization prevents it.
    // I will try to use `superagent` agent to persist cookies if I login first.

    const agent = request.agent(app);

    test('Login first', async () => {
        await agent
            .post('/login')
            .type('form')
            .send({ username: 'feature_user', password: 'password123' })
            .expect(302);
    });

    test('GET /settings should load', async () => {
        await agent.get('/settings').expect(200);
    });

    test('POST /settings should change password', async () => {
        await agent
            .post('/settings')
            .type('form')
            .send({ currentPassword: 'password123', newPassword: 'newpassword456' })
            .expect(200); // Renders settings page with success message

        // Verify in DB
        const updatedUser = await User.findByPk(user.id);
        expect(await bcrypt.compare('newpassword456', updatedUser.password)).toBe(true);
    });

    test('GET /post/:slug/download should return markdown', async () => {
        const res = await agent.get('/post/test-slug/download').expect(200);
        expect(res.headers['content-disposition']).toContain('test-slug.md');
        expect(res.text).toContain('# Content');
    });

    test('POST /post/:slug/delete should delete post', async () => {
        await agent.post('/post/test-slug/delete').expect(302);

        const deleted = await Post.findOne({ where: { slug: 'test-slug' } });
        expect(deleted).toBeNull();
    });
});
