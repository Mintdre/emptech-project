const express = require('express');
const router = express.Router();

const { User, Post } = require('../models');
const requireLogin = require('../middleware/auth');
const fetchUserData = require('../middleware/userData');
const { apiLimiter } = require('../middleware/security');
const { decrypt } = require('../utils/encryption');
const bcrypt = require('bcrypt');
const appController = require('../controllers/appController');

// Dashboard (New Chat)
router.get('/', requireLogin, fetchUserData, appController.getDashboard);

// View Specific History Post
router.get('/post/:slug', requireLogin, fetchUserData, appController.getPost);

// AI GENERATION LOGIC (LEGACY - FORM SUBMIT)
router.post(
    '/consult-oracle',
    requireLogin,
    fetchUserData,
    apiLimiter,
    appController.generateContent
);

// AI GENERATION LOGIC (STREAMING API)
router.post(
    '/api/chat/stream',
    requireLogin,
    fetchUserData,
    apiLimiter,
    appController.generateContentStream
);

// Download Post as Markdown
router.get('/post/:slug/download', requireLogin, fetchUserData, async (req, res) => {
    const post = await Post.findOne({
        where: { slug: req.params.slug, userId: req.session.userId }
    });
    if (!post) return res.status(404).send('Post not found');

    res.setHeader('Content-Disposition', `attachment; filename="${post.slug}.md"`);
    res.setHeader('Content-Type', 'text/markdown');

    const decryptedRaw = decrypt(post.rawContent);
    const decryptedHtml = decrypt(post.content);

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

    if (!(await bcrypt.compare(currentPassword, user.password))) {
        return res.render('settings', {
            user,
            error: 'Incorrect current password.',
            success: null
        });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    await user.save();

    res.render('settings', { user, error: null, success: 'Password updated successfully.' });
});

router.get('/legal', (req, res) => res.render('legal'));

module.exports = router;
