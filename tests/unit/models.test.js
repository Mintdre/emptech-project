const { User, Post } = require('../../models');

describe('User Model', () => {
    test('should validate required fields', async () => {
        try {
            await User.build({}).validate();
        } catch (e) {
            expect(e).toBeDefined();
            expect(e.name).toBe('SequelizeValidationError');
        }
    });

    test('should default tier to Free', () => {
        const user = User.build({ username: 'test', password: 'pw' });
        expect(user.tier).toBe('Free');
    });
});
