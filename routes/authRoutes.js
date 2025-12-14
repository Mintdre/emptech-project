const express = require('express');
const bcrypt = require('bcrypt');
const { User } = require('../models');
const { authLimiter } = require('../middleware/security');
const router = express.Router();

app = express();

router.get('/login', (req, res) => res.render('login', { error: null }));

router.post('/login', authLimiter, async (req, res) => {
    const user = await User.findOne({ where: { username: req.body.username } });
    if (user && await bcrypt.compare(req.body.password, user.password)) {
        req.session.userId = user.id;
        return res.redirect('/'); // Redirect to Dashboard
    }
    res.render('login', { error: 'Invalid credentials.' });
});

router.get('/register', (req, res) => res.render('register', { error: null }));

router.post('/register', async (req, res) => {
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

router.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/login')));

module.exports = router;
