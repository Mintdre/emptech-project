const dotenv = require('dotenv');
dotenv.config();
const { sequelize, connectDB } = require('../config/database');

beforeAll(async () => {
    // Connect to DB before tests
    await connectDB();
});

afterAll(async () => {
    await sequelize.close(); // Close DB connection after tests
});
