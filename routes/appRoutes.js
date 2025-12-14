const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const marked = require('marked');
const createDomPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const crypto = require('crypto');
const winston = require('winston');
const bcrypt = require('bcrypt');

const { User, Post } = require('../models');
const requireLogin = require('../middleware/auth');
const fetchUserData = require('../middleware/userData');

const router = express.Router();
const { encrypt, decrypt } = require('../utils/encryption');

// Setup DOMPurify
const window = new JSDOM('').window;
const DOMPurify = createDomPurify(window);

// Setup Logger (reusing a simple console logger for now, ideally imported from config/logger)
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.simple(),
    transports: [new winston.transports.Console()]
});

// AI CONFIGURATION
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const modelStandard = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Updated to match README note about flash-1.5 ideally, but keeping code close to original names if possible? No, the original used 'gemini-flash-latest', let's stick to what was there or what is working. 
// Wait, the original code had: genAI.getGenerativeModel({ model: "gemini-flash-latest" });
// I should verify if I need to change this. I'll stick to the original code's model names to avoid breaking things, 
// UNLESS I see they were wrong. The README said `gemini-1.5-flash`. The code said `gemini-flash-latest`. 
// I will keep the code's version to minimize risk, but I notice the original code had `gemini-pro-latest` too.
// Actually, let's just copy the logic exactly as it was to be safe.

const modelStandardExact = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const modelProExact = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
// Note: original code used "gemini-flash-latest" and "gemini-pro-latest". 
// I will use them as they were in the original file to separate risk of refactor from risk of API change.
// wait, I see I can just copy the lines from the original file I read.
// Code line 90: const modelStandard = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
// Code line 92: const modelPro = genAI.getGenerativeModel({ model: "gemini-pro-latest" });
// I'll stick to that.
const modelStandardOld = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
const modelProOld = genAI.getGenerativeModel({ model: "gemini-pro-latest" });

// Dashboard (New Chat)
router.get('/', requireLogin, fetchUserData, (req, res) => {
    // Note: If we display history snippets, we might need to decrypt titles or excerpts here too.
    // Assuming history-list uses 'title' which is NOT encrypted in DB (based on Post.js model).
    res.render('index', { currentPost: null, upgraded: req.query.upgraded });
});

// View Specific History Post
router.get('/post/:slug', requireLogin, fetchUserData, async (req, res) => {
    const post = await Post.findOne({ where: { slug: req.params.slug, userId: req.session.userId } });
    if (!post) return res.redirect('/');

    // Decrypt content for display
    post.content = decrypt(post.content);

    res.render('index', { currentPost: post, upgraded: null });
});

const { apiLimiter } = require('../middleware/security');

// Helper to fetch valid image from Wikipedia
async function fetchWikiImage(query) {
    try {
        const url = `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&piprop=original|thumbnail&titles=${encodeURIComponent(query)}&pithumbsize=600&origin=*`;
        const response = await fetch(url);
        const data = await response.json();

        const pages = data.query?.pages;
        if (!pages) return null;

        const firstPageId = Object.keys(pages)[0];
        if (firstPageId === '-1') return null; // Not found

        const page = pages[firstPageId];
        return page.original?.source || page.thumbnail?.source || null;
    } catch (e) {
        logger.error(`Wiki Image Fetch Failed for ${query}: ${e.message}`);
        return null;
    }
}

// AI GENERATION LOGIC
router.post('/consult-oracle', requireLogin, fetchUserData, apiLimiter, async (req, res) => {
    const user = res.locals.user;
    const prompt = req.body.prompt;
    if (!prompt) return res.redirect('/');

    // 1. CHECK LIMITS (Free Tier = Max 10)
    if (user.tier === 'Free' && user.generationCount >= 10) {
        return res.redirect('/pricing?reason=limit_reached');
    }

    try {
        // 2. SELECT MODEL
        const activeModel = (user.tier === 'Plus') ? modelProOld : modelStandardOld;

        const systemPrompt = `
            Act as a Creative Content Generator. The user will give you a prompt, idea, or theme: "${prompt}".
            
            Analyze the user's request to determine the best format (e.g., Story, Poem, Screenplay, YouTube Script, Article).
            If the user asks for a specific format (like "documentary" or "video"), prioritize that structure.

            **IMAGE RULES:**
            1. For SPECIFIC named entities (famous people, historical figures, specific places like 'Tokai Teio' or 'Kyoto'), use the tag: [[WIKISEARCH: Exact Name]].
            2. Do NOT use tags for generic scenes, abstract concepts, or characters that are not real/famous entities.

            Your Goal: Create a compelling piece of content based on this.
            Format: Markdown.
            Tone: Adaptive to the requested format.
            
            Start with a # Creative Title.
            Then provide the content.
        `;

        const result = await activeModel.generateContent(systemPrompt);
        let rawMarkdown = result.response.text();

        // 3. RESOLVE IMAGE TAGS (Async)

        // A. Resolve WIKISEARCH (Specific)
        const wikiRegex = /\[\[WIKISEARCH:\s*(.+?)\]\]/g;
        // Using string replacement loop for safety with async.
        const wikiMatches = [...rawMarkdown.matchAll(wikiRegex)];
        for (const match of wikiMatches) {
            const fullTag = match[0];
            const query = match[1];
            let imageUrl = await fetchWikiImage(query);

            if (imageUrl) {
                rawMarkdown = rawMarkdown.replace(fullTag, `![${query}](${imageUrl})`);
            } else {
                // Formatting fallback if no image found: Link to search text or remove
                rawMarkdown = rawMarkdown.replace(fullTag, `> *[Image of ${query} not found]*`);
            }
        }

        const htmlContent = DOMPurify.sanitize(marked.parse(rawMarkdown));

        // 3. EXTRACT TITLE
        const titleMatch = rawMarkdown.match(/^#\s*(.+)/);
        const title = titleMatch ? titleMatch[1].trim() : "Technical Guide";

        // 4. GENERATE ID (Slug)
        const slug = crypto.randomBytes(6).toString('hex');

        // 5. SAVE TO DB (ENCRYPTED)
        await Post.create({
            userId: req.session.userId,
            slug,
            prompt,
            title,
            content: encrypt(htmlContent),
            rawContent: encrypt(rawMarkdown)
        });

        // 6. INCREMENT USAGE COUNT
        await user.increment('generationCount');

        // 7. SHOW RESULT
        res.redirect(`/post/${slug}`);

    } catch (error) {
        logger.error(`GENERATION FAILED: ${error.message}`);
        res.redirect('/');
    }
});

// Download Post as Markdown
router.get('/post/:slug/download', requireLogin, fetchUserData, async (req, res) => {
    const post = await Post.findOne({ where: { slug: req.params.slug, userId: req.session.userId } });
    if (!post) return res.status(404).send('Post not found');

    res.setHeader('Content-Disposition', `attachment; filename="${post.slug}.md"`);
    res.setHeader('Content-Type', 'text/markdown');

    // Reconstruct the markdown file content
    const fileContent = `# ${post.title}\n\n${post.prompt}\n\n---\n\n${post.content}`; // Note: content is HTML in DB, wait. 
    // The DB stores `content` as HTML (DOMPurify(marked(raw))). 
    // We lost the raw markdown! 
    // Oh, the implementation plan said "Export generated content (Markdown)".
    // The current code: `const rawMarkdown = result.response.text(); ... await Post.create({ ... content: htmlContent });`
    // We aren't saving `rawMarkdown`.
    // I need to update the model to save `rawMarkdown` or just convert HTML back to text (poor quality).
    // Or just export the HTML content as .md (which is valid markdown usually) or just export as .html?
    // User requested "Export generated content (Markdown)".
    // I should probably add a column to `Post` to store `rawContent`.
    // That involves a DB migration (alter table).
    // Since we are using `sequelize.sync({ alter: true })`, it should handle adding the column automatically on restart.
    // 
    // Plan update:
    // 1. Update Post model to include `rawContent`.
    // 2. Update generation logic to save `rawContent`.
    // 3. For existing posts, `rawContent` will be null, so fallback to `content` (HTML).

    // Reconstruct the markdown file content
    const decryptedRaw = decrypt(post.rawContent);
    const decryptedHtml = decrypt(post.content);

    // Prefer raw markdown if available, else HTML
    res.send(decryptedRaw || decryptedHtml);
});

// Delete Post
router.post('/post/:slug/delete', requireLogin, async (req, res) => {
    await Post.destroy({ where: { slug: req.params.slug, userId: req.session.userId } });
    res.redirect('/');
});

// Settings Page
router.get('/settings', requireLogin, fetchUserData, (req, res) => {
    res.render('settings', { user: res.locals.user, error: null, success: null });
});

// Update Settings (Password)
router.post('/settings', requireLogin, fetchUserData, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findByPk(req.session.userId);

    if (!await bcrypt.compare(currentPassword, user.password)) {
        return res.render('settings', { user, error: 'Incorrect current password.', success: null });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    await user.save();

    res.render('settings', { user, error: null, success: 'Password updated successfully.' });
});

router.get('/legal', (req, res) => res.render('legal'));

module.exports = router;
