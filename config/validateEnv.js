const { cleanEnv, str, port, url } = require('envalid');

function validateEnv() {
    cleanEnv(process.env, {
        NODE_ENV: str({ choices: ['development', 'test', 'production', 'provision'] }),
        PORT: port({ default: 6769 }),
        POSTGRES_URI: str({ desc: 'PostgreSQL connection string' }),
        REDIS_URL: url({ desc: 'Redis connection URL' }),
        SESSION_SECRET: str({ desc: 'Session secret for signing cookies' }),
        ENCRYPTION_KEY: str({ desc: '32-byte hex string for encryption' }),
        GEMINI_API_KEY: str({ desc: 'Google Gemini API Key' })
    });
}

module.exports = validateEnv;
