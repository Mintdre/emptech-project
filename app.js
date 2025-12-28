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
const validateEnv = require('./config/validateEnv');

// Validate Env
validateEnv();

// --- 1. LOGGING SYSTEM ---
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(
            ({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`
        )
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'guild_logs.log' })
    ]
});

// --- 2. DATABASE SETUP ---
connectDB();

// --- 3. REDIS & APP CONFIG ---
let redisClient;
let sessionStore;

if (process.env.NODE_ENV !== 'test') {
    redisClient = createClient({ url: process.env.REDIS_URL });
    redisClient.connect().catch(console.error);
    sessionStore = new RedisStore({ client: redisClient });
} else {
    // In test mode, use default MemoryStore (sessionStore undefined)
    console.log('Test mode: Using MemoryStore for session');
}

const app = express();
app.set('trust proxy', 1);

app.use(helmetConfig);
app.use(globalLimiter);
app.use(morgan('dev', { stream: { write: (msg) => logger.info(msg.trim()) } }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Session Config
app.use(
    session({
        store: sessionStore, // undefined means MemoryStore
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: { maxAge: 86400000 } // 24 Hours
    })
);

// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// --- 4. ROUTES ---
app.use('/', authRoutes);
app.use('/', billingRoutes);
app.use('/', appRoutes);

// Error Handler (must be last)
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

module.exports = { app, logger };
