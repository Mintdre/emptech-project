module.exports = {
    testEnvironment: 'node',
    verbose: true,
    setupFilesAfterEnv: ['./tests/setup.js'],
    testMatch: ['**/tests/**/*.test.js'],
    moduleNameMapper: {
        '^marked$': '<rootDir>/tests/mocks/marked.js',
    },
};
