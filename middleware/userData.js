const { User, Post } = require('../models');

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

module.exports = fetchUserData;
