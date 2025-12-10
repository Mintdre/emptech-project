require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const marked = require('marked');
const createDomPurify = require('dompurify');
const { JSDOM } = require('jsdom');

// --- Mock Database (In-Memory) ---
// This array will hold users while the server is running.
// It resets if you restart the server.
const mockUsers = []; 

const window = new JSDOM('').window;
const DOMPurify = createDomPurify(window);

const app = express();
const PORT = process.env.PORT || 6769;

// --- Middleware ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');

// --- In-Memory Session (No Redis needed) ---
app.use(session({
    secret: process.env.SESSION_SECRET || 'dev_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// --- AI Setup ---
// Make sure GEMINI_API_KEY is still in your .env file!
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

// --- Middleware to check login ---
const requireLogin = (req, res, next) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    next();
};

// --- Routes ---

// Auth Routes
app.get('/login', (req, res) => res.render('login', { error: null }));

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    // MOCK: Search the array instead of MongoDB
    const user = mockUsers.find(u => u.username === username);
    
    if (user && await bcrypt.compare(password, user.password)) {
        req.session.userId = user.id;
        return res.redirect('/');
    }
    res.render('login', { error: 'Invalid credentials, traveler.' });
});

app.get('/register', (req, res) => res.render('register', { error: null }));

app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // MOCK: Check array for duplicate
        if (mockUsers.find(u => u.username === username)) {
            return res.render('register', { error: 'That name is already taken by another guild member.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        // MOCK: Create user object
        const newUser = {
            id: Date.now().toString(), // Simple ID generation
            username: username,
            password: hashedPassword
        };
        
        // MOCK: Save to array
        mockUsers.push(newUser);
        
        // Auto-login
        req.session.userId = newUser.id;
        res.redirect('/');
        
    } catch (e) {
        console.error(e);
        res.render('register', { error: 'The archives rejected your signature.' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
});

// Main App Route
app.get('/', requireLogin, (req, res) => {
    // We verify the user still exists in our mock DB
    const user = mockUsers.find(u => u.id === req.session.userId);
    if (!user) {
        // If server restarted, session might exist but user array is empty
        return res.redirect('/login');
    }
    
    // Pass prompt/response as undefined initially
    res.render('index', { response: undefined, prompt: undefined });
});

// The AI Generation Route
app.post('/consult-oracle', requireLogin, async (req, res) => {
    const userPrompt = req.body.prompt;
    
    // Safety check if prompt is empty
    if (!userPrompt || userPrompt.trim() === "") {
        return res.render('index', { response: "<p>You remained silent. The Oracle cannot answer silence.</p>", prompt: "" });
    }

    const systemInstruction = `
    You are the "Grand Oracle of the Tech Village". 
    The user will ask how to do a task (e.g., "How to use GIMP like Photoshop").
    Create a detailed, helpful BLOG POST/TUTORIAL in Markdown format.
    
    Guidelines:
    1. Tone: Helpful, slightly medieval/fantasy flavor but keep technical terms accurate.
    2. Structure: Title, Introduction, Step-by-Step Guide, Conclusion.
    3. Media: Use Markdown image syntax. Use "https://placehold.co/600x400?text=Step+Image" if you can't find a real one, or suggest a YouTube search link.
    4. Citations: List sources at the bottom.
    
    User Query: ${userPrompt}
    `;

    try {
        const result = await model.generateContent(systemInstruction);
        const rawMarkdown = result.response.text();
        const htmlContent = DOMPurify.sanitize(marked.parse(rawMarkdown));
        
        res.render('index', { response: htmlContent, prompt: userPrompt });
    } catch (error) {
        console.error("Gemini Error:", error);
        res.render('index', { 
            response: "<p>The magical ley lines are disrupted (API Error). Check your console.</p>", 
            prompt: userPrompt 
        });
    }
});

app.listen(PORT, () => {
    console.log(`🏰 The Oracle's Hearth is open at http://localhost:${PORT}`);
    console.log(`⚠️  Running in MOCK MODE (Data will vanish on restart)`);
});