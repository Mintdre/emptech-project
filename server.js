require('dotenv').config();
const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const session = require('express-session');
const RedisStore = require('connect-redis').RedisStore;
const { createClient } = require('redis');
const bcrypt = require('bcrypt');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const marked = require('marked');
const createDomPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const winston = require('winston');
const morgan = require('morgan');
const crypto = require('crypto'); // For generating random IDs

// --- 1. LOGGING ---
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

// --- 2. DATABASE ---
const sequelize = new Sequelize(process.env.POSTGRES_URI, { logging: false, dialectOptions: { ssl: false } });

// Models
const User = sequelize.define('User', {
    username: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false }
});

const Post = sequelize.define('Post', {
    slug: { type: DataTypes.STRING, unique: true, allowNull: false }, // The 12-char ID
    prompt: { type: DataTypes.TEXT, allowNull: false },               // The original question
    content: { type: DataTypes.TEXT, allowNull: false },              // The generated HTML
    title: { type: DataTypes.STRING, allowNull: false }               // Short title for sidebar
});

// Relationships (One User has Many Posts)
User.hasMany(Post, { foreignKey: 'userId' });
Post.belongsTo(User, { foreignKey: 'userId' });

sequelize.authenticate()
    .then(() => {
        logger.info('🔮 Connected to PostgreSQL');
        return sequelize.sync(); // Updates tables automatically
    })
    .catch(err => logger.error(`❌ DB ERROR: ${err.message}`));

// --- 3. REDIS ---
const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);

// --- 4. APP SETUP ---
const window = new JSDOM('').window;
const DOMPurify = createDomPurify(window);
const app = express();
const PORT = process.env.PORT || 6769;

app.use(morgan('dev', { stream: { write: msg => logger.info(msg.trim()) } }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(session({
    store: new RedisStore({ client: redisClient }),
    secret: process.env.SESSION_SECRET,
    resave: false, saveUninitialized: false,
    cookie: { maxAge: 86400000 } // 1 day
}));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

// --- 5. ROUTES ---

const requireLogin = (req, res, next) => {
    if (!req.session.userId) return res.redirect('/login');
    next();
};

// Middleware to always fetch history for the sidebar
const fetchHistory = async (req, res, next) => {
    if (req.session.userId) {
        // Get most recent posts first
        res.locals.history = await Post.findAll({ 
            where: { userId: req.session.userId },
            order: [['createdAt', 'DESC']],
            attributes: ['title', 'slug'] 
        });
    } else {
        res.locals.history = [];
    }
    next();
};

app.get('/login', (req, res) => res.render('login', { error: null }));

// ADD THIS NEW ROUTE HERE:
app.get('/legal', (req, res) => res.render('legal'));

// Auth
app.get('/login', (req, res) => res.render('login', { error: null }));
app.post('/login', async (req, res) => {
    const user = await User.findOne({ where: { username: req.body.username } });
    if (user && await bcrypt.compare(req.body.password, user.password)) {
        req.session.userId = user.id;
        return res.redirect('/');
    }
    res.render('login', { error: 'Invalid credentials.' });
});

app.get('/register', (req, res) => res.render('register', { error: null }));
app.post('/register', async (req, res) => {
    try {
        const hashed = await bcrypt.hash(req.body.password, 10);
        const user = await User.create({ username: req.body.username, password: hashed });
        req.session.userId = user.id;
        res.redirect('/');
    } catch (e) { res.render('register', { error: 'Username taken.' }); }
});

app.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/login')));

// Main App (Home - New Chat)
app.get('/', requireLogin, fetchHistory, (req, res) => {
    res.render('index', { currentPost: null });
});

// View Specific Post
app.get('/post/:slug', requireLogin, fetchHistory, async (req, res) => {
    const post = await Post.findOne({ where: { slug: req.params.slug, userId: req.session.userId } });
    if (!post) return res.redirect('/');
    res.render('index', { currentPost: post });
});

// Generate New Post
app.post('/consult-oracle', requireLogin, async (req, res) => {
    const prompt = req.body.prompt;
    if (!prompt) return res.redirect('/');

    try {
        // 1. Generate Content
        const result = await model.generateContent(`
            Act as a technical Oracle. Write a blog post for: "${prompt}".
            Format: Markdown. 
            Important: The very first line must be a short Title (max 6 words) starting with #.
        `);
        const rawMarkdown = result.response.text();
        
        // 2. Extract Title and Clean Markdown
        const titleMatch = rawMarkdown.match(/^#\s*(.+)/);
        const title = titleMatch ? titleMatch[1].trim() : prompt.substring(0, 30) + "...";
        const htmlContent = DOMPurify.sanitize(marked.parse(rawMarkdown));

        // 3. Generate 12-char Slug
        const slug = crypto.randomBytes(6).toString('hex'); // 6 bytes = 12 hex chars

        // 4. Save to DB
        await Post.create({
            userId: req.session.userId,
            slug: slug,
            prompt: prompt,
            title: title,
            content: htmlContent
        });

        // 5. Redirect to the new page
        res.redirect(`/post/${slug}`);

    } catch (error) {
        logger.error(error.message);
        res.redirect('/'); // Fail silently back to home for now
    }
});

app.listen(PORT, () => logger.info(`🏰 ORACLE OS: http://localhost:${PORT}`));