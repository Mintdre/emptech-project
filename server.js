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
const crypto = require('crypto');

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

// --- 2. DATABASE SETUP (PostgreSQL) ---
const sequelize = new Sequelize(process.env.POSTGRES_URI, { 
    logging: false, 
    dialectOptions: { ssl: false } 
});

// User Model with SaaS Fields
const User = sequelize.define('User', {
    username: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },
    
    // SaaS Logic
    tier: { type: DataTypes.STRING, defaultValue: 'Free' }, // Options: Free, Premium, Plus
    generationCount: { type: DataTypes.INTEGER, defaultValue: 0 }, // How many blogs generated this month
    lastResetDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW } // When the month started for this user
});

// Blog Post Model
const Post = sequelize.define('Post', {
    slug: { type: DataTypes.STRING, unique: true, allowNull: false },
    prompt: { type: DataTypes.TEXT, allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false }
});

// Relationships
User.hasMany(Post, { foreignKey: 'userId' });
Post.belongsTo(User, { foreignKey: 'userId' });

// Sync DB
sequelize.authenticate().then(() => {
    logger.info('🔮 Database Connected (PostgreSQL)');
    return sequelize.sync({ alter: true });
}).catch(err => logger.error(`❌ DB ERROR: ${err.message}`));

// --- 3. REDIS & APP CONFIG ---
const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);

const window = new JSDOM('').window;
const DOMPurify = createDomPurify(window);
const app = express();
const PORT = process.env.PORT || 6769;

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

// --- 4. AI CONFIGURATION ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// Standard users get Flash (Fast/Cheap)
const modelStandard = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
// Plus users get Pro (Higher Quality / "Early Access")
const modelPro = genAI.getGenerativeModel({ model: "gemini-pro-latest" });

// --- 5. MIDDLEWARE ---

// Block access if not logged in
const requireLogin = (req, res, next) => {
    if (!req.session.userId) return res.redirect('/login');
    next();
};

// Fetch User Data, Handle Usage Resets, and Load History
const fetchUserData = async (req, res, next) => {
    if (req.session.userId) {
        const user = await User.findByPk(req.session.userId);
        
        // Handle case where session exists but user was deleted
        if (!user) {
            req.session.destroy();
            return res.redirect('/login');
        }

        // MONTHLY RESET LOGIC
        // If the current month is different from the last reset month, clear the counter
        const now = new Date();
        const last = new Date(user.lastResetDate);
        if (now.getMonth() !== last.getMonth() || now.getFullYear() !== last.getFullYear()) {
            user.generationCount = 0;
            user.lastResetDate = now;
            await user.save();
        }

        // Load History for Sidebar
        const history = await Post.findAll({ 
            where: { userId: req.session.userId },
            order: [['createdAt', 'DESC']],
            attributes: ['title', 'slug'] 
        });
        
        // Pass data to EJS templates
        res.locals.user = user;
        res.locals.history = history;
    } else {
        res.locals.user = null;
        res.locals.history = [];
    }
    next();
};

// --- 6. ROUTES ---

// --- AUTHENTICATION ---
app.get('/login', (req, res) => res.render('login', { error: null }));

app.post('/login', async (req, res) => {
    const user = await User.findOne({ where: { username: req.body.username } });
    if (user && await bcrypt.compare(req.body.password, user.password)) {
        req.session.userId = user.id;
        return res.redirect('/'); // Redirect to Dashboard
    }
    res.render('login', { error: 'Invalid credentials.' });
});

app.get('/register', (req, res) => res.render('register', { error: null }));

app.post('/register', async (req, res) => {
    try {
        const hashed = await bcrypt.hash(req.body.password, 10);
        // Create user (defaults to Free Tier)
        const user = await User.create({ username: req.body.username, password: hashed });
        req.session.userId = user.id;
        res.redirect('/'); // Redirect to Dashboard
    } catch (e) { 
        res.render('register', { error: 'Username already taken.' }); 
    }
});

app.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/login')));
app.get('/legal', (req, res) => res.render('legal'));

// --- MONETIZATION (SaaS) ---

// Pricing Page
app.get('/pricing', requireLogin, fetchUserData, (req, res) => {
    res.render('pricing', { reason: req.query.reason });
});

// Checkout Page (Mock)
app.get('/checkout/:plan', requireLogin, fetchUserData, (req, res) => {
    res.render('checkout', { plan: req.params.plan });
});

// Process Payment (Mock)
app.post('/process-payment', requireLogin, async (req, res) => {
    const { plan } = req.body;
    
    // Convert 'premium' -> 'Premium'
    const tierName = plan.charAt(0).toUpperCase() + plan.slice(1); 
    
    // Update User: Set new Tier and reset Usage Count
    await User.update(
        { tier: tierName, generationCount: 0 }, 
        { where: { id: req.session.userId } }
    );

    // Redirect home with a success flag
    res.redirect('/?upgraded=true');
});

// --- MAIN APPLICATION ---

// Dashboard (New Chat)
app.get('/', requireLogin, fetchUserData, (req, res) => {
    res.render('index', { currentPost: null, upgraded: req.query.upgraded });
});

// View Specific History Post
app.get('/post/:slug', requireLogin, fetchUserData, async (req, res) => {
    const post = await Post.findOne({ where: { slug: req.params.slug, userId: req.session.userId } });
    if (!post) return res.redirect('/');
    res.render('index', { currentPost: post, upgraded: null });
});

// AI GENERATION LOGIC
app.post('/consult-oracle', requireLogin, fetchUserData, async (req, res) => {
    const user = res.locals.user;
    const prompt = req.body.prompt;
    if (!prompt) return res.redirect('/');

    // 1. CHECK LIMITS (Free Tier = Max 10)
    if (user.tier === 'Free' && user.generationCount >= 10) {
        return res.redirect('/pricing?reason=limit_reached');
    }

    try {
        // 2. SELECT MODEL
        // 'Plus' users get the Pro model, everyone else gets Flash
        const activeModel = (user.tier === 'Plus') ? modelPro : modelStandard;
        
        const systemPrompt = `
            Act as a Senior Technical Writer. Write a structured blog post for: "${prompt}".
            Format: Markdown. 
            Tone: Professional, Clear, Concise.
            Include: Introduction, Prerequisites, Step-by-Step, Conclusion.
            Start with a # Title (max 6 words).
        `;

        const result = await activeModel.generateContent(systemPrompt);
        const rawMarkdown = result.response.text();
        const htmlContent = DOMPurify.sanitize(marked.parse(rawMarkdown));
        
        // 3. EXTRACT TITLE
        const titleMatch = rawMarkdown.match(/^#\s*(.+)/);
        const title = titleMatch ? titleMatch[1].trim() : "Technical Guide";
        
        // 4. GENERATE ID (Slug)
        const slug = crypto.randomBytes(6).toString('hex');

        // 5. SAVE TO DB
        await Post.create({ userId: req.session.userId, slug, prompt, title, content: htmlContent });
        
        // 6. INCREMENT USAGE COUNT
        await user.increment('generationCount');

        // 7. SHOW RESULT
        res.redirect(`/post/${slug}`);

    } catch (error) {
        logger.error(`GENERATION FAILED: ${error.message}`);
        res.redirect('/');
    }
});

// --- SERVER START ---
app.listen(PORT, () => {
    logger.info(`------------------------------------------------`);
    logger.info(`🏰 ORACLE OS ONLINE: http://localhost:${PORT}`);
    logger.info(`💾 DATABASE: PostgreSQL + Redis`);
    logger.info(`------------------------------------------------`);
});