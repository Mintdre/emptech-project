const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// 1. HELMET (headers)
// Adjusting CSP to allow inline scripts/styles if necessary.
// For now, using defaults but relaxing for common CDNs if we find them.
// Safest bet for EJS without nonces is often to disable contentSecurityPolicy or configure it carefully.
// I will start with a configuration that allows common resources.
const helmetConfig = helmet({
    contentSecurityPolicy: {
        useDefaults: false, // Start fresh to avoid hidden defaults causing issues
        directives: {
            'default-src': ["'self'"],
            'script-src': ["'self'", "'unsafe-inline'"],
            'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            'font-src': ["'self'", 'https://fonts.gstatic.com'],
            'img-src': ["'self'", 'data:', 'https:'],
            'connect-src': ["'self'"]
        }
    },
    strictTransportSecurity: false, // Disable HSTS to prevent "ERR_SSL_PROTOCOL_ERROR" on HTTP
    upgradeInsecureRequests: null // Disable auto-upgrade to HTTPS
});

// 2. RATE LIMITING
// 2. RATE LIMITING (RELAXED FOR PRESENTATION)
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3000, // Increased for Class Presentation (was 100)
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.'
});

const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 500, // Increased for Class Presentation (was 100)
    message: 'Too many login attempts, please try again later.'
});

const apiLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 2000, // Increased for Class Presentation (was 50)
    message: 'AI generation limit reached for this IP.'
});

module.exports = { helmetConfig, globalLimiter, authLimiter, apiLimiter };
