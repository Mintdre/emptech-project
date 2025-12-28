module.exports = {
    testEnvironment: 'node',
    verbose: true,
    setupFilesAfterEnv: ['./tests/setup.js'],
    testMatch: ['**/tests/**/*.test.js'],
    moduleNameMapper: {
        '^marked$': '<rootDir>/tests/mocks/marked.js'
    },
    collectCoverage: true,
    collectCoverageFrom: [
        '**/*.js',
        '!**/node_modules/**',
        '!**/tests/**',
        '!**/coverage/**',
        '!jest.config.js',
        '!**/config/**'
    ],
    coverageDirectory: './coverage',
    testTimeout: 10000,
    maxWorkers: 1
};
