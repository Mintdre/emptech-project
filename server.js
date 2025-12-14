require('dotenv').config();
const express = require('express');
const session = require('express-session');
const RedisStore = require('connect-redis').RedisStore;
const { createClient } = require('redis');
const winston = require('winston');
const morgan = require('morgan');

const { connectDB } = require('./config/database');
const { helmetConfig, globalLimiter } = require('./middleware/security');
const authRoutes = require('./routes/authRoutes');
const billingRoutes = require('./routes/billingRoutes');
const appRoutes = require('./routes/appRoutes');

// --- 1. LOGGING SYSTEM ---
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`)
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'guild_logs.log' })
    ]
});

// --- 2. DATABASE SETUP ---
connectDB();

// --- 3. REDIS & APP CONFIG ---
const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);

const app = express();
const PORT = process.env.PORT || 6769;

app.use(helmetConfig);
app.use(globalLimiter);
app.use(morgan('dev', { stream: { write: msg => logger.info(msg.trim()) } }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Session Config
app.use(session({
    store: new RedisStore({ client: redisClient }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 86400000 } // 24 Hours
}));

// --- 4. ROUTES ---
app.use('/', authRoutes);
app.use('/', billingRoutes);
app.use('/', appRoutes);

// --- SERVER START ---
if (require.main === module) {
    app.listen(PORT, () => {
        logger.info(`------------------------------------------------`);
        logger.info(`🏰 ORACLE OS ONLINE: http://localhost:${PORT}`);
        logger.info(`💾 DATABASE: PostgreSQL + Redis`);
        logger.info(`------------------------------------------------`);
    });
}

module.exports = app;