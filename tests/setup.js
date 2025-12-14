const dotenv = require('dotenv');
dotenv.config();
const { sequelize } = require('../config/database');

beforeAll(async () => {
    // Sync DB before tests (force: true to clear data if needed, but strict layout is better)
    // For now just ensure connection works or we could mock it entirely in unit tests
});

afterAll(async () => {
    await sequelize.close(); // Close DB connection after tests
});
