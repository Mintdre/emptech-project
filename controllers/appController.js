const { GoogleGenerativeAI } = require('@google/generative-ai');
const marked = require('marked');
const createDomPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const crypto = require('crypto');
const winston = require('winston');
const { Post } = require('../models');
const { encrypt, decrypt } = require('../utils/encryption');

// Setup DOMPurify
const window = new JSDOM('').window;
const DOMPurify = createDomPurify(window);

// Logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.simple(),
    transports: [new winston.transports.Console()]
});

// AI Setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const modelStandard = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Helper: Wiki Image Fetcher
async function fetchWikiImage(query) {
    try {
        const url = `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&piprop=original|thumbnail&titles=${encodeURIComponent(query)}&pithumbsize=600&origin=*`;
        const response = await fetch(url);
        const data = await response.json();
        const pages = data.query?.pages;
        if (!pages) return null;
        const firstPageId = Object.keys(pages)[0];
        if (firstPageId === '-1') return null;
        const page = pages[firstPageId];
        return page.original?.source || page.thumbnail?.source || null;
    } catch (e) {
        logger.error(`Wiki Image Fetch Failed for ${query}: ${e.message}`);
        return null;
    }
}

// Controller Methods

exports.getDashboard = (req, res) => {
    res.render('index', { currentPost: null, upgraded: req.query.upgraded });
};

exports.getPost = async (req, res) => {
    try {
        const post = await Post.findOne({
            where: { slug: req.params.slug, userId: req.session.userId }
        });
        if (!post) return res.redirect('/');
        post.content = decrypt(post.content);
        res.render('index', { currentPost: post, upgraded: null });
    } catch (error) {
        logger.error(error);
        res.redirect('/');
    }
};

exports.generateContent = async (req, res) => {
    const user = res.locals.user;
    const prompt = req.body.prompt;
    if (!prompt) return res.redirect('/');

    if (user.tier === 'Free' && user.generationCount >= 10) {
        return res.redirect('/pricing?reason=limit_reached');
    }

    try {
        const activeModel = modelStandard; // Simplification for refactor, logic was: (user.tier === 'Plus') ? modelPro : modelStandard

        const systemPrompt = `
            Act as a Creative Content Generator. The user will give you a prompt, idea, or theme: "${prompt}".
            Analyze the user's request to determine the best format (e.g., Story, Poem, Screenplay, YouTube Script, Article).
            **IMAGE RULES:**
            1. For SPECIFIC named entities (famous people, historical figures, specific places), use the tag: [[WIKISEARCH: Exact Name]].
            2. Do NOT use tags for generic scenes.
            Your Goal: Create a compelling piece of content based on this.
            Format: Markdown.
            Start with a # Creative Title.
            Then provide the content.
        `;

        const result = await activeModel.generateContent(systemPrompt);
        let rawMarkdown = result.response.text();

        // Resolve Image Tags
        const wikiRegex = /\[\[WIKISEARCH:\s*(.+?)\]\]/g;
        const wikiMatches = [...rawMarkdown.matchAll(wikiRegex)];
        for (const match of wikiMatches) {
            const fullTag = match[0];
            const query = match[1];
            const imageUrl = await fetchWikiImage(query);
            if (imageUrl) {
                rawMarkdown = rawMarkdown.replace(fullTag, `![${query}](${imageUrl})`);
            } else {
                rawMarkdown = rawMarkdown.replace(fullTag, `> *[Image of ${query} not found]*`);
            }
        }

        const htmlContent = DOMPurify.sanitize(marked.parse(rawMarkdown));
        const titleMatch = rawMarkdown.match(/^#\s*(.+)/);
        const title = titleMatch ? titleMatch[1].trim() : 'Creative Piece';
        const slug = crypto.randomBytes(6).toString('hex');

        await Post.create({
            userId: req.session.userId,
            slug,
            prompt,
            title,
            content: encrypt(htmlContent),
            rawContent: encrypt(rawMarkdown)
        });

        await user.increment('generationCount');
        res.redirect(`/post/${slug}`);
    } catch (error) {
        logger.error(`GENERATION FAILED: ${error.message}`);
        res.redirect('/');
    }
};

// ... (previous content)

exports.generateContentStream = async (req, res) => {
    const user = res.locals.user;
    const prompt = req.body.prompt;
    if (!prompt) return res.status(400).json({ error: 'No prompt provided' });

    if (user.tier === 'Free' && user.generationCount >= 10) {
        return res
            .status(403)
            .json({ error: 'Limit reached', redirect: '/pricing?reason=limit_reached' });
    }

    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        const activeModel = modelStandard;
        const systemPrompt = `
            Act as a Creative Content Generator. The user will give you a prompt, idea, or theme: "${prompt}".
            Analyze the user's request to determine the best format (e.g., Story, Poem, Screenplay, YouTube Script, Article).
            **IMAGE RULES:**
            1. For SPECIFIC named entities (famous people, historical figures, specific places), use the tag: [[WIKISEARCH: Exact Name]].
            2. Do NOT use tags for generic scenes.
            Your Goal: Create a compelling piece of content based on this.
            Format: Markdown.
            Start with a # Creative Title.
            Then provide the content.
        `;

        const result = await activeModel.generateContentStream(systemPrompt);

        let fullRawMarkdown = '';

        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            res.write(JSON.stringify({ type: 'chunk', content: chunkText }) + '\n');
            fullRawMarkdown += chunkText;
        }

        const wikiRegex = /\[\[WIKISEARCH:\s*(.+?)\]\]/g;
        const wikiMatches = [...fullRawMarkdown.matchAll(wikiRegex)];
        for (const match of wikiMatches) {
            const fullTag = match[0];
            const query = match[1];
            const imageUrl = await fetchWikiImage(query);

            if (imageUrl) {
                fullRawMarkdown = fullRawMarkdown.replace(fullTag, `![${query}](${imageUrl})`);
            } else {
                fullRawMarkdown = fullRawMarkdown.replace(
                    fullTag,
                    `> *[Image of ${query} not found]*`
                );
            }
        }

        const htmlContent = DOMPurify.sanitize(marked.parse(fullRawMarkdown));
        const titleMatch = fullRawMarkdown.match(/^#\s*(.+)/);
        const title = titleMatch ? titleMatch[1].trim() : 'Creative Piece';
        const slug = crypto.randomBytes(6).toString('hex');

        await Post.create({
            userId: req.session.userId,
            slug,
            prompt,
            title,
            content: encrypt(htmlContent),
            rawContent: encrypt(fullRawMarkdown)
        });

        await user.increment('generationCount');
        res.write(JSON.stringify({ type: 'done', slug }) + '\n');
        res.end();
    } catch (error) {
        logger.error(`STREAM GENERATION FAILED: ${error.message}`);
        res.write(JSON.stringify({ type: 'error', message: 'Generation failed.' }) + '\n');
        res.end();
    }
};
