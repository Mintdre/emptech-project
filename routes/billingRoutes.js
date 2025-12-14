const express = require('express');
const { User } = require('../models');
const requireLogin = require('../middleware/auth');
const fetchUserData = require('../middleware/userData');
const router = express.Router();

// Pricing Page
router.get('/pricing', requireLogin, fetchUserData, (req, res) => {
    res.render('pricing', { reason: req.query.reason });
});

// Checkout Page (Mock)
router.get('/checkout/:plan', requireLogin, fetchUserData, (req, res) => {
    res.render('checkout', { plan: req.params.plan });
});

// Process Payment (Mock)
router.post('/process-payment', requireLogin, async (req, res) => {
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

module.exports = router;
