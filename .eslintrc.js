module.exports = {
    env: {
        commonjs: true,
        es2021: true,
        node: true,
        jest: true
    },
    extends: ['standard', 'prettier'],
    plugins: ['prettier'],
    parserOptions: {
        ecmaVersion: 12
    },
    rules: {
        'prettier/prettier': 'error',
        'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
    }
};
